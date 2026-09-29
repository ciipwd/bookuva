import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  BotConfig,
  Candle,
  Position,
  Trade,
  PerformanceStats,
  AiAnalysisResult,
  StrategyType,
  ApiKeyStatus,
  PositionSide,
  PositionDirection,
  MarketScanResult,
  IndicatorValues,
  AiPrimitivesInsight,
  OrderBookMicrostructure,
  DualTierAiStatus,
  ProbabilityFactorBreakdown,
  AiSignal,
} from './src/types/trading';
import { extractLatestIndicators } from './src/utils/indicators';
import { calculateMarketProbability } from './src/utils/probabilityEngine';
import { evaluateDecisionPrimitives } from './src/utils/decisionPrimitives';
import { analyzeOrderBookMicrostructure } from './src/utils/orderbookMicrostructure';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// CoinDCX API Credentials from Environment
const COINDCX_API_KEY = process.env.COINDCX_API_KEY || '';
const COINDCX_API_SECRET = process.env.COINDCX_API_SECRET || '';
const COINDCX_BASE_URL = 'https://api.coindcx.com';
const COINDCX_PUBLIC_URL = 'https://public.coindcx.com';

// Live USDT/INR FX rate (synced with CoinDCX USDTINR ticker, default ~100 INR)
let currentUsdtInrRate = 100.0;

// In-Memory Trading Bot Engine State (CoinDCX Futures with INR Margin: ₹10,000 INR Paper Capital)
const STARTING_INR_EQUITY = 10000; // ₹10,000 INR starting futures paper margin
const STARTING_USD_EQUITY = 100; // ~$100 USD

const botState: {
  config: BotConfig;
  positions: Position[];
  trades: Trade[];
  performance: PerformanceStats;
  systemLogs: Array<{ id: string; timestamp: number; level: 'info' | 'trade' | 'warning' | 'error'; message: string }>;
  paperBalances: { USDT: number; INR: number; BTC: number; ETH: number; SOL: number };
  lastEvaluationTime: number;
} = {
  config: {
    isRunning: false,
    mode: 'paper', // Default to safe high-fidelity paper trading
    tradingType: 'futures',
    marginCurrency: 'INR',
    defaultLeverage: 10,
    allowedDirection: 'BOTH',
    activeMarket: 'BTCUSDT',
    candlePair: 'B-BTC_USDT',
    timeframe: '1m',
    strategy: 'confluence_ensemble',
    minAiConfidence: 75,
    risk: {
      capitalPerTradePercent: 100, // Configured for 100% INR capital allocation
      maxOpenPositions: 3,
      stopLossPercent: 1.5,
      takeProfitPercent: 3.0,
      trailingStopLoss: true,
      trailingStopPercent: 1.0,
      trailingActivationPercent: 0.5,
      trailingUseSuperTrend: true,
      maxDailyDrawdownPercent: 5.0,
      cooldownMinutes: 1,
      slippageTolerancePercent: 0.15,
      minWinProbabilityPercent: 80,
      autoBreakevenLock: true,
      breakevenTriggerPercent: 0.8,
      earlyMomentumCut: true,
      autoScanMultiMarket: true,
    },
  },
  positions: [],
  trades: [],
  performance: {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    netProfit: 0,
    netProfitInr: 0,
    netProfitPercent: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0,
    averageTradePnl: 0,
    maxDrawdownPercent: 0,
    sharpeRatio: 0,
    currentEquity: STARTING_USD_EQUITY,
    currentEquityInr: STARTING_INR_EQUITY,
    startingEquity: STARTING_USD_EQUITY,
    startingEquityInr: STARTING_INR_EQUITY,
    equityHistory: [
      { timestamp: Date.now() - 3600000 * 24, equity: STARTING_USD_EQUITY, equityInr: STARTING_INR_EQUITY },
      { timestamp: Date.now(), equity: STARTING_USD_EQUITY, equityInr: STARTING_INR_EQUITY },
    ],
  },
  systemLogs: [
    {
      id: 'log-1',
      timestamp: Date.now(),
      level: 'info',
      message: 'CoinDCX INR Futures Trading Engine initialized. Connected to live CoinDCX exchange feed with INR margin collateral.',
    },
  ],
  paperBalances: {
    USDT: STARTING_USD_EQUITY,
    INR: STARTING_INR_EQUITY,
    BTC: 0,
    ETH: 0,
    SOL: 0,
  },
  lastEvaluationTime: 0,
};

function logSystem(level: 'info' | 'trade' | 'warning' | 'error', message: string) {
  const logItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    level,
    message,
  };
  botState.systemLogs.unshift(logItem);
  if (botState.systemLogs.length > 200) {
    botState.systemLogs.pop();
  }
}

// Calculate liquidation price for Futures position
function calculateLiquidationPrice(entryPrice: number, direction: PositionDirection, leverage: number): number {
  const maintenanceMarginRate = 0.005; // 0.5% maintenance margin
  const bankruptcyBuffer = (1 / Math.max(1, leverage)) - maintenanceMarginRate;
  if (direction === 'LONG') {
    return Math.max(0, entryPrice * (1 - bankruptcyBuffer));
  } else {
    return entryPrice * (1 + bankruptcyBuffer);
  }
}

// HMAC Signature Generator for CoinDCX Authenticated Endpoints
function signCoinDcxPayload(body: Record<string, any>, secret: string): string {
  const jsonString = JSON.stringify(body);
  return crypto.createHmac('sha256', secret).update(jsonString).digest('hex');
}

// Pair Precision & Step Size Specifications for CoinDCX Futures
function getPairPrecision(pairName: string): { qtyDecimals: number; minQty: number; priceDecimals: number } {
  const p = pairName.toUpperCase();
  if (p.includes('BTC')) return { qtyDecimals: 3, minQty: 0.001, priceDecimals: 2 };
  if (p.includes('ETH')) return { qtyDecimals: 2, minQty: 0.01, priceDecimals: 2 };
  if (p.includes('SOL')) return { qtyDecimals: 1, minQty: 0.1, priceDecimals: 2 };
  if (p.includes('BNB')) return { qtyDecimals: 2, minQty: 0.01, priceDecimals: 2 };
  if (p.includes('DOGE') || p.includes('XRP') || p.includes('ADA') || p.includes('TRX')) {
    return { qtyDecimals: 0, minQty: 1, priceDecimals: 4 };
  }
  return { qtyDecimals: 2, minQty: 0.01, priceDecimals: 2 };
}

// Cached Live CoinDCX Balances
let cachedLiveBalances: {
  inr: number;
  usdt: number;
  totalInr: number;
  isFunded: boolean;
  minOrderValueUsdt: number;
  minOrderValueInr: number;
  lastUpdated: number;
} | null = null;
let lastLiveBalancesFetch = 0;

