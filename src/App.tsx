import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MarketBar } from './components/MarketBar';
import { TradingChart } from './components/TradingChart';
import { AiAnalysisPanel } from './components/AiAnalysisPanel';
import { BotControlPanel } from './components/BotControlPanel';
import { PositionsTable } from './components/PositionsTable';
import { OrderBookPanel } from './components/OrderBookPanel';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { ApiKeyVaultModal } from './components/ApiKeyVaultModal';
import { QuickTradeModal } from './components/QuickTradeModal';
import { SystemLogPanel } from './components/SystemLogPanel';
import { ProbabilityScannerModal } from './components/ProbabilityScannerModal';
import { ConfluenceEnsembleModal } from './components/ConfluenceEnsembleModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import {
  CoinDcxTicker,
  Candle,
  IndicatorValues,
  OrderBook,
  Position,
  Trade,
  PerformanceStats,
  BotConfig,
  AiAnalysisResult,
  ApiKeyStatus,
  PositionDirection,
  LiveWalletBalances,
} from './types/trading';

// Safe JSON fetcher that verifies JSON response before parsing to prevent HTML fallback parse errors
async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.toLowerCase().includes('application/json')) {
      return null;
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'strategy' | 'performance' | 'history' | 'security'>('terminal');

  // Market & Chart State
  const [activeMarket, setActiveMarket] = useState<string>('BTCUSDT');
  const [candlePair, setCandlePair] = useState<string>('B-BTC_USDT');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'>('1m');
  const [usdtInrRate, setUsdtInrRate] = useState<number>(100.0);
  const [inrBalance, setInrBalance] = useState<number>(10000);
  const [liveBalances, setLiveBalances] = useState<LiveWalletBalances | null>(null);

  // Live Exchange Data
  const [tickers, setTickers] = useState<CoinDcxTicker[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<IndicatorValues | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);

  // Gemini AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Bot Engine State
  const [botConfig, setBotConfig] = useState<BotConfig>({
    isRunning: false,
    mode: 'paper',
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
      capitalPerTradePercent: 100, // 100% INR capital per trade
      maxOpenPositions: 3,
      stopLossPercent: 1.5,
      takeProfitPercent: 3.0,
      trailingStopLoss: true,
      trailingStopPercent: 1.0,
      maxDailyDrawdownPercent: 5.0,
      cooldownMinutes: 1,
      slippageTolerancePercent: 0.15,
      minWinProbabilityPercent: 80,
      autoBreakevenLock: true,
      breakevenTriggerPercent: 0.8,
      earlyMomentumCut: true,
      autoScanMultiMarket: true,
    },
  });

  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [performance, setPerformance] = useState<PerformanceStats>({
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
    currentEquity: 10000,
    currentEquityInr: 1000000,
    startingEquity: 10000,
    startingEquityInr: 1000000,
    equityHistory: [],
  });
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);

  // Modals
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isQuickTradeOpen, setIsQuickTradeOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isConfluenceModalOpen, setIsConfluenceModalOpen] = useState(false);

  // 1. Fetch Tickers
  const fetchTickers = useCallback(async () => {
    const data = await safeFetchJson<{ success: boolean; data: CoinDcxTicker[] }>('/api/coindcx/tickers');
    if (data?.success && Array.isArray(data.data)) {
      setTickers(data.data);
      const usdtInrTicker = data.data.find(
        (t) => t.market === 'USDTINR' || t.market === 'USDT_INR'
      );
      if (usdtInrTicker && Number(usdtInrTicker.last_price) > 0) {
        setUsdtInrRate(Number(usdtInrTicker.last_price));
      }
    }
  }, []);

  // 2. Fetch Candles & Indicators
  const fetchCandles = useCallback(async () => {
    const data = await safeFetchJson<{
      success: boolean;
      candles: Candle[];
      indicators?: IndicatorValues;
    }>(`/api/coindcx/candles?pair=${encodeURIComponent(candlePair)}&interval=${timeframe}&limit=100`);

    if (data?.success) {
      setCandles(data.candles || []);
      if (data.indicators) {
        setIndicators(data.indicators);
      }
    }
  }, [candlePair, timeframe]);

  // 3. Fetch OrderBook
  const fetchOrderBook = useCallback(async () => {
    const data = await safeFetchJson<{ success: boolean; orderBook: OrderBook }>(
      `/api/coindcx/orderbook?pair=${encodeURIComponent(candlePair)}`
    );
    if (data?.success && data.orderBook) {
      setOrderBook(data.orderBook);
    }
  }, [candlePair]);

  // 4. Fetch Bot Status & Trades
  const fetchBotStatus = useCallback(async () => {
    const data = await safeFetchJson<{
      success: boolean;
      config: BotConfig;
      positions: Position[];
      trades: Trade[];
      performance: PerformanceStats;
      systemLogs: any[];
      usdtInrRate?: number;
      inrBalance?: number;
      paperBalances?: { INR: number; USDT: number };
      liveBalances?: LiveWalletBalances;
    }>('/api/bot/status');

    if (data?.success) {
      setBotConfig(data.config);
      setPositions(data.positions || []);
      setTrades(data.trades || []);
      if (data.performance) {
        setPerformance(data.performance);
      }
      if (data.usdtInrRate) {
        setUsdtInrRate(data.usdtInrRate);
      }
      if (data.liveBalances) {
        setLiveBalances(data.liveBalances);
      }
      // Update displayed INR balance based on mode
      if (data.config.mode === 'live' && data.liveBalances) {
        setInrBalance(data.liveBalances.inr);
      } else if (data.paperBalances?.INR !== undefined) {
        setInrBalance(data.paperBalances.INR);
      } else if (data.inrBalance !== undefined) {
        setInrBalance(data.inrBalance);
      }
      setSystemLogs(data.systemLogs || []);
    }
  }, []);

  // 5. Fetch API Credentials Status
  const fetchCredentialsStatus = useCallback(async () => {
    const data = await safeFetchJson<{ success: boolean; status: ApiKeyStatus }>(
      '/api/coindcx/credentials-status'
    );
    if (data?.success && data.status) {
      setApiKeyStatus(data.status);
      if (data.status.liveBalances) {
        setLiveBalances(data.status.liveBalances);
      }
    }
  }, []);

  // 6. Gemini Quantitative Market Scan for Futures
  const handleRunAiAnalysis = async () => {
    if (candles.length === 0) return;
    setIsAiAnalyzing(true);
    try {
      const currentTicker = tickers.find((t) => t.market === activeMarket);
      const currentPrice = currentTicker ? Number(currentTicker.last_price) : candles[candles.length - 1]?.close;

      const data = await safeFetchJson<{ success: boolean; analysis: AiAnalysisResult }>('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market: activeMarket,
          pair: candlePair,
          interval: timeframe,
          candles,
          indicators,
          currentPrice,
          tradingType: 'futures',
          marginCurrency: 'INR',
          defaultLeverage: botConfig.defaultLeverage || 10,
          usdtInrRate,
        }),
      });

      if (data?.success && data.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Initial and Periodic Fetching
  useEffect(() => {
    fetchTickers();
    fetchCandles();
    fetchOrderBook();
    fetchBotStatus();
    fetchCredentialsStatus();

    const tickerInterval = setInterval(fetchTickers, 3000);
    const candleInterval = setInterval(fetchCandles, 4000);
    const obInterval = setInterval(fetchOrderBook, 4000);
    const botInterval = setInterval(fetchBotStatus, 3000);

    return () => {
      clearInterval(tickerInterval);
      clearInterval(candleInterval);
      clearInterval(obInterval);
      clearInterval(botInterval);
    };
  }, [fetchTickers, fetchCandles, fetchOrderBook, fetchBotStatus, fetchCredentialsStatus]);

  // Market Switch Handler
  const handleSelectMarket = (market: string, pair: string) => {
    setActiveMarket(market);
    const normalizedPair = pair && pair.includes('-') && pair.includes('_')
      ? pair
      : market.endsWith('INR')
      ? `I-${market.slice(0, -3)}_INR`
      : `B-${market.replace(/USDT$/, '')}_USDT`;
    setCandlePair(normalizedPair);
    // Also inform bot backend of pair switch
    safeFetchJson('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeMarket: market, candlePair: normalizedPair }),
    });
  };

  // Bot Toggle Handler
  const handleToggleBot = async () => {
    const data = await safeFetchJson<{ success: boolean; isRunning: boolean }>('/api/bot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRunning: !botConfig.isRunning }),
    });
    if (data?.success) {
      setBotConfig((prev) => ({ ...prev, isRunning: data.isRunning }));
    }
  };

  // Emergency Stop Handler
  const handleEmergencyStop = async () => {
    await safeFetchJson('/api/bot/emergency-close', { method: 'POST' });
    fetchBotStatus();
  };

  // Close Single Position
  const handleClosePosition = async (id: string, price: number) => {
    await safeFetchJson('/api/bot/close-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionId: id, exitPrice: price }),
    });
    fetchBotStatus();
  };

  // Update Trailing Stop Loss on Position
  const handleUpdatePositionTrailing = async (positionId: string, trailingStopLoss: boolean, trailingStopPercent: number) => {
    await safeFetchJson('/api/bot/update-position-trailing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionId, trailingStopLoss, trailingStopPercent }),
    });
    fetchBotStatus();
  };

  // Update Bot Configuration
  const handleUpdateConfig = async (newConfig: Partial<BotConfig>) => {
    const data = await safeFetchJson<{ success: boolean; config: BotConfig; error?: string }>('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to update config');
    }
    setBotConfig(data.config);
  };

  // Reset Simulation Wallet & History
  const handleResetSimulation = async () => {
    await safeFetchJson('/api/bot/reset', { method: 'POST' });
    fetchBotStatus();
  };

  // Execute Order (from Quick Trade or AI Recommendation)
  const handleExecuteTrade = async (order: {
    market: string;
    side: 'BUY' | 'SELL';
    direction?: PositionDirection;
    order_type: 'market' | 'limit';
    price: number;
    quantity: number;
    leverage?: number;
    marginCurrency?: 'INR' | 'USDT';
    triggerReason?: string;
    useTrailingStop?: boolean;
    trailingStopPercent?: number;
    trailingUseSuperTrend?: boolean;
  }) => {
    const data = await safeFetchJson<{ success: boolean; error?: string }>('/api/bot/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...order,
        direction: order.direction || (order.side === 'BUY' ? 'LONG' : 'SHORT'),
        leverage: order.leverage || botConfig.defaultLeverage || 10,
        marginCurrency: order.marginCurrency || 'INR',
        strategyUsed: botConfig.strategy,
        useTrailingStop: order.useTrailingStop ?? true,
        trailingStopPercent: order.trailingStopPercent ?? (botConfig.risk.trailingStopPercent || 1.0),
        trailingUseSuperTrend: order.trailingUseSuperTrend ?? (botConfig.risk.trailingUseSuperTrend ?? true),
      }),
    });
    if (!data?.success) {
      throw new Error(data?.error || 'Order placement failed');
    }
    fetchBotStatus();
  };

  const currentTicker = tickers.find((t) => t.market === activeMarket);
  const currentPrice = currentTicker
    ? Number(currentTicker.last_price)
    : candles[candles.length - 1]?.close || 0;

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/30 selection:text-white">
      {/* 1. Header with INR Futures Margin Collateral */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'security') setIsSecurityModalOpen(true);
          else setActiveTab(tab);
        }}
        isRunning={botConfig.isRunning}
        isLiveMode={botConfig.mode === 'live'}
        onToggleBot={handleToggleBot}
        onEmergencyStop={handleEmergencyStop}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenConfluenceEnsemble={() => setIsConfluenceModalOpen(true)}
        openPositionsCount={positions.length}
        inrMarginBalance={inrBalance}
        liveBalances={liveBalances}
        defaultLeverage={botConfig.defaultLeverage || 10}
        usdtInrRate={usdtInrRate}
      />

      {/* 2. Market Bar with USD/INR Dual Pricing & Leverage Hud */}
      <MarketBar
        currentMarket={activeMarket}
        candlePair={candlePair}
        onSelectMarket={handleSelectMarket}
        tickers={tickers}
        timeframe={timeframe}
        onChangeTimeframe={setTimeframe}
        indicators={indicators}
        onOpenQuickTrade={() => setIsQuickTradeOpen(true)}
        onOpenConfluenceEnsemble={() => setIsConfluenceModalOpen(true)}
        usdtInrRate={usdtInrRate}
        defaultLeverage={botConfig.defaultLeverage || 10}
        onChangeLeverage={(lev) => handleUpdateConfig({ defaultLeverage: lev })}
      />

      {/* 3. Main Workspace Tabs */}
      <main className="flex-1 p-2 sm:p-4 pb-20 lg:pb-4 max-w-[1720px] w-full mx-auto flex flex-col gap-4">
        {/* Tab 1: Terminal & Live Chart */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-4">
            {/* Top Workspace Grid: Main Chart & AI / OrderBook Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column: Interactive Candlestick Chart (8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <TradingChart
                  candles={candles}
                  indicators={indicators}
                  positions={positions}
                  trades={trades}
                  market={activeMarket}
                  timeframe={timeframe}
                  isLoading={isLoadingCandles}
                />

                {/* Active Open Positions Table with INR Margin & Liquidation Warning */}
                <PositionsTable
                  positions={positions}
                  onClosePosition={handleClosePosition}
                  onUpdateTrailing={handleUpdatePositionTrailing}
                  usdtInrRate={usdtInrRate}
                />
              </div>

              {/* Right Column: AI Quantitative Intelligence & OrderBook (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <AiAnalysisPanel
                  analysis={aiAnalysis}
                  indicators={indicators}
                  isLoading={isAiAnalyzing}
                  onRefreshAnalysis={handleRunAiAnalysis}
                  onExecuteRecommendation={(direction, price, sl, tp, leverage, useTrailing, trailingPercent) => {
                    // Margin calculation: ~₹25,000 INR collateral per quick AI position
                    const marginInr = 25000;
                    const notionalInr = marginInr * leverage;
                    const notionalUsd = notionalInr / usdtInrRate;
                    const qty = Number((notionalUsd / price).toFixed(6));
                    handleExecuteTrade({
                      market: activeMarket,
                      side: direction === 'LONG' ? 'BUY' : 'SELL',
                      direction,
                      order_type: 'market',
                      price,
                      quantity: qty,
                      leverage,
                      marginCurrency: 'INR',
                      useTrailingStop: useTrailing ?? true,
                      trailingStopPercent: trailingPercent ?? 1.0,
                      triggerReason: `Gemini AI Recommended ${direction} Futures Position (${leverage}x | Trailing Active)`,
                    });
                  }}
                  currentPrice={currentPrice}
                  market={activeMarket}
                  usdtInrRate={usdtInrRate}
                  onOpenScanner={() => setIsScannerOpen(true)}
                />

                <OrderBookPanel
                  orderBook={orderBook}
                  market={activeMarket}
                  currentPrice={currentPrice}
                />

                <SystemLogPanel logs={systemLogs} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Strategy Selection & INR Futures Risk Configuration */}
        {activeTab === 'strategy' && (
          <div className="max-w-4xl mx-auto w-full">
            <BotControlPanel
              config={botConfig}
              onUpdateConfig={handleUpdateConfig}
              isLiveAvailable={Boolean(apiKeyStatus?.isLiveAvailable)}
              onOpenSecurity={() => setIsSecurityModalOpen(true)}
              onOpenScanner={() => setIsScannerOpen(true)}
              usdtInrRate={usdtInrRate}
              liveBalances={liveBalances}
            />
          </div>
        )}

        {/* Tab 3: Quantitative INR Futures Performance Dashboard */}
        {activeTab === 'performance' && (
          <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
            <PerformanceDashboard
              performance={performance}
              trades={trades}
              onResetSimulation={handleResetSimulation}
              usdtInrRate={usdtInrRate}
            />

            <TradeHistoryTable trades={trades} usdtInrRate={usdtInrRate} />
          </div>
        )}

        {/* Tab 4: Trade & Order History */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
            <TradeHistoryTable trades={trades} usdtInrRate={usdtInrRate} />
            <SystemLogPanel logs={systemLogs} />
          </div>
        )}
      </main>

      {/* API Key Vault & Security Architecture Modal */}
      <ApiKeyVaultModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        status={apiKeyStatus}
        onRefreshStatus={fetchCredentialsStatus}
      />

      {/* Quick Futures Order Modal with INR Margin & Leverage Slider */}
      <QuickTradeModal
        isOpen={isQuickTradeOpen}
        onClose={() => setIsQuickTradeOpen(false)}
        market={activeMarket}
        currentPrice={currentPrice}
        usdtInrRate={usdtInrRate}
        defaultLeverage={botConfig.defaultLeverage || 10}
        onExecuteTrade={handleExecuteTrade}
        isLiveMode={botConfig.mode === 'live'}
        inrBalance={inrBalance}
        liveBalances={liveBalances}
      />

      {/* 🎯 Auto-Probability Radar & Zero-Loss Guard Modal */}
      <ProbabilityScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        config={botConfig}
        onUpdateConfig={handleUpdateConfig}
        onSelectMarket={(market, pair) => {
          handleSelectMarket(market, pair);
          setIsScannerOpen(false);
        }}
        currentMarket={activeMarket}
        usdtInrRate={usdtInrRate}
      />

      {/* ⚡ 3-Primitives Confluence Ensemble Modal */}
      <ConfluenceEnsembleModal
        isOpen={isConfluenceModalOpen}
        onClose={() => setIsConfluenceModalOpen(false)}
        market={activeMarket}
        currentPrice={currentPrice}
        usdtInrRate={usdtInrRate}
        inrBalance={inrBalance}
        capitalPercent={botConfig.risk.capitalPerTradePercent}
        isBotRunning={botConfig.isRunning}
        onToggleBot={handleToggleBot}
        onUpdateConfig={handleUpdateConfig}
        onExecuteTrade={handleExecuteTrade}
      />

      {/* 📱 Mobile Adaptive Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'security') setIsSecurityModalOpen(true);
          else setActiveTab(tab);
        }}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        openPositionsCount={positions.length}
        isRunning={botConfig.isRunning}
      />
    </div>
  );
}
