import React, { useState } from 'react';
import { CoinDcxTicker, IndicatorValues } from '../types/trading';
import { ChevronDown, Search, ArrowUpRight, ArrowDownRight, Zap, Shield, Layers } from 'lucide-react';

interface MarketBarProps {
  currentMarket: string;
  candlePair: string;
  onSelectMarket: (market: string, candlePair: string) => void;
  tickers: CoinDcxTicker[];
  timeframe: string;
  onChangeTimeframe: (tf: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d') => void;
  indicators: IndicatorValues | null;
  onOpenQuickTrade: () => void;
  onOpenConfluenceEnsemble?: () => void;
  usdtInrRate?: number;
  defaultLeverage?: number;
  onChangeLeverage?: (lev: number) => void;
}

const FEATURED_FUTURES_MARKETS = [
  { market: 'BTCUSDT', pair: 'B-BTC_USDT', label: 'BTC/USDT Perp' },
  { market: 'ETHUSDT', pair: 'B-ETH_USDT', label: 'ETH/USDT Perp' },
  { market: 'SOLUSDT', pair: 'B-SOL_USDT', label: 'SOL/USDT Perp' },
  { market: 'XRPUSDT', pair: 'B-XRP_USDT', label: 'XRP/USDT Perp' },
  { market: 'DOGEUSDT', pair: 'B-DOGE_USDT', label: 'DOGE/USDT Perp' },
  { market: 'BNBUSDT', pair: 'B-BNB_USDT', label: 'BNB/USDT Perp' },
];

const TIMEFRAMES: Array<'1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'> = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
];

const LEVERAGE_OPTIONS = [5, 10, 20, 50, 100];

export const MarketBar: React.FC<MarketBarProps> = ({
  currentMarket,
  onSelectMarket,
  tickers,
  timeframe,
  onChangeTimeframe,
  indicators,
  onOpenQuickTrade,
  onOpenConfluenceEnsemble,
  usdtInrRate = 100.0,
  defaultLeverage = 10,
  onChangeLeverage,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const currentTicker = tickers.find((t) => t.market === currentMarket);
  const lastPriceUsd = currentTicker ? Number(currentTicker.last_price) : 0;
  const lastPriceInr = lastPriceUsd * usdtInrRate;
  const change24h = currentTicker ? Number(currentTicker.change_24_hour) : 0;
  const isPositive = change24h >= 0;
  const high24Usd = currentTicker ? Number(currentTicker.high) : 0;
  const low24Usd = currentTicker ? Number(currentTicker.low) : 0;
  const volume24 = currentTicker ? Number(currentTicker.volume) : 0;

  const filteredTickers = tickers.filter((t) =>
    t.market.toLowerCase().includes(searchFilter.toLowerCase())
  ).slice(0, 40);

  return (
    <div className="h-14 border-b border-slate-800 bg-[#0E131F] px-2.5 sm:px-4 flex items-center justify-between text-xs overflow-x-auto no-scrollbar gap-3 sm:gap-4 shrink-0">
      {/* Market Selector & Key Metrics */}
      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
        {/* Market Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700/80 hover:border-slate-500 text-white font-bold tracking-tight text-xs sm:text-sm transition-colors"
          >
            <span>{currentMarket}</span>
            <span className="text-[9px] sm:text-[10px] text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800 font-mono">
              FUTURES
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-72 max-h-84 bg-slate-900 border border-slate-700 rounded-md shadow-2xl z-50 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950 border border-slate-800 rounded">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search CoinDCX futures..."
                    className="w-full bg-transparent text-white text-xs outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-64 p-1">
                {filteredTickers.map((t) => {
                  const chg = Number(t.change_24_hour);
                  const inr = Number(t.last_price) * usdtInrRate;
                  return (
                    <button
                      key={t.market}
                      onClick={() => {
                        const isINRMarket = t.market.endsWith('INR');
                        const base = isINRMarket ? 'INR' : 'USDT';
                        const target = t.market.replace(base, '');
                        const ecode = isINRMarket ? 'I' : 'B';
                        const pair = `${ecode}-${target}_${base}`;
                        onSelectMarket(t.market, pair);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200">{t.market}</span>
                        <span className="text-[10px] text-slate-500">₹{inr.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-slate-200">${Number(t.last_price).toLocaleString()}</div>
                        <div className={`text-[10px] ${chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quick Market Switches */}
        <div className="hidden xl:flex items-center gap-1.5 border-l border-slate-800 pl-3 text-slate-400">
          {FEATURED_FUTURES_MARKETS.map((m) => (
            <button
              key={m.market}
              onClick={() => onSelectMarket(m.market, m.pair)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                currentMarket === m.market
                  ? 'bg-slate-800 text-emerald-400 font-semibold border border-slate-700'
                  : 'hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Real-time Ticker Metrics: USD & INR */}
        <div className="flex items-center gap-5 border-l border-slate-800 pl-3 font-mono tabular-nums">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">Mark Price (USD / INR)</div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${lastPriceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <span className="text-[11px] text-slate-400 font-sans">
                (₹{lastPriceInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">24h Change</div>
            <div className={`text-xs font-semibold flex items-center ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 inline" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 inline" />}
              {isPositive ? '+' : ''}{change24h.toFixed(2)}%
            </div>
          </div>

          <div className="hidden md:block">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">24h High / Low</div>
            <div className="text-xs text-slate-300">
              ${high24Usd.toLocaleString()} / ${low24Usd.toLocaleString()}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">USDT/INR FX</div>
            <div className="text-xs text-emerald-300 font-bold">
              ₹{usdtInrRate.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls: Leverage, Indicators & Quick Trade */}
      <div className="flex items-center gap-3">
        {/* Quick Leverage Selector */}
        {onChangeLeverage && (
          <div className="hidden md:flex items-center bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-[11px] font-mono">
            <span className="text-slate-500 px-1 font-sans">Lev:</span>
            {LEVERAGE_OPTIONS.map((lev) => (
              <button
                key={lev}
                onClick={() => onChangeLeverage(lev)}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                  defaultLeverage === lev
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        )}

        {/* Live Technical Indicator Badges */}
        {indicators && (
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-400 border-r border-slate-800 pr-3">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-sans">RSI(14):</span>
              <span
                className={`font-semibold ${
                  indicators.rsi < 30
                    ? 'text-emerald-400'
                    : indicators.rsi > 70
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {indicators.rsi.toFixed(1)}
              </span>
            </div>

            <span className="text-slate-700" aria-hidden="true">·</span>

            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-sans">MACD Hist:</span>
              <span
                className={`font-semibold ${
                  indicators.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {indicators.macd.histogram >= 0 ? '+' : ''}{indicators.macd.histogram.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Timeframe Selector Tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onChangeTimeframe(tf)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                timeframe === tf
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* 3-Primitives Confluence System Trigger */}
        {onOpenConfluenceEnsemble && (
          <button
            onClick={onOpenConfluenceEnsemble}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 hover:text-white font-medium text-xs rounded transition-all shadow-sm whitespace-nowrap"
            title="Launch 3-Primitives Confluence Engine (Choice, Score, Bool)"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">3-Primitives Engine</span>
          </button>
        )}

        {/* Quick Order Trigger */}
        <button
          onClick={onOpenQuickTrade}
          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs rounded transition-all shadow-sm whitespace-nowrap"
        >
          <Zap className="w-3 h-3 fill-current" />
          <span>Futures Order</span>
        </button>
      </div>
    </div>
  );
};