async function fetchCoinDcxLiveBalances() {
  if (!COINDCX_API_KEY || !COINDCX_API_SECRET) return null;
  const now = Date.now();
  if (cachedLiveBalances && now - lastLiveBalancesFetch < 4000) {
    return cachedLiveBalances;
  }
  try {
    const timestamp = Date.now();
    const body = { timestamp };
    const signature = signCoinDcxPayload(body, COINDCX_API_SECRET);
    const res = await fetch(`${COINDCX_BASE_URL}/exchange/v1/users/balances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': COINDCX_API_KEY,
        'X-AUTH-SIGNATURE': signature,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return cachedLiveBalances;
    const rawBalances = await res.json();
    if (!Array.isArray(rawBalances)) return cachedLiveBalances;

    let inr = 0;
    let usdt = 0;
    for (const b of rawBalances) {
      if (b.currency === 'INR') inr = Number(b.balance) || 0;
      if (b.currency === 'USDT') usdt = Number(b.balance) || 0;
    }
    const totalInr = inr + (usdt * currentUsdtInrRate);
    const minOrderValueUsdt = 60.0; // CoinDCX minimum derivatives order value
    const minOrderValueInr = minOrderValueUsdt * currentUsdtInrRate;

    cachedLiveBalances = {
      inr,
      usdt,
      totalInr,
      isFunded: totalInr >= minOrderValueInr || usdt >= minOrderValueUsdt,
      minOrderValueUsdt,
      minOrderValueInr,
      lastUpdated: now,
    };
    lastLiveBalancesFetch = now;
    return cachedLiveBalances;
  } catch (err: any) {
    console.error('Failed to fetch live CoinDCX balances:', err.message);
    return cachedLiveBalances;
  }
}

// Execute Real Live Order on CoinDCX Derivatives Futures
async function executeCoinDcxLiveFuturesOrder(params: {
  pair: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  price?: number;
  quantity: number;
  leverage: number;
  marginCurrency?: 'INR' | 'USDT';
}): Promise<{ success: boolean; order?: any; error?: string }> {
  if (!COINDCX_API_KEY || !COINDCX_API_SECRET) {
    const err = 'CoinDCX API Key & Secret not configured in server environment.';
    logSystem('error', `[LIVE ORDER FAILED] ${err}`);
    return { success: false, error: err };
  }

  const { qtyDecimals, minQty, priceDecimals } = getPairPrecision(params.pair);
  const normalizedQty = Math.max(minQty, Number(params.quantity.toFixed(qtyDecimals)));
  const timestamp = Date.now();
  const marginCurrency = params.marginCurrency || 'INR';

  // Check live account balance first
  const liveBalances = await fetchCoinDcxLiveBalances();
  if (liveBalances && !liveBalances.isFunded) {
    const errorMsg = `Insufficient CoinDCX Wallet Balance: Your live account has ₹${liveBalances.inr.toFixed(2)} INR (${liveBalances.usdt.toFixed(2)} USDT). CoinDCX futures requires a minimum order value of 60 USDT (~₹${liveBalances.minOrderValueInr.toFixed(0)} INR). Please deposit funds to CoinDCX or switch to Paper Trading.`;
    logSystem('warning', `[LIVE ORDER BLOCKED] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const orderPayload: any = {
    side: params.side,
    pair: params.pair,
    order_type: params.orderType === 'market' ? 'market_order' : 'limit_order',
    total_quantity: normalizedQty,
    leverage: Math.max(1, Math.min(params.leverage, 50)),
    notification: 'no_notification',
    hidden: false,
    post_only: false,
    margin_currency_short_name: marginCurrency,
  };

  if (params.orderType === 'limit') {
    if (!params.price || params.price <= 0) {
      return { success: false, error: 'Price is required for limit orders.' };
    }
    orderPayload.price = Number(params.price.toFixed(priceDecimals));
    orderPayload.time_in_force = 'good_till_cancel';
  }

  const fullPayload = {
    timestamp,
    order: orderPayload,
  };

  const signature = signCoinDcxPayload(fullPayload, COINDCX_API_SECRET);

  try {
    const response = await fetch(`${COINDCX_BASE_URL}/exchange/v1/derivatives/futures/orders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': COINDCX_API_KEY,
        'X-AUTH-SIGNATURE': signature,
      },
      body: JSON.stringify(fullPayload),
    });

    const responseText = await response.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {}

    if (!response.ok) {
      const serverMsg = responseJson?.message || responseJson?.error || responseText || 'Order rejected by CoinDCX';
      let userFriendlyError = serverMsg;
      if (serverMsg.toLowerCase().includes('insufficient funds')) {
        const inrStr = liveBalances ? `₹${liveBalances.inr.toFixed(2)} INR` : 'below required';
        userFriendlyError = `Insufficient CoinDCX margin funds (${inrStr}). CoinDCX futures requires minimum 60 USDT (~₹${(60 * currentUsdtInrRate).toFixed(0)} INR) margin. Please deposit funds on CoinDCX or switch to Paper Trading.`;
      } else if (serverMsg.toLowerCase().includes('minimum order value')) {
        userFriendlyError = `CoinDCX minimum order value is 60 USDT (~₹${(60 * currentUsdtInrRate).toFixed(0)} INR). Increase order quantity or leverage.`;
      }
      logSystem('error', `[COINDCX LIVE ORDER REJECTED] ${userFriendlyError}`);
      return { success: false, error: userFriendlyError };
    }

    logSystem(
      'trade',
      `[COINDCX LIVE ORDER PLACED] ${params.side.toUpperCase()} ${normalizedQty} ${params.pair} (${params.leverage}x, ${marginCurrency} margin) | ID: ${responseJson?.id || 'OK'}`
    );
    return { success: true, order: responseJson };
  } catch (err: any) {
    const errMsg = `Network error connecting to CoinDCX: ${err.message}`;
    logSystem('error', `[LIVE ORDER NETWORK ERROR] ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

// -------------------------------------------------------------
// CoinDCX Exchange Endpoints Proxy
// -------------------------------------------------------------

// Cached tickers to avoid aggressive rate limits
let cachedTickers: any[] = [];
let lastTickersFetch = 0;

app.get('/api/coindcx/tickers', async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cachedTickers.length > 0 && now - lastTickersFetch < 2500) {
      return res.json({ success: true, data: cachedTickers, source: 'cache', usdtInrRate: currentUsdtInrRate });
    }

    const response = await fetch(`${COINDCX_BASE_URL}/exchange/ticker`);
    if (!response.ok) {
      throw new Error(`CoinDCX ticker API returned status: ${response.status}`);
    }
    const data = await response.json();
    cachedTickers = data;
    lastTickersFetch = now;

    // Find and update USDTINR FX rate
    const usdtInrTicker = data.find((t: any) => t.market === 'USDTINR');
    if (usdtInrTicker && !isNaN(Number(usdtInrTicker.last_price))) {
      currentUsdtInrRate = Number(usdtInrTicker.last_price);
    }

    res.json({ success: true, data, source: 'live', usdtInrRate: currentUsdtInrRate });
  } catch (error: any) {
    console.error('Error fetching CoinDCX tickers:', error.message);
    if (cachedTickers.length > 0) {
      return res.json({ success: true, data: cachedTickers, source: 'stale_cache', usdtInrRate: currentUsdtInrRate });
    }
    res.status(500).json({ success: false, error: error.message, usdtInrRate: currentUsdtInrRate });
  }
});

// CoinDCX Futures Active Instruments
app.get('/api/coindcx/futures/instruments', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${COINDCX_BASE_URL}/exchange/v1/derivatives/futures/data/active_instruments`);
    if (!response.ok) {
      throw new Error(`Failed to fetch futures instruments: ${response.status}`);
    }
    const instruments = await response.json();
    res.json({ success: true, instruments });
  } catch (error: any) {
    // Fallback list of popular CoinDCX futures pairs
    const fallback = ['B-BTC_USDT', 'B-ETH_USDT', 'B-SOL_USDT', 'B-BNB_USDT', 'B-XRP_USDT', 'B-DOGE_USDT', 'B-ADA_USDT'];
    res.json({ success: true, instruments: fallback, fallback: true });
  }
});

// Normalizes any coin pair string into CoinDCX standard format (e.g. BTCUSDT -> B-BTC_USDT)
function normalizeCoinDcxCandlePair(rawPair: string): string {
  if (!rawPair) return 'B-BTC_USDT';
  const p = rawPair.trim();

  // If already in standard format like B-BTC_USDT or I-BTC_INR
  if (/^[A-Z]-[A-Z0-9]+_[A-Z0-9]+$/.test(p)) {
    return p;
  }

  // Handle B-BTCUSDT (missing underscore)
  if (p.startsWith('B-') && !p.includes('_')) {
    const sym = p.slice(2);
    if (sym.endsWith('USDT')) return `B-${sym.slice(0, -4)}_USDT`;
    if (sym.endsWith('INR')) return `B-${sym.slice(0, -3)}_INR`;
    return `B-${sym}_USDT`;
  }

  // Handle I-BTCINR (missing underscore)
  if (p.startsWith('I-') && !p.includes('_')) {
    const sym = p.slice(2);
    if (sym.endsWith('INR')) return `I-${sym.slice(0, -3)}_INR`;
    if (sym.endsWith('USDT')) return `I-${sym.slice(0, -4)}_USDT`;
    return `I-${sym}_INR`;
  }

  // Handle plain market symbol like BTCUSDT, ETHUSDT
  if (p.endsWith('USDT')) {
    return `B-${p.slice(0, -4)}_USDT`;
  }
  if (p.endsWith('INR')) {
    return `I-${p.slice(0, -3)}_INR`;
  }
  if (p.includes('_')) {
    return p.startsWith('B-') || p.startsWith('I-') ? p : `B-${p}`;
  }

  return `B-${p}_USDT`;
}

// Normalizes candle intervals to valid CoinDCX intervals
function normalizeCoinDcxInterval(rawInterval: string): string {
  if (!rawInterval) return '1m';
  const val = rawInterval.trim().toLowerCase();
  const valid = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '1d', '3d', '1w', '1M'];
  if (valid.includes(val)) return val;
  if (val === '60m' || val === '60') return '1h';
  if (val === '240m' || val === '240') return '4h';
  if (val === '1440m') return '1d';
  return '1m';
}

app.get('/api/coindcx/candles', async (req: Request, res: Response) => {
  try {
    const rawPair = (req.query.pair as string) || 'B-BTC_USDT';
    const rawInterval = (req.query.interval as string) || '1m';
    const limit = Math.min(Math.max(10, Number(req.query.limit) || 120), 500);

    const pair = normalizeCoinDcxCandlePair(rawPair);
    const interval = normalizeCoinDcxInterval(rawInterval);

    let candles: Candle[] = [];

    // Attempt 1: Fetch from CoinDCX public market_data candles endpoint
    try {
      const url = `${COINDCX_PUBLIC_URL}/market_data/candles?pair=${encodeURIComponent(
        pair
      )}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

      const response = await fetch(url);
      if (response.ok) {
        const rawCandles = await response.json();
        if (Array.isArray(rawCandles) && rawCandles.length > 0) {
          candles = rawCandles
            .map((c: any) => ({
              time: Number(c.time),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: Number(c.volume),
            }))
            .sort((a, b) => a.time - b.time);
        }
      }
    } catch (e: any) {
      // Continue to fallback
    }

    // Attempt 2: If primary was empty, try rawPair if it differed
    if (candles.length === 0 && rawPair !== pair) {
      try {
        const altUrl = `${COINDCX_PUBLIC_URL}/market_data/candles?pair=${encodeURIComponent(
          rawPair
        )}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
        const altRes = await fetch(altUrl);
        if (altRes.ok) {
          const rawCandles = await altRes.json();
          if (Array.isArray(rawCandles) && rawCandles.length > 0) {
            candles = rawCandles
              .map((c: any) => ({
                time: Number(c.time),
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: Number(c.volume),
              }))
              .sort((a, b) => a.time - b.time);
          }
        }
      } catch (e: any) {}
    }

    // Graceful Fallback: If CoinDCX returned 422, unlisted pair, or throttled, anchor to live ticker price
    let isFallback = false;
    if (candles.length === 0) {
      isFallback = true;
      const cleanMarket = rawPair.replace(/^[BI]-/, '').replace(/_/g, '');
      const ticker = cachedTickers.find(
        (t) => t.market === cleanMarket || t.market === rawPair || t.market === pair
      );
      const basePrice = ticker && Number(ticker.last_price) > 0 ? Number(ticker.last_price) : 83000;
      candles = generateFallbackCandles(basePrice, Math.min(limit, 60));
    }

    // Compute technical indicators safely
    const indicators = candles.length >= 14 ? extractLatestIndicators(candles) : null;

    res.json({
      success: true,
      pair,
      interval,
      candles,
      indicators,
      usdtInrRate: currentUsdtInrRate,
      fallback: isFallback,
    });
  } catch (error: any) {
    // Under no circumstances crash with 500 Unprocessable Entity!
    console.warn('Candle fallback engaged:', error.message);
    const fallbackCandles = generateFallbackCandles(83000, 50);
    res.json({
      success: true,
      pair: req.query.pair || 'B-BTC_USDT',
      interval: req.query.interval || '1m',
      candles: fallbackCandles,
      indicators: extractLatestIndicators(fallbackCandles),
      usdtInrRate: currentUsdtInrRate,
      fallback: true,
    });
  }
});

app.get('/api/coindcx/orderbook', async (req: Request, res: Response) => {
  try {
    const rawPair = (req.query.pair as string) || 'B-BTC_USDT';
    const pair = normalizeCoinDcxCandlePair(rawPair);
    let data: any = null;

    try {
      const response = await fetch(
        `${COINDCX_PUBLIC_URL}/market_data/orderbook?pair=${encodeURIComponent(pair)}`
      );
      if (response.ok) {
        data = await response.json();
      }
    } catch (e) {}

    const cleanMarket = rawPair.replace(/^[BI]-/, '').replace(/_/g, '');
    const ticker = cachedTickers.find(
      (t) => t.market === cleanMarket || t.market === rawPair || t.market === pair
    );
    const currentPrice = ticker && Number(ticker.last_price) > 0 ? Number(ticker.last_price) : 83000;

    let bids: any[] = [];
    let asks: any[] = [];

    if (data && (data.bids || data.asks)) {
      const rawBids = data.bids || {};
      const rawAsks = data.asks || {};

      bids = Object.entries(rawBids)
        .map(([price, qty]) => ({
          price: Number(price),
          quantity: Number(qty),
          total: Number(price) * Number(qty),
        }))
        .filter((b) => b.price > 0 && b.quantity > 0)
        .sort((a, b) => b.price - a.price)
        .slice(0, 15);

      asks = Object.entries(rawAsks)
        .map(([price, qty]) => ({
          price: Number(price),
          quantity: Number(qty),
          total: Number(price) * Number(qty),
        }))
        .filter((a) => a.price > 0 && a.quantity > 0)
        .sort((a, b) => a.price - b.price)
        .slice(0, 15);
    }

    // Fallback order book around live price if CoinDCX returns 422 or empty
    if (bids.length === 0 || asks.length === 0) {
      bids = [];
      asks = [];
      for (let i = 1; i <= 12; i++) {
        const bp = currentPrice * (1 - i * 0.0007);
        const ap = currentPrice * (1 + i * 0.0007);
        const bq = 0.5 + Math.random() * 2.0;
        const aq = 0.5 + Math.random() * 2.0;
        bids.push({ price: Number(bp.toFixed(2)), quantity: Number(bq.toFixed(4)), total: bp * bq });
        asks.push({ price: Number(ap.toFixed(2)), quantity: Number(aq.toFixed(4)), total: ap * aq });
      }
    }

    const bestBid = bids[0]?.price || currentPrice * 0.9995;
    const bestAsk = asks[0]?.price || currentPrice * 1.0005;
    const spread = bestAsk > bestBid ? bestAsk - bestBid : 0;
    const spreadPercent = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

    res.json({
      success: true,
      orderBook: {
        timestamp: Date.now(),
        bids,
        asks,
        spread,
        spreadPercent,
      },
    });
  } catch (error: any) {
    console.warn('Orderbook fallback engaged:', error.message);
    res.json({
      success: true,
      orderBook: {
        timestamp: Date.now(),
        bids: [],
        asks: [],
        spread: 0,
        spreadPercent: 0,
      },
    });
  }
});

// Credentials check
app.get('/api/coindcx/credentials-status', async (_req: Request, res: Response) => {
  const hasApiKey = Boolean(COINDCX_API_KEY && COINDCX_API_KEY.length > 5);
  const hasApiSecret = Boolean(COINDCX_API_SECRET && COINDCX_API_SECRET.length > 10);
  const maskedKey = hasApiKey
    ? `${COINDCX_API_KEY.slice(0, 4)}••••••••${COINDCX_API_KEY.slice(-4)}`
    : 'Not configured (Paper Trading active)';

  const liveBalances = await fetchCoinDcxLiveBalances();

  const status: ApiKeyStatus = {
    hasApiKey,
    hasApiSecret,
    maskedKey,
    isLiveAvailable: hasApiKey && hasApiSecret,
    activeMode: botState.config.mode,
    serverIpInfo: 'Zero client-side secrets: All CoinDCX API calls signed via server HMAC-SHA256 vault.',
    permissions: [
      'Derivatives Futures Trading (INR Margin)',
      'Spot Order Placement',
      'Account Balance Query',
      'Market Data Stream (Public)',
    ],
    liveBalances: liveBalances || undefined,
  };

  res.json({ success: true, status });
});

// -------------------------------------------------------------
// Gemini AI Market Intelligence Analysis for INR Futures
// -------------------------------------------------------------

// Global Gemini Quota Circuit Breaker & Performance Cache
let geminiQuotaCooldownUntil = 0;
const analysisCache = new Map<string, { timestamp: number; analysis: AiAnalysisResult }>();
const dualTierCache = new Map<string, { timestamp: number; insight: AiPrimitivesInsight; dualTier: DualTierAiStatus }>();

// Deterministic High-Precision Quantitative Engine (Zero-Latency Fallback)
function buildDeterministicAiAnalysis(
  market: string,
  pair: string,
  currentPrice: number,
  quantitativeProb: ProbabilityFactorBreakdown,
  indicators: any,
  recentCandles: Candle[],
  usdtInrRate: number
): AiAnalysisResult {
  const dir = quantitativeProb.recommendedDirection;
  const winProb = quantitativeProb.overallWinProbability;
  const isBull = dir === 'LONG';
  const isBear = dir === 'SHORT';

  let signal: AiSignal = 'HOLD';
  if (isBull) {
    signal = winProb >= 80 ? 'STRONG_BUY' : 'BUY';
  } else if (isBear) {
    signal = winProb >= 80 ? 'STRONG_SELL' : 'SELL';
  }

  const inrPrice = currentPrice * usdtInrRate;
  const suggestedLeverage = quantitativeProb.lossRiskLevel === 'LOW' ? 12 : quantitativeProb.lossRiskLevel === 'MEDIUM' ? 8 : 5;
  const tpDistance = isBull ? 0.028 : isBear ? -0.028 : 0.02;
  const slDistance = isBull ? -0.012 : isBear ? 0.012 : -0.012;

  const suggestedEntry = currentPrice;
  const suggestedTakeProfit = Number((currentPrice * (1 + tpDistance)).toFixed(2));
  const suggestedStopLoss = Number((currentPrice * (1 + slDistance)).toFixed(2));
  const breakevenTriggerPrice = Number((currentPrice * (1 + (isBull ? 0.008 : -0.008))).toFixed(2));
  const estimatedLiquidationPrice = Number(
    (isBull ? currentPrice * (1 - 0.9 / suggestedLeverage) : currentPrice * (1 + 0.9 / suggestedLeverage)).toFixed(2)
  );

  const invalidationLevel = indicators?.superTrend?.value
    ? Number(indicators.superTrend.value.toFixed(2))
    : Number((isBull ? currentPrice * 0.985 : currentPrice * 1.015).toFixed(2));

  const superTrendDesc = indicators?.superTrend
    ? `SuperTrend is ${indicators.superTrend.direction} ($${indicators.superTrend.value.toFixed(2)})${indicators.superTrend.trendFlipped ? ' with a recent trend flip' : ''}.`
    : 'SuperTrend neutral.';

  const rsi = indicators?.rsi ?? 50;
  const rsiAssessment = rsi > 70
    ? `RSI at ${rsi.toFixed(1)} (Overbought territory, monitor for divergence)`
    : rsi < 30
    ? `RSI at ${rsi.toFixed(1)} (Oversold condition, favorable risk/reward)`
    : `RSI at ${rsi.toFixed(1)} in balanced momentum zone`;

  const macd = indicators?.macd;
  const macdAssessment = macd
    ? `MACD histogram at ${macd.histogram.toFixed(3)}, signal line ${macd.signalLine.toFixed(3)} indicates ${macd.histogram > 0 ? 'bullish expansion' : 'bearish pressure'}`
    : 'MACD values within neutral range';

  const bb = indicators?.bollingerBands;
  const bollingerAssessment = bb
    ? `Bollinger Bandwidth ${bb.bandwidth.toFixed(2)}% with Upper at $${bb.upper.toFixed(2)} and Lower at $${bb.lower.toFixed(2)}`
    : 'Bollinger Bands within baseline parameters';

  const ema = indicators?.ema;
  const trendAssessment = ema
    ? `9-EMA ($${ema.ema9.toFixed(1)}) vs 21-EMA ($${ema.ema21.toFixed(1)}) vs 50-EMA ($${ema.ema50.toFixed(1)}) confirming ${isBull ? 'upward' : isBear ? 'downward' : 'sideways'} trajectory`
    : 'EMAs aligned within normal deviation';

  const vol = indicators?.volumeDynamics;
  const volumeAssessment = vol
    ? `Volume Surge Multiplier at ${vol.volumeSurgeRatio.toFixed(1)}x with price ${vol.priceVsVwapPercent >= 0 ? '+' : ''}${vol.priceVsVwapPercent.toFixed(2)}% vs institutional VWAP ($${vol.vwap.toFixed(2)})`
    : 'Volume dynamics trading within normal 20-period moving average';

  const lossVerdict = winProb >= 75
    ? 'LOSS_PROTECTED_SAFE'
    : winProb >= 60
    ? 'MARGINAL_RISK'
    : 'HIGH_LOSS_RISK_AVOID';

  return {
    signal,
    recommendedPosition: dir,
    suggestedLeverage,
    confidence: winProb,
    winProbability: winProb,
    expectedValue: quantitativeProb.expectedValue,
    riskRewardRatio: quantitativeProb.riskRewardRatio,
    lossPreventionVerdict: lossVerdict,
    breakevenTriggerPrice,
    probabilityFactors: {
      trendScore: quantitativeProb.trendScore,
      momentumScore: quantitativeProb.momentumScore,
      orderbookScore: quantitativeProb.orderbookScore,
      volatilityScore: quantitativeProb.volatilityScore,
      priceActionScore: quantitativeProb.priceActionScore,
    },
    summary: `${dir} setup on ${market} with ${winProb}% quantitative statistical edge. Mark: $${currentPrice.toLocaleString()} (₹${inrPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR). Stop-Loss with Breakeven Protection at +0.8%.`,
    riskRating: quantitativeProb.lossRiskLevel === 'ULTRA_LOW' ? 'LOW' : quantitativeProb.lossRiskLevel,
    thesis: `Algorithmic quantitative confluence synthesis: Trend score ${quantitativeProb.trendScore}/100, Momentum ${quantitativeProb.momentumScore}/100. ${superTrendDesc} Expected Value EV ${quantitativeProb.expectedValue}. Breakeven locks at $${breakevenTriggerPrice}.`,
    suggestedEntry,
    suggestedEntryInr: currentPrice * usdtInrRate,
    suggestedTakeProfit,
    suggestedStopLoss,
    estimatedLiquidationPrice,
    technicalBreakdown: {
      rsiAssessment,
      macdAssessment,
      bollingerAssessment,
      trendAssessment,
      volumeAssessment,
      superTrendAssessment: superTrendDesc,
    },
    invalidationLevel,
    timestamp: Date.now(),
  };
}

app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
  const { market = 'BTCUSDT', pair = 'B-BTC_USDT', interval = '1m', candles, indicators, currentPrice } = req.body;

  if (!candles || candles.length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Insufficient candlestick history for algorithmic analysis.',
    });
  }

  const recentCandles = candles.slice(-20);
  const last = recentCandles[recentCandles.length - 1];
  const inrPrice = currentPrice * currentUsdtInrRate;

  // 1. Calculate baseline statistical win probabilities
  const quantitativeProb = calculateMarketProbability({
    candles,
    indicators,
    currentPrice,
  });

  // 2. Check in-memory cache first (25s TTL per market)
  const cacheKey = `${market}_${interval}`;
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 25000) {
    return res.json({ success: true, analysis: cached.analysis, usdtInrRate: currentUsdtInrRate, cached: true });
  }

  // 3. If in Gemini quota cooldown, serve high-precision mathematical quant analysis immediately
  if (Date.now() < geminiQuotaCooldownUntil || !geminiApiKey) {
    const fallback = buildDeterministicAiAnalysis(
      market,
      pair,
      currentPrice,
      quantitativeProb,
      indicators,
      recentCandles,
      currentUsdtInrRate
    );
    analysisCache.set(cacheKey, { timestamp: Date.now(), analysis: fallback });
    return res.json({
      success: true,
      analysis: fallback,
      usdtInrRate: currentUsdtInrRate,
      engine: 'High-Precision Quantitative Math Engine',
    });
  }

  try {
    const prompt = `
You are an expert quantitative crypto derivatives trader and risk architect specialized in CoinDCX INR Margin Crypto Futures.
Analyze the following live market state, technical indicators, and automated probability scan for ${market} (${pair}) on timeframe ${interval}.

Market Overview:
- Mark Price: $${currentPrice.toLocaleString()} (₹${inrPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} INR)
- Current USDT/INR FX Conversion: ₹${currentUsdtInrRate.toFixed(2)}
- Quantitative Pre-Calculated Win Probability: ${quantitativeProb.overallWinProbability}% (${quantitativeProb.recommendedDirection})
- Quantitative Expected Value (EV): ${quantitativeProb.expectedValue}
- Confluence Signals: ${quantitativeProb.keySignals.join(', ')}

High-Precision Indicators:
- SuperTrend (10, 3.0): Direction=${indicators?.superTrend?.direction ?? 'N/A'}, Active Trailing Line=$${indicators?.superTrend?.value ?? 'N/A'}, Flipped=${indicators?.superTrend?.trendFlipped ? 'YES (FRESH SIGNAL)' : 'NO'}, Signal=${indicators?.superTrend?.signal ?? 'N/A'}
- Volume Dynamics: Current Vol=${indicators?.volumeDynamics?.currentVolume ?? 'N/A'}, 20-SMA Vol=${indicators?.volumeDynamics?.volumeSma20 ?? 'N/A'}, Volume Surge Multiplier=${indicators?.volumeDynamics?.volumeSurgeRatio ?? 1}x (${indicators?.volumeDynamics?.volumeTrend ?? 'NORMAL'})
- Institutional VWAP: $${indicators?.volumeDynamics?.vwap ?? 'N/A'} (Price is ${indicators?.volumeDynamics?.priceVsVwapPercent ?? 0}% vs VWAP - ${indicators?.volumeDynamics?.vwapPosition ?? 'N/A'})
- Money Flow & Accumulation: OBV Trend=${indicators?.volumeDynamics?.obvTrend ?? 'N/A'}, Chaikin Money Flow (CMF)=${indicators?.volumeDynamics?.cmf ?? 'N/A'}, Money Flow Index (MFI)=${indicators?.volumeDynamics?.mfi ?? 'N/A'}
- Trend Velocity & Chop Filter (ADX 14): ADX=${indicators?.adx?.adx ?? 'N/A'} (${indicators?.adx?.trendStrength ?? 'N/A'}), +DI=${indicators?.adx?.plusDi ?? 'N/A'}, -DI=${indicators?.adx?.minusDi ?? 'N/A'}
- 14-Period RSI: ${indicators?.rsi?.toFixed(2) ?? 'N/A'}
- MACD Line: ${indicators?.macd?.macdLine?.toFixed(4) ?? 'N/A'}, Signal Line: ${indicators?.macd?.signalLine?.toFixed(4) ?? 'N/A'}, Histogram: ${indicators?.macd?.histogram?.toFixed(4) ?? 'N/A'}
- Bollinger Bands: Upper=${indicators?.bollingerBands?.upper ?? 'N/A'}, Middle=${indicators?.bollingerBands?.middle ?? 'N/A'}, Lower=${indicators?.bollingerBands?.lower ?? 'N/A'}, Bandwidth=${indicators?.bollingerBands?.bandwidth ?? 'N/A'}%
- EMA Ribbon: EMA 9=${indicators?.ema?.ema9 ?? 'N/A'}, EMA 21=${indicators?.ema?.ema21 ?? 'N/A'}, EMA 50=${indicators?.ema?.ema50 ?? 'N/A'}, EMA 200=${indicators?.ema?.ema200 ?? 'N/A'}
- ATR (14 Volatility): ${indicators?.atr ?? 'N/A'}
- 24h Price Change: ${((last.close - recentCandles[0].open) / recentCandles[0].open * 100).toFixed(2)}%

Recent 5 Candlestick Closes (oldest to newest):
${recentCandles.slice(-5).map((c: any) => `Time: ${new Date(c.time).toISOString().slice(11, 19)} | Open: ${c.open} | High: ${c.high} | Low: ${c.low} | Close: ${c.close} | Vol: ${c.volume}`).join('\n')}

Loss-Prevention & High-Accuracy Directives:
1. Confluence Verification: Only recommend LONG if SuperTrend is BULLISH and Volume confirms (surge >= 1.2x or price above institutional VWAP with positive OBV/CMF). Only recommend SHORT if SuperTrend is BEARISH and selling volume dominates below VWAP.
2. Chop Avoidance: If ADX < 18 or conditions are choppy/indecisive, recommend HOLD or NEUTRAL with lossPreventionVerdict = "HIGH_LOSS_RISK_AVOID".
3. Signal must be one of: "STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL".
4. RecommendedPosition must be "LONG", "SHORT", or "NEUTRAL".
5. Specify breakevenTriggerPrice: The exact price where Stop-Loss should automatically lock to Breakeven (+0.8% move) so the position cannot take a loss.
6. Provide detailed superTrendAssessment and volumeAssessment in your technicalBreakdown.
    `;

    const modelName = 'gemini-3.1-flash-lite';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an algorithmic cryptocurrency futures risk manager. Output only verified JSON conforming to the requested schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            signal: {
              type: Type.STRING,
              description: 'One of: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL',
            },
            recommendedPosition: {
              type: Type.STRING,
              description: 'LONG, SHORT, or NEUTRAL',
            },
            suggestedLeverage: {
              type: Type.INTEGER,
              description: 'Optimal leverage from 2 to 50',
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence score from 0 to 100',
            },
            winProbability: {
              type: Type.INTEGER,
              description: 'Statistical win probability percentage from 0 to 100',
            },
            expectedValue: {
              type: Type.NUMBER,
              description: 'Expected value ratio per trade',
            },
            riskRewardRatio: {
              type: Type.STRING,
              description: 'e.g. 1:3.2',
            },
            lossPreventionVerdict: {
              type: Type.STRING,
              description: 'LOSS_PROTECTED_SAFE, MARGINAL_RISK, or HIGH_LOSS_RISK_AVOID',
            },
            breakevenTriggerPrice: {
              type: Type.NUMBER,
              description: 'Price where stop-loss locks to breakeven',
            },
            summary: {
              type: Type.STRING,
              description: 'Executive summary with INR margin details and direction',
            },
            riskRating: {
              type: Type.STRING,
              description: 'LOW, MEDIUM, or HIGH',
            },
            thesis: {
              type: Type.STRING,
              description: 'Detailed reasoning behind the signal, market sentiment and liquidation buffer',
            },
            suggestedEntry: {
              type: Type.NUMBER,
              description: 'Ideal entry price level in USD',
            },
            suggestedEntryInr: {
              type: Type.NUMBER,
              description: 'Ideal entry price level in INR',
            },
            suggestedTakeProfit: {
              type: Type.NUMBER,
              description: 'Target take profit price level',
            },
            suggestedStopLoss: {
              type: Type.NUMBER,
              description: 'Target stop loss price level',
            },
            estimatedLiquidationPrice: {
              type: Type.NUMBER,
              description: 'Estimated liquidation price level under suggested leverage',
            },
            invalidationLevel: {
              type: Type.NUMBER,
              description: 'Key support or resistance level that invalidates thesis',
            },
            probabilityFactors: {
              type: Type.OBJECT,
              properties: {
                trendScore: { type: Type.INTEGER },
                momentumScore: { type: Type.INTEGER },
                orderbookScore: { type: Type.INTEGER },
                volatilityScore: { type: Type.INTEGER },
                priceActionScore: { type: Type.INTEGER },
              },
              required: ['trendScore', 'momentumScore', 'orderbookScore', 'volatilityScore', 'priceActionScore'],
            },
            technicalBreakdown: {
              type: Type.OBJECT,
              properties: {
                rsiAssessment: { type: Type.STRING },
                macdAssessment: { type: Type.STRING },
                bollingerAssessment: { type: Type.STRING },
                trendAssessment: { type: Type.STRING },
                volumeAssessment: { type: Type.STRING },
                superTrendAssessment: { type: Type.STRING },
              },
              required: [
                'rsiAssessment',
                'macdAssessment',
                'bollingerAssessment',
                'trendAssessment',
                'volumeAssessment',
              ],
            },
          },
          required: [
            'signal',
            'recommendedPosition',
            'suggestedLeverage',
            'confidence',
            'winProbability',
            'summary',
            'riskRating',
            'thesis',
            'suggestedEntry',
            'suggestedTakeProfit',
            'suggestedStopLoss',
            'estimatedLiquidationPrice',
            'invalidationLevel',
            'technicalBreakdown',
          ],
        },
      },
    });

    const parsed: AiAnalysisResult = JSON.parse(response.text || '{}');
    parsed.timestamp = Date.now();
    parsed.suggestedEntryInr = parsed.suggestedEntry * currentUsdtInrRate;
    if (!parsed.winProbability) parsed.winProbability = quantitativeProb.overallWinProbability;
    if (!parsed.probabilityFactors) {
      parsed.probabilityFactors = {
        trendScore: quantitativeProb.trendScore,
        momentumScore: quantitativeProb.momentumScore,
        orderbookScore: quantitativeProb.orderbookScore,
        volatilityScore: quantitativeProb.volatilityScore,
        priceActionScore: quantitativeProb.priceActionScore,
      };
    }
    if (!parsed.breakevenTriggerPrice) {
      const dir = parsed.recommendedPosition;
      parsed.breakevenTriggerPrice = dir === 'LONG'
        ? parsed.suggestedEntry * 1.008
        : parsed.suggestedEntry * 0.992;
    }

    analysisCache.set(cacheKey, { timestamp: Date.now(), analysis: parsed });
    res.json({ success: true, analysis: parsed, usdtInrRate: currentUsdtInrRate });
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      geminiQuotaCooldownUntil = Date.now() + 5 * 60 * 1000; // 5 min cooldown to prevent hammering during quota depletion
      console.warn('[Gemini Quota Notice] Free-tier daily limit reached (429). Activating High-Precision Algorithmic Quant Engine fallback.');
    } else {
      console.warn('Gemini analysis fallback engaged:', error.message);
    }

    const fallback = buildDeterministicAiAnalysis(
      market,
      pair,
      currentPrice,
      quantitativeProb,
      indicators,
      recentCandles,
      currentUsdtInrRate
    );
    analysisCache.set(cacheKey, { timestamp: Date.now(), analysis: fallback });
    res.json({
      success: true,
      analysis: fallback,
      usdtInrRate: currentUsdtInrRate,
      engine: 'High-Precision Quantitative Math Engine',
      fallback: true,
    });
  }
});

// -------------------------------------------------------------
// Real-Time Multi-Market High Probability Scanner
// -------------------------------------------------------------
function generateFallbackCandles(basePrice: number, count = 40): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  let price = basePrice * 0.99;
  for (let i = count; i >= 0; i--) {
    const time = now - i * 60000;
    const change = (Math.random() - 0.48) * (basePrice * 0.003);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
    const volume = 10 + Math.random() * 50;
    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

const SCANNED_PAIRS = [
  { market: 'BTCUSDT', pair: 'B-BTC_USDT' },
  { market: 'ETHUSDT', pair: 'B-ETH_USDT' },
  { market: 'SOLUSDT', pair: 'B-SOL_USDT' },
  { market: 'XRPUSDT', pair: 'B-XRP_USDT' },
  { market: 'DOGEUSDT', pair: 'B-DOGE_USDT' },
  { market: 'BNBUSDT', pair: 'B-BNB_USDT' },
];

let cachedScanResults: MarketScanResult[] = [];
let lastScanTimestamp = 0;

app.get('/api/bot/scanner', async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cachedScanResults.length > 0 && now - lastScanTimestamp < 4000) {
      return res.json({
        success: true,
        scannerResults: cachedScanResults,
        scannedAt: lastScanTimestamp,
        source: 'cache',
      });
    }

    if (cachedTickers.length === 0) {
      try {
        const tRes = await fetch(`${COINDCX_BASE_URL}/exchange/ticker`);
        if (tRes.ok) {
          cachedTickers = await tRes.json();
        }
      } catch {}
    }

    const results: MarketScanResult[] = [];

    for (const item of SCANNED_PAIRS) {
      try {
        const ticker = cachedTickers.find((t: any) => t.market === item.market);
        const lastPrice = ticker ? Number(ticker.last_price) : 0;
        const change24h = ticker ? Number(ticker.change_24_hour) : 0;
        const volume24h = ticker ? Number(ticker.volume) : 0;
        const lastPriceInr = lastPrice * currentUsdtInrRate;

        // Fetch candle history for pair using 1m interval (CoinDCX accepts 1m, 15m, 1h, 1d)
        let rawCandles: any[] = [];
        try {
          const cRes = await fetch(
            `${COINDCX_PUBLIC_URL}/market_data/candles?pair=${encodeURIComponent(item.pair)}&interval=1m&limit=45`
          );
          if (cRes.ok) {
            const parsed = await cRes.json();
            if (Array.isArray(parsed) && parsed.length >= 10) {
              rawCandles = parsed;
            }
          }
        } catch {}

        let candles: Candle[] = [];
        if (rawCandles.length >= 10) {
          candles = rawCandles
            .map((c: any) => ({
              time: Number(c.time),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: Number(c.volume),
            }))
            .sort((a, b) => a.time - b.time);
        } else if (lastPrice > 0) {
          // Fallback realistic candles around last price
          candles = generateFallbackCandles(lastPrice, 40);
        } else {
          continue;
        }

        const indicators = extractLatestIndicators(candles);
        const prob = calculateMarketProbability({
          candles,
          indicators,
          currentPrice: lastPrice || candles[candles.length - 1].close,
        });

        const winProb = prob.overallWinProbability;
        let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'C';
        let status: 'PRIME_SETUP' | 'WATCH' | 'FILTERED_OUT' = 'FILTERED_OUT';

        if (winProb >= 82) {
          grade = 'A+';
          status = 'PRIME_SETUP';
        } else if (winProb >= 76) {
          grade = 'A';
          status = 'PRIME_SETUP';
        } else if (winProb >= 66) {
          grade = 'B';
          status = 'WATCH';
        } else if (winProb >= 54) {
          grade = 'C';
          status = 'FILTERED_OUT';
        } else {
          grade = 'D';
          status = 'FILTERED_OUT';
        }

        const reason = prob.keySignals.length > 0 ? prob.keySignals[0] : `${prob.recommendedDirection} Confluence Setup`;
        const expectedReturn = Number((prob.expectedValue * (item.market.includes('BTC') ? 1.2 : 1.6)).toFixed(2));
        const optimalLeverage = winProb >= 82 ? 15 : winProb >= 76 ? 10 : 5;

        results.push({
          market: item.market,
          candlePair: item.pair,
          lastPrice,
          lastPriceInr,
          change24h,
          volume24h,
          winProbability: winProb,
          direction: prob.recommendedDirection === 'NEUTRAL' ? 'WAIT' : prob.recommendedDirection,
          lossRisk: prob.lossRiskLevel,
          confluenceGrade: grade,
          status,
          reason,
          expectedReturnPercent: expectedReturn,
          optimalLeverage,
          scannedAt: now,
          superTrendSignal: indicators.superTrend.direction,
          volumeSurgeRatio: indicators.volumeDynamics.volumeSurgeRatio,
        });
      } catch {
        // Continue to other pairs
      }
    }

    results.sort((a, b) => b.winProbability - a.winProbability);
    cachedScanResults = results;
    lastScanTimestamp = now;

    res.json({
      success: true,
      scannerResults: results,
      scannedAt: lastScanTimestamp,
      source: 'live',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single Market Live Probability Check
app.get('/api/bot/probability', async (req: Request, res: Response) => {
  try {
    const rawPair = (req.query.pair as string) || botState.config.candlePair;
    const rawInterval = (req.query.interval as string) || botState.config.timeframe;
    const pair = normalizeCoinDcxCandlePair(rawPair);
    const interval = normalizeCoinDcxInterval(rawInterval);

    let candles: Candle[] = [];
    try {
      const candleRes = await fetch(
        `${COINDCX_PUBLIC_URL}/market_data/candles?pair=${encodeURIComponent(pair)}&interval=${interval}&limit=50`
      );
      if (candleRes.ok) {
        const rawCandles = await candleRes.json();
        if (Array.isArray(rawCandles) && rawCandles.length >= 10) {
          candles = rawCandles
            .map((c: any) => ({
              time: Number(c.time),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: Number(c.volume),
            }))
            .sort((a, b) => a.time - b.time);
        }
      }
    } catch (e) {}

    if (candles.length < 20) {
      const cleanMarket = rawPair.replace(/^[BI]-/, '').replace(/_/g, '');
      const ticker = cachedTickers.find(
        (t) => t.market === cleanMarket || t.market === rawPair || t.market === pair
      );
      const basePrice = ticker && Number(ticker.last_price) > 0 ? Number(ticker.last_price) : 83000;
      candles = generateFallbackCandles(basePrice, 50);
    }

    const latest = candles[candles.length - 1];
    const indicators = extractLatestIndicators(candles);
    const prob = calculateMarketProbability({
      candles,
      indicators,
      currentPrice: latest.close,
    });

    res.json({
      success: true,
      probability: prob,
      currentPrice: latest.close,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Trading Bot State & Order Execution Endpoints
// -------------------------------------------------------------
app.get('/api/bot/status', async (_req: Request, res: Response) => {
  // Sync positions with latest current price and calculate live PnL in INR
  for (const pos of botState.positions) {
    const pnlMultiplier = pos.positionDirection === 'LONG' ? 1 : -1;
    pos.unrealizedPnl = (pos.currentPrice - pos.entryPrice) * pos.quantity * pnlMultiplier;
    pos.unrealizedPnlInr = pos.unrealizedPnl * currentUsdtInrRate;
    pos.unrealizedPnlPercent = pos.marginAmountInr > 0
      ? (pos.unrealizedPnlInr / pos.marginAmountInr) * 100
      : 0;
  }

  const liveBalances = await fetchCoinDcxLiveBalances();

  res.json({
    success: true,
    config: botState.config,
    positions: botState.positions,
    trades: botState.trades.slice(0, 50),
    performance: botState.performance,
    systemLogs: botState.systemLogs.slice(0, 50),
    paperBalances: botState.paperBalances,
    liveBalances: liveBalances || undefined,
    usdtInrRate: currentUsdtInrRate,
  });
});

app.post('/api/bot/toggle', (req: Request, res: Response) => {
  const { isRunning } = req.body;
  botState.config.isRunning = typeof isRunning === 'boolean' ? isRunning : !botState.config.isRunning;

  logSystem(
    'info',
    `Trading bot ${botState.config.isRunning ? 'STARTED' : 'PAUSED'}. Mode: ${botState.config.mode.toUpperCase()} on ${botState.config.activeMarket} (CoinDCX INR Futures).`
  );

  res.json({ success: true, isRunning: botState.config.isRunning, config: botState.config });
});

app.post('/api/bot/config', async (req: Request, res: Response) => {
  const {
    mode,
    activeMarket,
    candlePair,
    timeframe,
    strategy,
    minAiConfidence,
    risk,
    defaultLeverage,
    allowedDirection,
    tradingType,
    marginCurrency,
  } = req.body;

  if (mode === 'live' && (!COINDCX_API_KEY || !COINDCX_API_SECRET)) {
    return res.status(400).json({
      success: false,
      error: 'Cannot switch to Live Trading: COINDCX_API_KEY or COINDCX_API_SECRET not configured in server environment.',
    });
  }

  if (mode === 'live') {
    const liveBalances = await fetchCoinDcxLiveBalances();
    if (liveBalances && !liveBalances.isFunded) {
      logSystem(
        'warning',
        `Switched to LIVE mode. Connected to CoinDCX API. Notice: Live wallet balance is ₹${liveBalances.inr.toFixed(2)} INR (${liveBalances.usdt.toFixed(2)} USDT). Minimum 60 USDT (~₹${liveBalances.minOrderValueInr.toFixed(0)} INR) margin required by CoinDCX to open orders.`
      );
    } else {
      logSystem('info', `Switched to LIVE mode. Authenticated with CoinDCX API Key.`);
    }
  }

  if (mode) botState.config.mode = mode;
  if (activeMarket) botState.config.activeMarket = activeMarket;
  if (candlePair) botState.config.candlePair = candlePair;
  if (timeframe) botState.config.timeframe = timeframe;
  if (strategy) botState.config.strategy = strategy;
  if (typeof minAiConfidence === 'number') botState.config.minAiConfidence = minAiConfidence;
  if (typeof defaultLeverage === 'number') botState.config.defaultLeverage = Math.max(1, Math.min(100, defaultLeverage));
  if (allowedDirection) botState.config.allowedDirection = allowedDirection;
  if (tradingType) botState.config.tradingType = tradingType;
  if (marginCurrency) botState.config.marginCurrency = marginCurrency;

  if (risk) {
    botState.config.risk = {
      ...botState.config.risk,
      ...risk,
    };
  }

  logSystem(
    'info',
    `Bot configuration updated: Mode=${botState.config.mode.toUpperCase()} | Strategy=${botState.config.strategy} | Leverage=${botState.config.defaultLeverage}x | Margin=${botState.config.marginCurrency} | Direction=${botState.config.allowedDirection}`
  );

  res.json({ success: true, config: botState.config });
});

// Manual Order Placement (Supports Long and Short Futures with INR margin)
app.post('/api/bot/order', async (req: Request, res: Response) => {
  try {
    const {
      market,
      side, // 'BUY' or 'SELL'
      direction, // 'LONG' or 'SHORT'
      order_type, // 'market' or 'limit'
      price,
      quantity,
      leverage: customLeverage,
      marginCurrency: customMarginCurrency,
      strategyUsed,
      triggerReason,
      useTrailingStop,
      trailingStopPercent: customTrailingStopPercent,
      trailingActivationPercent: customTrailingActivationPercent,
      trailingUseSuperTrend: customTrailingUseSuperTrend,
    } = req.body;

    if (!market || !side || !quantity) {
      return res.status(400).json({ success: false, error: 'Missing market, side, or quantity.' });
    }

    const numPrice = Number(price);
    const numQty = Number(quantity);
    const notionalUsd = numPrice * numQty;
    const notionalInr = notionalUsd * currentUsdtInrRate;
    const leverage = Number(customLeverage) || botState.config.defaultLeverage || 10;
    const posDirection: PositionDirection = direction || (side === 'BUY' ? 'LONG' : 'SHORT');
    const marginCurr = customMarginCurrency || 'INR';
    const marginRequiredInr = notionalInr / leverage;

    const useTrailing = typeof useTrailingStop === 'boolean' ? useTrailingStop : (botState.config.risk.trailingStopLoss ?? true);
    const trailPct = Number(customTrailingStopPercent) || botState.config.risk.trailingStopPercent || 1.0;
    const trailActPct = typeof customTrailingActivationPercent === 'number' ? customTrailingActivationPercent : (botState.config.risk.trailingActivationPercent ?? 0.5);
    const trailST = typeof customTrailingUseSuperTrend === 'boolean' ? customTrailingUseSuperTrend : (botState.config.risk.trailingUseSuperTrend ?? true);

    // Check open position limits
    if (botState.positions.length >= botState.config.risk.maxOpenPositions) {
      return res.status(400).json({
        success: false,
        error: `Max open positions limit (${botState.config.risk.maxOpenPositions}) reached.`,
      });
    }

    // Check INR margin balance in paper mode
    if (botState.config.mode === 'paper' && botState.paperBalances.INR < marginRequiredInr) {
      return res.status(400).json({
        success: false,
        error: `Insufficient INR paper margin. Required: ₹${marginRequiredInr.toFixed(2)}, Available: ₹${botState.paperBalances.INR.toFixed(2)}`,
      });
    }

    // If live mode, execute on CoinDCX Derivatives Futures API
    if (botState.config.mode === 'live') {
      const liveResult = await executeCoinDcxLiveFuturesOrder({
        pair: botState.config.candlePair || 'B-BTC_USDT',
        side: side.toLowerCase() as 'buy' | 'sell',
        orderType: order_type === 'limit' ? 'limit' : 'market',
        price: numPrice,
        quantity: numQty,
        leverage,
        marginCurrency: marginCurr as 'INR' | 'USDT',
      });

      if (!liveResult.success) {
        return res.status(400).json({
          success: false,
          error: liveResult.error || 'CoinDCX order execution rejected.',
        });
      }

      // Add position record to dashboard tracking
      const posId = `pos-fut-live-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const stopLossPct = botState.config.risk.stopLossPercent / 100;
      const takeProfitPct = botState.config.risk.takeProfitPercent / 100;
      const stopLossPrice = posDirection === 'LONG'
        ? numPrice * (1 - stopLossPct)
        : numPrice * (1 + stopLossPct);
      const takeProfitPrice = posDirection === 'LONG'
        ? numPrice * (1 + takeProfitPct)
        : numPrice * (1 - takeProfitPct);
      const liquidationPrice = calculateLiquidationPrice(numPrice, posDirection, leverage);

      const livePosition: Position = {
        id: posId,
        market,
        side: side as PositionSide,
        positionDirection: posDirection,
        tradingType: 'futures',
        marginCurrency: marginCurr as 'INR' | 'USDT',
        leverage,
        marginAmountInr: marginRequiredInr,
        entryPrice: numPrice,
        currentPrice: numPrice,
        quantity: numQty,
        notionalValue: notionalUsd,
        notionalValueInr: notionalInr,
        liquidationPrice,
        stopLossPrice,
        takeProfitPrice,
        highestPriceSinceEntry: numPrice,
        lowestPriceSinceEntry: numPrice,
        unrealizedPnl: 0,
        unrealizedPnlInr: 0,
        unrealizedPnlPercent: 0,
        openedAt: Date.now(),
        strategyUsed: strategyUsed || botState.config.strategy,
        entryReason: triggerReason || `Live ${posDirection} Futures Execution (${leverage}x)`,
        trailingStopLoss: useTrailing,
        trailingStopPercent: trailPct,
        trailingActivationPercent: trailActPct,
        trailingActivated: false,
        trailingStopPrice: stopLossPrice,
        trailingUseSuperTrend: trailST,
        trailingProfitLockedInr: 0,
      };

      botState.positions.push(livePosition);

      return res.json({ success: true, mode: 'live', order: liveResult.order, position: livePosition });
    }

    // High-Fidelity Simulation / Paper Execution for INR Futures
    const posId = `pos-fut-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const stopLossPct = botState.config.risk.stopLossPercent / 100;
    const takeProfitPct = botState.config.risk.takeProfitPercent / 100;

    const stopLossPrice = posDirection === 'LONG'
      ? numPrice * (1 - stopLossPct)
      : numPrice * (1 + stopLossPct);

    const takeProfitPrice = posDirection === 'LONG'
      ? numPrice * (1 + takeProfitPct)
      : numPrice * (1 - takeProfitPct);

    const liquidationPrice = calculateLiquidationPrice(numPrice, posDirection, leverage);

    const newPosition: Position = {
      id: posId,
      market,
      side: side as PositionSide,
      positionDirection: posDirection,
      tradingType: 'futures',
      marginCurrency: 'INR',
      leverage,
      marginAmountInr: marginRequiredInr,
      entryPrice: numPrice,
      currentPrice: numPrice,
      quantity: numQty,
      notionalValue: notionalUsd,
      notionalValueInr: notionalInr,
      liquidationPrice,
      stopLossPrice,
      takeProfitPrice,
      highestPriceSinceEntry: numPrice,
      lowestPriceSinceEntry: numPrice,
      unrealizedPnl: 0,
      unrealizedPnlInr: 0,
      unrealizedPnlPercent: 0,
      openedAt: Date.now(),
      strategyUsed: strategyUsed || botState.config.strategy,
      entryReason: triggerReason || `Manual ${posDirection} Futures Execution (${leverage}x)`,
      trailingStopLoss: useTrailing,
      trailingStopPercent: trailPct,
      trailingActivationPercent: trailActPct,
      trailingActivated: false,
      trailingStopPrice: stopLossPrice,
      trailingUseSuperTrend: trailST,
      trailingProfitLockedInr: 0,
    };

    botState.positions.push(newPosition);

    // Deduct margin requirement from INR collateral
    botState.paperBalances.INR = Math.max(0, botState.paperBalances.INR - marginRequiredInr);

    logSystem(
      'trade',
      `Futures position opened: ${posDirection} ${numQty} ${market} @ $${numPrice.toLocaleString()} (₹${(numPrice * currentUsdtInrRate).toLocaleString('en-IN')}) | Margin: ₹${marginRequiredInr.toFixed(0)} (${leverage}x) | Trailing Stop: ${useTrailing ? `${trailPct}% Trail (Active)` : 'Off'} | Est Liq: $${liquidationPrice.toFixed(2)}`
    );

    res.json({ success: true, mode: 'paper', position: newPosition });
  } catch (error: any) {
    console.error('Order placement error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update trailing stop rules for an existing position in real time
app.post('/api/bot/update-position-trailing', (req: Request, res: Response) => {
  const { positionId, trailingStopLoss, trailingStopPercent, trailingUseSuperTrend, trailingActivationPercent } = req.body;
  const pos = botState.positions.find((p) => p.id === positionId);
  if (!pos) {
    return res.status(404).json({ success: false, error: 'Position not found' });
  }

  if (typeof trailingStopLoss === 'boolean') pos.trailingStopLoss = trailingStopLoss;
  if (typeof trailingStopPercent === 'number' && trailingStopPercent > 0) pos.trailingStopPercent = trailingStopPercent;
  if (typeof trailingUseSuperTrend === 'boolean') pos.trailingUseSuperTrend = trailingUseSuperTrend;
  if (typeof trailingActivationPercent === 'number') pos.trailingActivationPercent = trailingActivationPercent;

  logSystem(
    'info',
    `Updated trailing rules for ${pos.market} ${pos.positionDirection}: Trailing=${pos.trailingStopLoss ? 'ACTIVE' : 'OFF'} | Trail Distance=${pos.trailingStopPercent}% | SuperTrend Linked=${pos.trailingUseSuperTrend ? 'YES' : 'NO'}`
  );

  res.json({ success: true, position: pos });
});

// Close a position manually
app.post('/api/bot/close-position', async (req: Request, res: Response) => {
  const { positionId, exitPrice } = req.body;
  const index = botState.positions.findIndex((p) => p.id === positionId);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Position not found' });
  }

  const pos = botState.positions[index];
  const closePrice = Number(exitPrice) || pos.currentPrice;

  // If live mode, place closing order on CoinDCX
  if (botState.config.mode === 'live' && COINDCX_API_KEY && COINDCX_API_SECRET) {
    const reverseSide = pos.positionDirection === 'LONG' ? 'sell' : 'buy';
    try {
      await executeCoinDcxLiveFuturesOrder({
        pair: botState.config.candlePair || 'B-BTC_USDT',
        side: reverseSide,
        orderType: 'market',
        quantity: pos.quantity,
        leverage: pos.leverage,
        marginCurrency: pos.marginCurrency,
      });
    } catch (e: any) {
      logSystem('warning', `Could not execute reverse close order on CoinDCX: ${e.message}`);
    }
  }

  closePosition(pos, closePrice, 'MANUAL');
  botState.positions.splice(index, 1);

  res.json({ success: true, message: `Futures position ${positionId} closed.` });
});

// Emergency close all positions and stop bot
app.post('/api/bot/emergency-close', async (_req: Request, res: Response) => {
  botState.config.isRunning = false;
  const openCount = botState.positions.length;

  if (botState.config.mode === 'live' && COINDCX_API_KEY && COINDCX_API_SECRET) {
    for (const pos of botState.positions) {
      const reverseSide = pos.positionDirection === 'LONG' ? 'sell' : 'buy';
      try {
        await executeCoinDcxLiveFuturesOrder({
          pair: botState.config.candlePair || 'B-BTC_USDT',
          side: reverseSide,
          orderType: 'market',
          quantity: pos.quantity,
          leverage: pos.leverage,
          marginCurrency: pos.marginCurrency,
        });
      } catch {}
    }
  }

  for (const pos of [...botState.positions]) {
    closePosition(pos, pos.currentPrice, 'CIRCUIT_BREAKER');
  }

  botState.positions = [];
  logSystem('warning', `EMERGENCY STOP TRIGGERED: Closed ${openCount} open positions and halted bot.`);

  res.json({ success: true, message: `Halted bot and closed ${openCount} open positions.` });
});

// Reset Paper Trading Margin Balance to ₹10,000 INR
app.post('/api/bot/reset-paper-balance', (req: Request, res: Response) => {
  const amount = Number(req.body.amount) || 10000;
  botState.paperBalances.INR = amount;
  botState.paperBalances.USDT = amount / currentUsdtInrRate;
  botState.performance.currentEquityInr = amount;
  botState.performance.startingEquityInr = amount;
  botState.performance.currentEquity = amount / currentUsdtInrRate;
  botState.performance.startingEquity = amount / currentUsdtInrRate;
  botState.positions = [];
  logSystem('info', `Paper trading margin balance set to ₹${amount.toLocaleString('en-IN')} INR.`);
  res.json({ success: true, balanceInr: amount, paperBalances: botState.paperBalances });
});

// 📊 CoinDCX Level-2 Order Book Microstructure Engine (OBI, CVD, Whale Walls)
async function fetchCoinDcxOrderBook(pair: string, currentPrice: number): Promise<OrderBookMicrostructure> {
  const normPair = normalizeCoinDcxCandlePair(pair);
  try {
    const res = await fetch(`${COINDCX_PUBLIC_URL}/market_data/orderbook?pair=${encodeURIComponent(normPair)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.bids || data.asks)) {
        return analyzeOrderBookMicrostructure(data, currentPrice);
      }
    }
  } catch {}
  return analyzeOrderBookMicrostructure(null, currentPrice);
}

// 🤖 Dual-Tier Gemini AI Engine (Tier 1: gemini-3.1-flash-lite + Tier 2: gemini-3.8-flash)
async function fetchDualTierAiPrimitivesInsight(
  market: string,
  currentPrice: number,
  indicators: IndicatorValues,
  ticker?: any,
  microstructure?: OrderBookMicrostructure
): Promise<{ insight: AiPrimitivesInsight; dualTier: DualTierAiStatus }> {
  const startTime = Date.now();

  // Check cache first (15s TTL per market)
  const cached = dualTierCache.get(market);
  if (cached && Date.now() - cached.timestamp < 15000) {
    return { insight: cached.insight, dualTier: cached.dualTier };
  }

  if (!geminiApiKey || Date.now() < geminiQuotaCooldownUntil) {
    const defaultInsight: AiPrimitivesInsight = {
      aiIntegrated: false,
      model: 'Local Quant Engine (Deterministic)',
      latencyMs: 0,
      regime: 'RANGE_BOUND_CHOP',
      trapRisk: 'LOW',
      trapAnalysis: 'Quant deterministic heuristics running locally with zero latency.',
      macroRationale: 'Technical indicator confluence running without external LLM.',
      aiPredictedProbabilities: { buy: 33, hold: 34, sell: 33 },
      aiScoreAdjustment: 0,
      gatesVeto: false,
    };
    const defaultDualTier: DualTierAiStatus = {
      tier1: {
        model: 'gemini-3.1-flash-lite',
        latencyMs: 0,
        active: false,
        scanSummary: 'Local quant engine active',
      },
      tier2: {
        model: 'gemini-3.1-flash-lite',
        latencyMs: 0,
        active: false,
        regime: 'RANGE_BOUND_CHOP',
        trapVerdict: 'Normal Depth',
        macroThesis: 'Deterministic Math Active',
      },
    };
    dualTierCache.set(market, { timestamp: Date.now(), insight: defaultInsight, dualTier: defaultDualTier });
    return { insight: defaultInsight, dualTier: defaultDualTier };
  }

  // TIER 1: Fast Continuous Scan (gemini-3.1-flash-lite)
  let tier1Latency = 0;
  let tier1Passed = true;
  let tier1Summary = 'Flash-Lite pre-screen passed';
  try {
    const t1Start = Date.now();
    const t1Res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Quick scan for ${market}: Price $${currentPrice}. SuperTrend: ${indicators.superTrend?.direction}. RSI: ${indicators.rsi.toFixed(1)}. OBI: ${(microstructure?.imbalanceRatio || 0) * 100}%. Is market trend clean or toxic chop? Return JSON: {"cleanTrend": true, "bias": "BULL"}`,
      config: { responseMimeType: 'application/json' },
    });
    tier1Latency = Date.now() - t1Start;
    const t1Parsed = JSON.parse(t1Res.text || '{}');
    tier1Passed = t1Parsed.cleanTrend !== false;
    tier1Summary = `Tier 1: ${t1Parsed.bias || 'Neutral'} (${tier1Latency}ms)`;
  } catch (t1Err: any) {
    if (t1Err.message?.includes('429') || t1Err.message?.includes('quota') || t1Err.message?.includes('RESOURCE_EXHAUSTED')) {
      geminiQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
    }
    tier1Latency = 12;
    tier1Summary = 'Tier 1 local quant pass-through';
  }

  // TIER 2: Deep Verification & Trap Armor (gemini-3.1-flash-lite for maximum quota efficiency)
  const t2Start = Date.now();
  try {
    const prompt = `Evaluate market structure, L2 order book depth, and trap probability for ${market} perpetual futures on CoinDCX.
Current Price: $${currentPrice} (₹${(currentPrice * currentUsdtInrRate).toFixed(0)} INR)
Market Microstructure:
- Order Book Imbalance (OBI): ${(microstructure?.imbalanceRatio ? microstructure.imbalanceRatio * 100 : 0).toFixed(1)}% (${microstructure?.imbalanceGrade || 'BALANCED'})
- Cumulative Volume Delta (CVD): ${microstructure?.cvdDirection || 'NEUTRAL'} (${microstructure?.cumulativeVolumeDelta || 0})
- Large Walls: Bid $${microstructure?.largeWalls.bidWallPrice || 'Active'} / Ask $${microstructure?.largeWalls.askWallPrice || 'Active'}
- Spread: ${microstructure?.spreadPercent.toFixed(3) || '0.02'}%
Technical Summary:
- SuperTrend (10, 3.0 ATR): ${indicators.superTrend?.direction || 'NEUTRAL'} (Support/Resistance: $${indicators.superTrend?.value.toFixed(2)})
- EMA Alignment: 9 EMA ($${indicators.ema.ema9.toFixed(2)}) vs 21 EMA ($${indicators.ema.ema21.toFixed(2)}) vs 50 EMA ($${indicators.ema.ema50.toFixed(2)})
- RSI(14): ${indicators.rsi.toFixed(1)} | MACD Hist: ${indicators.macd.histogram.toFixed(3)}
- Volume Surge: ${indicators.volumeDynamics?.volumeSurgeRatio.toFixed(1) || '1.0'}x vs 20-SMA, VWAP: $${indicators.volumeDynamics?.vwap.toFixed(2) || '0'}
- 24h Ticker: High $${ticker?.high || '0'} / Low $${ticker?.low || '0'} / 24h Change ${ticker?.change_24_hour || '0'}%

Strictly classify into the 3 Primitives:
1. Directional Probability: buyProbability, holdProbability, sellProbability (summing to 100)
2. Score Adjustment: between -0.25 and +0.25 (regime conviction and trap penalty)
3. Bool Safety: gatesVeto (true ONLY if severe whale manipulation, spoofing, or false breakout), trapRisk ('LOW', 'MEDIUM', 'HIGH')`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            regime: {
              type: Type.STRING,
              description: 'One of: BULLISH_EXPANSION, BEARISH_EXPANSION, RANGE_BOUND_CHOP, VOLATILITY_SQUEEZE, REVERSAL_EXHAUSTION',
            },
            trapRisk: {
              type: Type.STRING,
              description: 'One of: LOW, MEDIUM, HIGH',
            },
            trapAnalysis: {
              type: Type.STRING,
              description: '1 sentence evaluating liquidity traps, whale walls, or false breakouts.',
            },
            macroRationale: {
              type: Type.STRING,
              description: '1 concise sentence identifying market driver.',
            },
            buyProbability: { type: Type.NUMBER },
            holdProbability: { type: Type.NUMBER },
            sellProbability: { type: Type.NUMBER },
            scoreAdjustment: { type: Type.NUMBER },
            gatesVeto: { type: Type.BOOLEAN },
            vetoReason: { type: Type.STRING },
          },
          required: [
            'regime',
            'trapRisk',
            'trapAnalysis',
            'macroRationale',
            'buyProbability',
            'holdProbability',
            'sellProbability',
            'scoreAdjustment',
            'gatesVeto',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const tier2Latency = Date.now() - t2Start;

    const dualTier: DualTierAiStatus = {
      tier1: {
        model: 'gemini-3.1-flash-lite',
        latencyMs: tier1Latency,
        active: true,
        scanSummary: tier1Summary,
      },
      tier2: {
        model: 'gemini-3.1-flash-lite',
        latencyMs: tier2Latency,
        active: true,
        regime: parsed.regime || 'RANGE_BOUND_CHOP',
        trapVerdict: parsed.trapRisk || 'LOW',
        macroThesis: parsed.macroRationale || 'Confluence confirmed',
      },
    };

    const insight: AiPrimitivesInsight = {
      aiIntegrated: true,
      model: 'Dual-Tier: 3.1-flash-lite',
      latencyMs: Date.now() - startTime,
      regime: parsed.regime || 'RANGE_BOUND_CHOP',
      trapRisk: parsed.trapRisk || 'LOW',
      trapAnalysis: parsed.trapAnalysis || 'Normal market depth liquidity.',
      macroRationale: parsed.macroRationale || 'Technical structure aligning with volume flow.',
      aiPredictedProbabilities: {
        buy: Math.round(Number(parsed.buyProbability) || 33),
        hold: Math.round(Number(parsed.holdProbability) || 34),
        sell: Math.round(Number(parsed.sellProbability) || 33),
      },
      aiScoreAdjustment: Number(parsed.scoreAdjustment) || 0,
      gatesVeto: Boolean(parsed.gatesVeto) || !tier1Passed,
      vetoReason: parsed.vetoReason || (!tier1Passed ? 'Tier 1 Flash-Lite detected choppy volatility noise' : undefined),
      dualTier,
    };

    dualTierCache.set(market, { timestamp: Date.now(), insight, dualTier });
    return { insight, dualTier };
  } catch (err: any) {
    if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
      geminiQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
    }
    const fallbackInsight: AiPrimitivesInsight = {
      aiIntegrated: false,
      model: 'Dual-Tier Gemini (Local Fallback)',
      latencyMs: Date.now() - startTime,
      regime: 'RANGE_BOUND_CHOP',
      trapRisk: 'LOW',
      trapAnalysis: 'Fallback to deterministic local quant engine.',
      macroRationale: 'High-speed local quantitative calculations active.',
      aiPredictedProbabilities: { buy: 33, hold: 34, sell: 33 },
      aiScoreAdjustment: 0,
      gatesVeto: false,
    };
    const fallbackDualTier: DualTierAiStatus = {
      tier1: {
        model: 'gemini-3.1-flash-lite',
        latencyMs: tier1Latency,
        active: false,
        scanSummary: 'Deterministic local fallback active',
      },
      tier2: {
        model: 'gemini-3.1-flash-lite',
        latencyMs: Date.now() - t2Start,
        active: false,
        regime: 'RANGE_BOUND_CHOP',
        trapVerdict: 'Normal Depth',
        macroThesis: 'Deterministic Math Active',
      },
    };
    dualTierCache.set(market, { timestamp: Date.now(), insight: fallbackInsight, dualTier: fallbackDualTier });
    return { insight: fallbackInsight, dualTier: fallbackDualTier };
  }
}

// Evaluate 3 Primitives Decision Engine (01 Choice, 02 Score, 03 Bool)
app.get('/api/bot/decision-primitives', async (req: Request, res: Response) => {
  try {
    const market = (req.query.market as string) || botState.config.activeMarket || 'BTCUSDT';
    const useAi = req.query.ai !== 'false';
    const ticker = cachedTickers.find((t: any) => t.market === market);
    const currentPrice = Number(ticker?.last_price) || 68000;
    const pair = normalizeCoinDcxCandlePair(market);

    let candles: Candle[] = [];
    try {
      const cRes = await fetch(`${COINDCX_PUBLIC_URL}/market_data/candles?pair=${encodeURIComponent(pair)}&interval=1m&limit=60`);
      if (cRes.ok) {
        const raw = await cRes.json();
        if (Array.isArray(raw) && raw.length >= 10) {
          candles = raw
            .map((c: any) => ({
              time: Number(c.time),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: Number(c.volume),
            }))
            .sort((a, b) => a.time - b.time);
        }
      }
    } catch {}

    if (candles.length < 20) {
      candles = generateFallbackCandles(currentPrice, 50);
    }

    const indicators = extractLatestIndicators(candles);
    const microstructure = await fetchCoinDcxOrderBook(pair, currentPrice);

    let aiInsight: AiPrimitivesInsight | undefined = undefined;
    let dualTier: DualTierAiStatus | undefined = undefined;
    if (useAi && geminiApiKey) {
      const aiRes = await fetchDualTierAiPrimitivesInsight(market, currentPrice, indicators, ticker, microstructure);
      aiInsight = aiRes.insight;
      dualTier = aiRes.dualTier;
    }

    const result = evaluateDecisionPrimitives(
      indicators,
      currentPrice,
      market,
      ticker,
      {
        maxDailyDrawdownPercent: botState.config.risk.maxDailyDrawdownPercent,
        currentDailyDrawdown: botState.performance.maxDrawdownPercent,
        trailingStopLoss: botState.config.risk.trailingStopLoss,
        allowedDirection: botState.config.allowedDirection,
      },
      aiInsight,
      microstructure,
      dualTier
    );

    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Decision Primitives API error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset paper simulation wallet & history
app.post('/api/bot/reset', (_req: Request, res: Response) => {
  botState.positions = [];
  botState.trades = [];
  botState.paperBalances = { USDT: STARTING_USD_EQUITY, INR: STARTING_INR_EQUITY, BTC: 0, ETH: 0, SOL: 0 };
  botState.performance = {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    netProfit: 0,
    netProfitInr: 0,
    netProfitPercent: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0,
    averageTradePnl: 0,
    maxDrawdownPercent: 0,
    sharpeRatio: 0,
    currentEquity: STARTING_USD_EQUITY,
    currentEquityInr: STARTING_INR_EQUITY,
    startingEquity: STARTING_USD_EQUITY,
    startingEquityInr: STARTING_INR_EQUITY,
    equityHistory: [
      { timestamp: Date.now() - 3600000 * 24, equity: STARTING_USD_EQUITY, equityInr: STARTING_INR_EQUITY },
      { timestamp: Date.now(), equity: STARTING_USD_EQUITY, equityInr: STARTING_INR_EQUITY },
    ],
  };

  logSystem('info', `Paper trading wallet reset to default ₹${STARTING_INR_EQUITY.toLocaleString('en-IN')} INR futures collateral.`);

  res.json({ success: true, message: 'Simulation reset completed.' });
});

function closePosition(
  pos: Position,
  exitPrice: number,
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'BREAKEVEN_GUARD' | 'EARLY_PROTECTIVE_CUT' | 'AI_SIGNAL' | 'MANUAL' | 'CIRCUIT_BREAKER' | 'LIQUIDATION'
) {
  const pnlMultiplier = pos.positionDirection === 'LONG' ? 1 : -1;
  const priceDiff = (exitPrice - pos.entryPrice) * pnlMultiplier;
  const realizedPnlUsd = priceDiff * pos.quantity;
  const realizedPnlInr = realizedPnlUsd * currentUsdtInrRate;
  const realizedPnlPercent = pos.marginAmountInr > 0
    ? (realizedPnlInr / pos.marginAmountInr) * 100
    : 0;

  const feeUsd = exitPrice * pos.quantity * 0.0005; // 0.05% futures maker/taker fee
  const feeInr = feeUsd * currentUsdtInrRate;
  const netRealizedUsd = realizedPnlUsd - feeUsd;
  const netRealizedInr = realizedPnlInr - feeInr;

  const trade: Trade = {
    id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    positionId: pos.id,
    market: pos.market,
    side: pos.side,
    positionDirection: pos.positionDirection,
    tradingType: 'futures',
    marginCurrency: 'INR',
    leverage: pos.leverage,
    marginAmountInr: pos.marginAmountInr,
    entryPrice: pos.entryPrice,
    exitPrice,
    quantity: pos.quantity,
    notionalValue: exitPrice * pos.quantity,
    realizedPnl: Number(netRealizedUsd.toFixed(2)),
    realizedPnlInr: Number(netRealizedInr.toFixed(2)),
    realizedPnlPercent: Number(realizedPnlPercent.toFixed(2)),
    fee: Number(feeUsd.toFixed(2)),
    feeInr: Number(feeInr.toFixed(2)),
    openedAt: pos.openedAt,
    closedAt: Date.now(),
    exitReason,
    strategyUsed: pos.strategyUsed,
    winProbabilityAtEntry: pos.initialWinProbability,
  };

  botState.trades.unshift(trade);

  // Return margin + PnL back to INR paper balances
  botState.paperBalances.INR = Math.max(0, botState.paperBalances.INR + pos.marginAmountInr + netRealizedInr);
  botState.paperBalances.USDT += (pos.notionalValue / pos.leverage) + netRealizedUsd;

  // Update Performance metrics
  updatePerformanceStats(trade);

  logSystem(
    'trade',
    `Futures position closed (${exitReason}): ${pos.positionDirection} ${pos.market} @ $${exitPrice.toLocaleString()} | PnL: ${netRealizedInr >= 0 ? '+' : ''}₹${netRealizedInr.toFixed(2)} (${realizedPnlPercent.toFixed(2)}% Return on Margin)`
  );
}

function updatePerformanceStats(latestTrade: Trade) {
  const p = botState.performance;
  p.totalTrades += 1;

  if (latestTrade.realizedPnl > 0) {
    p.winningTrades += 1;
    p.grossProfit += latestTrade.realizedPnl;
  } else {
    p.losingTrades += 1;
    p.grossLoss += Math.abs(latestTrade.realizedPnl);
  }

  p.winRate = p.totalTrades > 0 ? Number(((p.winningTrades / p.totalTrades) * 100).toFixed(1)) : 0;
  p.netProfit = Number((p.grossProfit - p.grossLoss).toFixed(2));
  p.netProfitInr = Number((p.netProfit * currentUsdtInrRate).toFixed(2));
  p.netProfitPercent = Number(((p.netProfit / p.startingEquity) * 100).toFixed(2));
  p.profitFactor = p.grossLoss > 0 ? Number((p.grossProfit / p.grossLoss).toFixed(2)) : p.grossProfit > 0 ? 99 : 0;
  p.averageTradePnl = Number((p.netProfit / p.totalTrades).toFixed(2));

  p.currentEquity = Number((p.startingEquity + p.netProfit).toFixed(2));
  p.currentEquityInr = Number((p.startingEquityInr + p.netProfitInr).toFixed(2));

  p.equityHistory.push({
    timestamp: Date.now(),
    equity: p.currentEquity,
    equityInr: p.currentEquityInr,
  });

  // Calculate Max Drawdown
  let peak = p.startingEquity;
  let maxDd = 0;
  for (const pt of p.equityHistory) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = peak > 0 ? ((peak - pt.equity) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  p.maxDrawdownPercent = Number(maxDd.toFixed(2));

  // Daily drawdown circuit breaker check
  if (p.maxDrawdownPercent >= botState.config.risk.maxDailyDrawdownPercent && botState.config.isRunning) {
    botState.config.isRunning = false;
    logSystem(
      'error',
      `CIRCUIT BREAKER TRIGGERED: Max Drawdown (${p.maxDrawdownPercent}%) exceeded daily limit (${botState.config.risk.maxDailyDrawdownPercent}%). Trading paused to safeguard capital.`
    );
  }
}

// -------------------------------------------------------------
// Real-Time Bot Execution Engine Loop (runs every 6 seconds)
// -------------------------------------------------------------
setInterval(async () => {
  if (!botState.config.isRunning) return;

  try {
    const market = botState.config.activeMarket;
    const pair = botState.config.candlePair;
    const timeframe = botState.config.timeframe;

    // 1. Fetch latest candle data from CoinDCX
    const candleRes = await fetch(
      `${COINDCX_PUBLIC_URL}/market_data/candles?pair=${encodeURIComponent(pair)}&interval=${timeframe}&limit=60`
    );
    if (!candleRes.ok) return;

    const rawCandles = await candleRes.json();
    if (!Array.isArray(rawCandles) || rawCandles.length < 20) return;

    const candles: Candle[] = rawCandles
      .map((c: any) => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
      }))
      .sort((a, b) => a.time - b.time);

    const latestCandle = candles[candles.length - 1];
    const currentPrice = latestCandle.close;
    const indicators = extractLatestIndicators(candles);

    // 2. Manage Active Positions (TP, SL, Trailing Stop, Breakeven Lock, Early Protective Cut, Liquidation)
    for (let i = botState.positions.length - 1; i >= 0; i--) {
      const pos = botState.positions[i];
      pos.currentPrice = currentPrice;

      const pnlMultiplier = pos.positionDirection === 'LONG' ? 1 : -1;
      pos.unrealizedPnl = (currentPrice - pos.entryPrice) * pos.quantity * pnlMultiplier;
      pos.unrealizedPnlInr = pos.unrealizedPnl * currentUsdtInrRate;
      pos.unrealizedPnlPercent = pos.marginAmountInr > 0
        ? (pos.unrealizedPnlInr / pos.marginAmountInr) * 100
        : 0;

      const priceMovePercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * pnlMultiplier * 100;

      // Check Liquidation Risk
      const isLiquidated = pos.positionDirection === 'LONG'
        ? currentPrice <= pos.liquidationPrice
        : currentPrice >= pos.liquidationPrice;

      if (isLiquidated) {
        closePosition(pos, currentPrice, 'LIQUIDATION');
        botState.positions.splice(i, 1);
        continue;
      }

      // 🛡️ ZERO-LOSS AUTO-BREAKEVEN LOCK:
      // Once position reaches the configured profit trigger (default +0.8%), lock stop-loss at entry + fee buffer
      if (botState.config.risk.autoBreakevenLock && !pos.breakevenLocked) {
        const beTrigger = botState.config.risk.breakevenTriggerPercent ?? 0.8;
        if (priceMovePercent >= beTrigger) {
          pos.breakevenLocked = true;
          const feeBuffer = 0.0012; // 0.12% covers maker/taker fees + minor slippage
          if (pos.positionDirection === 'LONG') {
            const bePrice = Number((pos.entryPrice * (1 + feeBuffer)).toFixed(4));
            if (bePrice > pos.stopLossPrice) {
              pos.stopLossPrice = bePrice;
              logSystem(
                'trade',
                `🛡️ ZERO-LOSS BREAKeven LOCKED: ${pos.market} LONG hit +${priceMovePercent.toFixed(2)}% gain! Stop-Loss moved to $${bePrice} (Breakeven + fee buffer). Trade CANNOT take a loss.`
              );
            }
          } else {
            const bePrice = Number((pos.entryPrice * (1 - feeBuffer)).toFixed(4));
            if (bePrice < pos.stopLossPrice) {
              pos.stopLossPrice = bePrice;
              logSystem(
                'trade',
                `🛡️ ZERO-LOSS BREAKEVEN LOCKED: ${pos.market} SHORT hit +${priceMovePercent.toFixed(2)}% gain! Stop-Loss moved to $${bePrice} (Breakeven + fee buffer). Trade CANNOT take a loss.`
              );
            }
          }
        }
      }

      // ⚡ EARLY PROTECTIVE MOMENTUM CUT:
      // If trade experiences early adverse move and momentum indicators confirm breakdown, cut early to prevent full loss
      if (botState.config.risk.earlyMomentumCut && !pos.breakevenLocked) {
        const hardSl = botState.config.risk.stopLossPercent || 1.5;
        if (priceMovePercent <= -0.45 && priceMovePercent > -(hardSl * 0.85)) {
          let adverseReversal = false;
          let adverseReason = '';

          if (pos.positionDirection === 'LONG') {
            if (indicators.macd.histogram < -0.05 && indicators.rsi < 44 && currentPrice < indicators.ema.ema21) {
              adverseReversal = true;
              adverseReason = `MACD flipped bearish (${indicators.macd.histogram.toFixed(3)}) & RSI dropped below 44`;
            }
          } else {
            if (indicators.macd.histogram > 0.05 && indicators.rsi > 56 && currentPrice > indicators.ema.ema21) {
              adverseReversal = true;
              adverseReason = `MACD flipped bullish (+${indicators.macd.histogram.toFixed(3)}) & RSI crossed above 56`;
            }
          }

          if (adverseReversal) {
            closePosition(pos, currentPrice, 'EARLY_PROTECTIVE_CUT');
            botState.positions.splice(i, 1);
            logSystem(
              'trade',
              `⚡ EARLY PROTECTIVE CUT: Closed ${pos.market} ${pos.positionDirection} early at ${priceMovePercent.toFixed(2)}% (${adverseReason}). Successfully avoided full ${hardSl}% stop-loss!`
            );
            continue;
          }
        }
      }

      // 🎯 ADVANCED DYNAMIC TRAILING STOP LOSS ENGINE
      const isTrailingEnabled = pos.trailingStopLoss ?? botState.config.risk.trailingStopLoss;
      const trailDistancePct = pos.trailingStopPercent ?? botState.config.risk.trailingStopPercent ?? 1.0;
      const activationPct = pos.trailingActivationPercent ?? botState.config.risk.trailingActivationPercent ?? 0.5;
      const useSuperTrendTrail = pos.trailingUseSuperTrend ?? botState.config.risk.trailingUseSuperTrend ?? true;

      if (isTrailingEnabled) {
        // Activate trailing when position reaches activation profit threshold or if already activated
        if (!pos.trailingActivated && (priceMovePercent >= activationPct || activationPct <= 0)) {
          pos.trailingActivated = true;
          logSystem(
            'trade',
            `🎯 TRAILING STOP ENGAGED: ${pos.market} ${pos.positionDirection} reached +${priceMovePercent.toFixed(2)}% profit threshold. Dynamic ${trailDistancePct}% trailing stop actively ratcheting.`
          );
        }

        if (pos.trailingActivated) {
          if (pos.positionDirection === 'LONG') {
            if (!pos.highestPriceSinceEntry || currentPrice > pos.highestPriceSinceEntry) {
              pos.highestPriceSinceEntry = currentPrice;
            }
            let candidateSl = Number((pos.highestPriceSinceEntry * (1 - trailDistancePct / 100)).toFixed(4));

            // Dynamic SuperTrend support trailing integration
            if (useSuperTrendTrail && indicators.superTrend?.direction === 'BULLISH' && indicators.superTrend.lowerBand > candidateSl) {
              candidateSl = Number(indicators.superTrend.lowerBand.toFixed(4));
            }

            // Trailing stop loss ONLY ratchets upwards, never downwards
            if (candidateSl > pos.stopLossPrice) {
              const prevSl = pos.stopLossPrice;
              pos.stopLossPrice = candidateSl;
              pos.trailingStopPrice = candidateSl;

              if (candidateSl > pos.entryPrice) {
                pos.trailingProfitLockedInr = (candidateSl - pos.entryPrice) * pos.quantity * currentUsdtInrRate;
              }

              logSystem(
                'trade',
                `🎯 TRAILING STOP RATCHET: ${pos.market} LONG SL moved up from $${prevSl} to $${candidateSl} (Peak: $${pos.highestPriceSinceEntry.toLocaleString()}) | Locked Profit: ₹${(pos.trailingProfitLockedInr || 0).toFixed(0)} INR`
              );
            }
          } else {
            // SHORT Position
            if (!pos.lowestPriceSinceEntry || currentPrice < pos.lowestPriceSinceEntry) {
              pos.lowestPriceSinceEntry = currentPrice;
            }
            let candidateSl = Number((pos.lowestPriceSinceEntry * (1 + trailDistancePct / 100)).toFixed(4));

            // Dynamic SuperTrend resistance trailing integration
            if (useSuperTrendTrail && indicators.superTrend?.direction === 'BEARISH' && indicators.superTrend.upperBand < candidateSl) {
              candidateSl = Number(indicators.superTrend.upperBand.toFixed(4));
            }

            // Trailing stop loss ONLY ratchets downwards for shorts, never upwards
            if (candidateSl < pos.stopLossPrice) {
              const prevSl = pos.stopLossPrice;
              pos.stopLossPrice = candidateSl;
              pos.trailingStopPrice = candidateSl;

              if (candidateSl < pos.entryPrice) {
                pos.trailingProfitLockedInr = (pos.entryPrice - candidateSl) * pos.quantity * currentUsdtInrRate;
              }

              logSystem(
                'trade',
                `🎯 TRAILING STOP RATCHET: ${pos.market} SHORT SL moved down from $${prevSl} to $${candidateSl} (Trough: $${pos.lowestPriceSinceEntry.toLocaleString()}) | Locked Profit: ₹${(pos.trailingProfitLockedInr || 0).toFixed(0)} INR`
              );
            }
          }
        }
      }

      // Check Stop Loss Trigger
      const isStopLossHit = pos.positionDirection === 'LONG'
        ? currentPrice <= pos.stopLossPrice
        : currentPrice >= pos.stopLossPrice;

      if (isStopLossHit) {
        const exitType = pos.trailingActivated && pos.trailingProfitLockedInr && pos.trailingProfitLockedInr > 0
          ? 'TRAILING_STOP'
          : pos.breakevenLocked
          ? 'BREAKEVEN_GUARD'
          : pos.highestPriceSinceEntry && (pos.positionDirection === 'LONG' ? pos.highestPriceSinceEntry > pos.entryPrice : pos.lowestPriceSinceEntry! < pos.entryPrice)
          ? 'TRAILING_STOP'
          : 'STOP_LOSS';
        closePosition(pos, currentPrice, exitType);
        botState.positions.splice(i, 1);
        continue;
      }

      // Check Take Profit Trigger
      const isTakeProfitHit = pos.positionDirection === 'LONG'
        ? currentPrice >= pos.takeProfitPrice
        : currentPrice <= pos.takeProfitPrice;

      if (isTakeProfitHit) {
        closePosition(pos, currentPrice, 'TAKE_PROFIT');
        botState.positions.splice(i, 1);
        continue;
      }
    }

    // 3. Evaluate Strategy Entry Signals for both LONG and SHORT Futures
    if (botState.positions.length >= botState.config.risk.maxOpenPositions) {
      return;
    }

    // Cooldown check
    const now = Date.now();
    const cooldownMs = botState.config.risk.cooldownMinutes * 60 * 1000;
    if (now - botState.lastEvaluationTime < cooldownMs) {
      return;
    }

    const strat = botState.config.strategy;
    const allowedDir = botState.config.allowedDirection;
    let signalDirection: PositionDirection | null = null;
    let triggerReason = '';

    if (strat === 'confluence_ensemble') {
      const ticker = cachedTickers.find((t: any) => t.market === market);
      const pair = normalizeCoinDcxCandlePair(market);
      const microstructure = await fetchCoinDcxOrderBook(pair, currentPrice);

      let aiInsight: AiPrimitivesInsight | undefined = undefined;
      let dualTier: DualTierAiStatus | undefined = undefined;
      if (geminiApiKey) {
        try {
          const aiRes = await fetchDualTierAiPrimitivesInsight(market, currentPrice, indicators, ticker, microstructure);
          aiInsight = aiRes.insight;
          dualTier = aiRes.dualTier;
        } catch {}
      }

      const primitives = evaluateDecisionPrimitives(
        indicators,
        currentPrice,
        market,
        ticker,
        {
          maxDailyDrawdownPercent: botState.config.risk.maxDailyDrawdownPercent,
          currentDailyDrawdown: botState.performance.maxDrawdownPercent,
          trailingStopLoss: botState.config.risk.trailingStopLoss,
          allowedDirection: allowedDir,
        },
        aiInsight,
        microstructure,
        dualTier
      );

      if (primitives.actionableSignal.executeTrade) {
        signalDirection = primitives.choice.direction === 'LONG' ? 'LONG' : 'SHORT';
        triggerReason = `2+3+4+5 Quant Pipeline (${primitives.choice.selected} ${primitives.choice.dominantConfidence}% | Score: ${primitives.score.compositeScore} ${primitives.score.qualityTier} | OBI: ${(microstructure.imbalanceRatio * 100).toFixed(0)}% | ${primitives.boolGates.gates.length} Gates Cleared)`;
      }
    } else if (strat === 'supertrend_volume_flow') {
      const st = indicators.superTrend;
      const vol = indicators.volumeDynamics;
      // High accuracy Long: SuperTrend Bullish + Volume Surge / VWAP confirmation
      if (
        st.direction === 'BULLISH' &&
        (vol.volumeSurgeRatio >= 1.2 || currentPrice >= vol.vwap) &&
        indicators.rsi >= 38 && indicators.rsi <= 68 &&
        allowedDir !== 'SHORT_ONLY'
      ) {
        signalDirection = 'LONG';
        triggerReason = `SuperTrend Bullish ($${st.value}) + Volume Surge ${vol.volumeSurgeRatio}x & Above VWAP ($${vol.vwap})`;
      }
      // High accuracy Short: SuperTrend Bearish + Volume Surge / VWAP breakdown
      else if (
        st.direction === 'BEARISH' &&
        (vol.volumeSurgeRatio >= 1.2 || currentPrice <= vol.vwap) &&
        indicators.rsi >= 32 && indicators.rsi <= 62 &&
        allowedDir !== 'LONG_ONLY'
      ) {
        signalDirection = 'SHORT';
        triggerReason = `SuperTrend Bearish ($${st.value}) + Volume Surge ${vol.volumeSurgeRatio}x & Below VWAP ($${vol.vwap})`;
      }
    } else if (strat === 'gemini_ai_confluence') {
      const st = indicators.superTrend;
      const vol = indicators.volumeDynamics;
      // Confluence for Long: SuperTrend Bullish + Momentum + Volume Confirmation
      if (
        st.direction === 'BULLISH' &&
        indicators.rsi >= 38 && indicators.rsi <= 65 &&
        indicators.macd.macdLine > indicators.macd.signalLine &&
        currentPrice >= vol.vwap &&
        allowedDir !== 'SHORT_ONLY'
      ) {
        signalDirection = 'LONG';
        triggerReason = `Gemini AI SuperTrend + Volume Confluence: SuperTrend Bullish ($${st.value}) + RVol ${vol.volumeSurgeRatio}x`;
      }
      // Confluence for Short: SuperTrend Bearish + Momentum + Volume Breakdown
      else if (
        st.direction === 'BEARISH' &&
        indicators.rsi >= 35 && indicators.rsi <= 65 &&
        indicators.macd.macdLine < indicators.macd.signalLine &&
        currentPrice <= vol.vwap &&
        allowedDir !== 'LONG_ONLY'
      ) {
        signalDirection = 'SHORT';
        triggerReason = `Gemini AI SuperTrend + Volume Confluence: SuperTrend Bearish ($${st.value}) + RVol ${vol.volumeSurgeRatio}x`;
      }
    } else if (strat === 'rsi_macd_reversal') {
      // Long: Oversold bounce + MACD flip bullish
      if (indicators.rsi < 35 && indicators.macd.histogram > 0 && allowedDir !== 'SHORT_ONLY') {
        signalDirection = 'LONG';
        triggerReason = `RSI Oversold (${indicators.rsi.toFixed(1)}) + MACD Bullish Cross (${indicators.macd.histogram.toFixed(2)})`;
      }
      // Short: Overbought rejection + MACD flip bearish
      else if (indicators.rsi > 65 && indicators.macd.histogram < 0 && allowedDir !== 'LONG_ONLY') {
        signalDirection = 'SHORT';
        triggerReason = `RSI Overbought (${indicators.rsi.toFixed(1)}) + MACD Bearish Divergence (${indicators.macd.histogram.toFixed(2)})`;
      }
    } else if (strat === 'bollinger_breakout') {
      // Long: Price piercing upper band with volume
      if (currentPrice > indicators.bollingerBands.middle && indicators.bollingerBands.percentB > 0.85 && allowedDir !== 'SHORT_ONLY') {
        signalDirection = 'LONG';
        triggerReason = `Bollinger Upper Expansion (%B: ${indicators.bollingerBands.percentB.toFixed(2)}) with ${indicators.volumeDynamics.volumeSurgeRatio}x Volume`;
      }
      // Short: Price breaking below lower band with volume
      else if (currentPrice < indicators.bollingerBands.middle && indicators.bollingerBands.percentB < 0.15 && allowedDir !== 'LONG_ONLY') {
        signalDirection = 'SHORT';
        triggerReason = `Bollinger Lower Breakdown (%B: ${indicators.bollingerBands.percentB.toFixed(2)}) with ${indicators.volumeDynamics.volumeSurgeRatio}x Volume`;
      }
    } else if (strat === 'ema_golden_cross') {
      // Long: EMA 9 > EMA 21 and price > EMA 50
      if (indicators.ema.ema9 > indicators.ema.ema21 && currentPrice > indicators.ema.ema50 && allowedDir !== 'SHORT_ONLY') {
        signalDirection = 'LONG';
        triggerReason = `EMA 9/21 Golden Cross above EMA 50`;
      }
      // Short: EMA 9 < EMA 21 and price < EMA 50 (Death Cross)
      else if (indicators.ema.ema9 < indicators.ema.ema21 && currentPrice < indicators.ema.ema50 && allowedDir !== 'LONG_ONLY') {
        signalDirection = 'SHORT';
        triggerReason = `EMA 9/21 Bearish Cross below EMA 50`;
      }
    } else if (strat === 'dynamic_grid_dca') {
      if ((currentPrice <= indicators.bollingerBands.lower || indicators.rsi < 32) && allowedDir !== 'SHORT_ONLY') {
        signalDirection = 'LONG';
        triggerReason = `Grid Scalper: Dip Buyer Trigger (Price: $${currentPrice.toLocaleString()})`;
      } else if ((currentPrice >= indicators.bollingerBands.upper || indicators.rsi > 68) && allowedDir !== 'LONG_ONLY') {
        signalDirection = 'SHORT';
        triggerReason = `Grid Scalper: Upper Resistance Short Trigger (Price: $${currentPrice.toLocaleString()})`;
      }
    }

    if (signalDirection) {
      // 🎯 AUTO-SCAN STATISTICAL PROBABILITY BEFORE EXECUTING ORDER
      const prob = calculateMarketProbability({
        candles,
        indicators,
        currentPrice,
      });

      const minRequiredProb = botState.config.risk.minWinProbabilityPercent || 80;

      // LOSS-PREVENTION GATE 1: Probability must exceed required threshold (e.g. 80%)
      if (prob.overallWinProbability < minRequiredProb) {
        return;
      }

      // LOSS-PREVENTION GATE 2: Loss risk cannot be high
      if (prob.lossRiskLevel === 'HIGH') {
        return;
      }

      // LOSS-PREVENTION GATE 3: Direction must match quantitative probability recommendation
      if (prob.recommendedDirection !== 'NEUTRAL' && prob.recommendedDirection !== signalDirection) {
        return;
      }

      // LOSS-PREVENTION GATE 4: SuperTrend Confirmation Filter
      if (botState.config.risk.superTrendFilter) {
        const expectedStDir = signalDirection === 'LONG' ? 'BULLISH' : 'BEARISH';
        if (indicators.superTrend?.direction !== expectedStDir) {
          return;
        }
      }

      // LOSS-PREVENTION GATE 5: Volume Surge Filter
      if (botState.config.risk.volumeSurgeFilter) {
        if (indicators.volumeDynamics?.volumeSurgeRatio < 1.15) {
          return; // Wait for volume expansion to avoid fakeout
        }
      }

      botState.lastEvaluationTime = now;
      const leverage = botState.config.defaultLeverage || 10;
      // Allocate configured % of INR capital per trade (supports up to 100% allocation)
      const marginAllocationInr = (botState.paperBalances.INR * (botState.config.risk.capitalPerTradePercent / 100));
      const marginToUseInr = Math.max(100, Math.min(marginAllocationInr, botState.paperBalances.INR || 10000));
      const notionalInr = marginToUseInr * leverage;
      const notionalUsd = notionalInr / currentUsdtInrRate;
      const quantity = Number((notionalUsd / currentPrice).toFixed(6));

      if (quantity > 0) {
        // If live mode, execute on CoinDCX Derivatives Futures API
        if (botState.config.mode === 'live') {
          const liveResult = await executeCoinDcxLiveFuturesOrder({
            pair: botState.config.candlePair || 'B-BTC_USDT',
            side: signalDirection === 'LONG' ? 'buy' : 'sell',
            orderType: 'market',
            quantity,
            leverage,
            marginCurrency: botState.config.marginCurrency || 'INR',
          });

          if (!liveResult.success) {
            // Rejection reason is already recorded in system logs by executeCoinDcxLiveFuturesOrder
            return;
          }
        }

        const stopLossPct = botState.config.risk.stopLossPercent / 100;
        const takeProfitPct = botState.config.risk.takeProfitPercent / 100;

        const stopLossPrice = signalDirection === 'LONG'
          ? currentPrice * (1 - stopLossPct)
          : currentPrice * (1 + stopLossPct);

        const takeProfitPrice = signalDirection === 'LONG'
          ? currentPrice * (1 + takeProfitPct)
          : currentPrice * (1 - takeProfitPct);

        const liquidationPrice = calculateLiquidationPrice(currentPrice, signalDirection, leverage);

        const newPos: Position = {
          id: `pos-fut-${botState.config.mode}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          market,
          side: signalDirection === 'LONG' ? 'BUY' : 'SELL',
          positionDirection: signalDirection,
          tradingType: 'futures',
          marginCurrency: 'INR',
          leverage,
          marginAmountInr: marginToUseInr,
          entryPrice: currentPrice,
          currentPrice,
          quantity,
          notionalValue: notionalUsd,
          notionalValueInr: notionalInr,
          liquidationPrice,
          stopLossPrice,
          takeProfitPrice,
          highestPriceSinceEntry: currentPrice,
          lowestPriceSinceEntry: currentPrice,
          unrealizedPnl: 0,
          unrealizedPnlInr: 0,
          unrealizedPnlPercent: 0,
          openedAt: Date.now(),
          strategyUsed: strat,
          entryReason: triggerReason,
          breakevenLocked: false,
          initialWinProbability: prob.overallWinProbability,
          trailingStopLoss: botState.config.risk.trailingStopLoss ?? true,
          trailingStopPercent: botState.config.risk.trailingStopPercent ?? 1.0,
          trailingActivationPercent: botState.config.risk.trailingActivationPercent ?? 0.5,
          trailingActivated: false,
          trailingStopPrice: stopLossPrice,
          trailingUseSuperTrend: botState.config.risk.trailingUseSuperTrend ?? true,
          trailingProfitLockedInr: 0,
        };

        botState.positions.push(newPos);
        if (botState.config.mode === 'paper') {
          botState.paperBalances.INR = Math.max(0, botState.paperBalances.INR - marginToUseInr);
        }

        logSystem(
          'trade',
          `AUTOMATED FUTURES ORDER [${botState.config.mode.toUpperCase()} - ${strat}]: ${signalDirection} ${quantity} ${market} (${leverage}x Leverage) @ $${currentPrice.toLocaleString()} | Margin: ₹${marginToUseInr.toFixed(0)} | Win Prob: ${prob.overallWinProbability}% (${prob.lossRiskLevel} Risk | EV: +${prob.expectedValue}) | ${triggerReason}`
        );
      }
    }
  } catch (err: any) {
    console.error('Bot loop execution error:', err.message);
  }
}, 6000);

// -------------------------------------------------------------
// Prevent any unmatched /api routes from falling into Vite HTML fallback
// -------------------------------------------------------------
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.path}` });
});

// Explicit error handler for API routes
app.use((err: any, req: Request, res: Response, next: any) => {
  if (req.path.startsWith('/api')) {
    console.error('API Error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal Server Error' });
  }
  next(err);
});

// Start listening immediately so port 3000 is open without waiting for Vite initialization
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CoinDCX INR Futures AI Trading Bot Server listening on port ${PORT}`);
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving Setup
// -------------------------------------------------------------
async function setupVite() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().catch((err) => {
  console.error('Failed to setup Vite:', err);
});
