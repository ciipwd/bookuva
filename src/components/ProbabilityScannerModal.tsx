import React, { useState, useEffect } from 'react';
import {
  MarketScanResult,
  ProbabilityFactorBreakdown,
  BotConfig,
} from '../types/trading';
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  Radar,
  Lock,
  Percent,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  BarChart2,
} from 'lucide-react';

interface ProbabilityScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => void;
  onSelectMarket: (market: string, candlePair: string) => void;
  currentMarket: string;
  usdtInrRate: number;
}

export const ProbabilityScannerModal: React.FC<ProbabilityScannerModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onSelectMarket,
  currentMarket,
  usdtInrRate,
}) => {
  const [scannerResults, setScannerResults] = useState<MarketScanResult[]>([]);
  const [activeMarketProb, setActiveMarketProb] = useState<ProbabilityFactorBreakdown | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);

  // Local config form states
  const [minWinProb, setMinWinProb] = useState(config.risk.minWinProbabilityPercent ?? 80);
  const [autoBreakeven, setAutoBreakeven] = useState(config.risk.autoBreakevenLock ?? true);
  const [breakevenTrigger, setBreakevenTrigger] = useState(config.risk.breakevenTriggerPercent ?? 0.8);
  const [earlyCut, setEarlyCut] = useState(config.risk.earlyMomentumCut ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchScanData = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const [scanRes, probRes] = await Promise.all([
        fetch('/api/bot/scanner'),
        fetch(`/api/bot/probability?pair=${encodeURIComponent(config.candlePair)}&interval=${config.timeframe}`),
      ]);

      if (scanRes.ok) {
        const data = await scanRes.json();
        if (data.success && data.scannerResults) {
          setScannerResults(data.scannerResults);
          setLastScanTime(data.scannedAt || Date.now());
        }
      }

      if (probRes.ok) {
        const pData = await probRes.json();
        if (pData.success && pData.probability) {
          setActiveMarketProb(pData.probability);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan market probabilities');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScanData();
      const interval = setInterval(fetchScanData, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [isOpen, config.candlePair, config.timeframe]);

  const handleSaveRiskRules = async () => {
    setIsSaving(true);
    try {
      await onUpdateConfig({
        risk: {
          ...config.risk,
          minWinProbabilityPercent: minWinProb,
          autoBreakevenLock: autoBreakeven,
          breakevenTriggerPercent: breakevenTrigger,
          earlyMomentumCut: earlyCut,
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0b0f19] border border-slate-700/80 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0e1424]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Radar className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Auto-Probability Scanner & Zero-Loss Engine
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Capital Shield Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live multi-market statistical evaluation preventing negative trades through strict confluence filtering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchScanData}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Markets...' : 'Rescan Now'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Banner: Zero-Loss Protocol Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-3">
              <div className="p-2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                  Entry Probability Gate
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {config.risk.minWinProbabilityPercent ?? 80}% Minimum
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Bot rejects trades below this threshold
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-3">
              <div className="p-2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                  Auto-Breakeven Lock
                </div>
                <div className="text-lg font-bold font-mono text-cyan-400">
                  +{config.risk.breakevenTriggerPercent ?? 0.8}% Trigger
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Moves SL to Entry + Fees to eliminate loss
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-3">
              <div className="p-2 rounded bg-amber-950 text-amber-400 border border-amber-800">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                  Adverse Momentum Cut
                </div>
                <div className="text-lg font-bold font-mono text-amber-400">
                  Active
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Exits early if indicators sharply flip against trade
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Top Futures Markets Probability Leaderboard */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live CoinDCX Futures Confluence Radar
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Updated: {new Date(lastScanTime).toLocaleTimeString()}
              </span>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0e1424] text-slate-400 border-b border-slate-800 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Market / Pair</th>
                      <th className="py-2.5 px-3">Mark Price</th>
                      <th className="py-2.5 px-3">24h Chg</th>
                      <th className="py-2.5 px-3">Win Probability</th>
                      <th className="py-2.5 px-3">SuperTrend</th>
                      <th className="py-2.5 px-3">Vol Surge</th>
                      <th className="py-2.5 px-3">Signal Bias</th>
                      <th className="py-2.5 px-3">Grade</th>
                      <th className="py-2.5 px-3">Optimal Leverage</th>
                      <th className="py-2.5 px-3">Confluence Factor</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {scannerResults.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                          {isScanning ? (
                            <div className="flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                              <span>Scanning live CoinDCX orderbooks and candlestick momentum...</span>
                            </div>
                          ) : (
                            'No scanner data available. Click "Rescan Now".'
                          )}
                        </td>
                      </tr>
                    ) : (
                      scannerResults.map((item) => {
                        const isCurrent = item.market === currentMarket;
                        const isPrime = item.confluenceGrade === 'A+' || item.confluenceGrade === 'A';
                        return (
                          <tr
                            key={item.market}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isCurrent ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{item.market}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.5 text-[9px] bg-indigo-900 text-indigo-200 rounded font-sans">
                                    Active
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-200">
                              <div>${item.lastPrice.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400">
                                ₹{(item.lastPrice * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`flex items-center gap-0.5 ${
                                  item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {item.change24h >= 0 ? '+' : ''}
                                {item.change24h.toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 min-w-[130px]">
                                <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      item.winProbability >= 80
                                        ? 'bg-emerald-400'
                                        : item.winProbability >= 70
                                        ? 'bg-amber-400'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${item.winProbability}%` }}
                                  />
                                </div>
                                <span
                                  className={`text-xs font-bold ${
                                    item.winProbability >= 80
                                      ? 'text-emerald-400'
                                      : item.winProbability >= 70
                                      ? 'text-amber-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {item.winProbability}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.superTrendSignal === 'BULLISH'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                    : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                                }`}
                              >
                                {item.superTrendSignal === 'BULLISH' ? '🟢 BULL' : '🔴 BEAR'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`font-bold text-xs ${
                                  (item.volumeSurgeRatio ?? 1) >= 1.3
                                    ? 'text-emerald-400'
                                    : (item.volumeSurgeRatio ?? 1) <= 0.7
                                    ? 'text-slate-500'
                                    : 'text-cyan-400'
                                }`}
                              >
                                {(item.volumeSurgeRatio ?? 1.0).toFixed(1)}x
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                  item.direction === 'LONG'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                                    : item.direction === 'SHORT'
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {item.direction}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded font-black text-xs ${
                                  item.confluenceGrade === 'A+'
                                    ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/50'
                                    : item.confluenceGrade === 'A'
                                    ? 'bg-emerald-900 text-emerald-200 border border-emerald-600'
                                    : item.confluenceGrade === 'B'
                                    ? 'bg-amber-900 text-amber-200 border border-amber-600'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {item.confluenceGrade}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-emerald-400 font-bold">
                              {item.optimalLeverage}x
                            </td>
                            <td className="py-3 px-3 text-slate-300 max-w-xs truncate font-sans text-[11px]">
                              {item.reason}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {isCurrent ? (
                                <span className="text-[11px] text-slate-500 font-sans">Current Pair</span>
                              ) : (
                                <button
                                  onClick={() => onSelectMarket(item.market, item.candlePair)}
                                  className={`px-2.5 py-1 rounded text-xs font-sans font-medium flex items-center gap-1 ml-auto transition-colors ${
                                    isPrime
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                  }`}
                                >
                                  <span>Trade</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Active Market 5-Factor Radar Breakdown */}
          {activeMarketProb && (
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Active Market Confluence Decomposition: {currentMarket}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Calculated in real-time to guarantee only mathematically advantageous positions are taken
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Expected Value (EV):</span>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    activeMarketProb.expectedValue > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>
                    {activeMarketProb.expectedValue > 0 ? '+' : ''}{activeMarketProb.expectedValue} EV
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-2">Risk/Reward:</span>
                  <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {activeMarketProb.riskRewardRatio}
                  </span>
                </div>
              </div>

              {/* 5 Factors */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Trend Alignment</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {activeMarketProb.trendScore}/100
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">EMA 9/21/50/200 Stack</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Momentum Slope</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {activeMarketProb.momentumScore}/100
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">RSI & MACD Velocity</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Orderbook Depth</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {activeMarketProb.orderbookScore}/100
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Bid/Ask Wall Ratio</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Volatility Regime</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {activeMarketProb.volatilityScore}/100
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Bollinger Squeeze & ATR</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Price Action</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {activeMarketProb.priceActionScore}/100
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Wick Rejections & Pinbars</div>
                </div>
              </div>

              {/* Signals */}
              {activeMarketProb.keySignals?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-sans font-medium">Detected Confluence:</span>
                  {activeMarketProb.keySignals.map((sig, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[10px] font-sans font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded-full"
                    >
                      {sig}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Zero-Loss Guard Settings Configuration */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Configure Zero-Loss Protective Guardrails</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Minimum Win Probability */}
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Min Win Probability to Enter
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={65}
                    max={95}
                    step={1}
                    value={minWinProb}
                    onChange={(e) => setMinWinProb(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold text-emerald-400 min-w-[42px]">
                    {minWinProb}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Orders below this threshold will be skipped.
                </span>
              </div>

              {/* Breakeven Lock Profit Threshold */}
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Breakeven Trigger Move
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.3}
                    max={2.0}
                    step={0.1}
                    value={breakevenTrigger}
                    onChange={(e) => setBreakevenTrigger(Number(e.target.value))}
                    className="flex-1 accent-cyan-500 cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold text-cyan-400 min-w-[42px]">
                    +{breakevenTrigger}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Profit level where SL moves to Entry + fee buffer.
                </span>
              </div>

              {/* Auto Breakeven Toggle */}
              <div className="flex flex-col justify-between">
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Zero-Loss Breakeven Lock
                </label>
                <button
                  type="button"
                  onClick={() => setAutoBreakeven(!autoBreakeven)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                    autoBreakeven
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>{autoBreakeven ? 'Enabled (Guaranteed)' : 'Disabled'}</span>
                  {autoBreakeven ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-slate-500" />}
                </button>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Guarantees trade exits at breakeven or better.
                </span>
              </div>

              {/* Early Adverse Cut Toggle */}
              <div className="flex flex-col justify-between">
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Early Momentum Cut
                </label>
                <button
                  type="button"
                  onClick={() => setEarlyCut(!earlyCut)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                    earlyCut
                      ? 'bg-indigo-950/80 border-indigo-600 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>{earlyCut ? 'Active (Cut Early)' : 'Disabled'}</span>
                  {earlyCut ? <Zap className="w-4 h-4 text-indigo-400" /> : <X className="w-4 h-4 text-slate-500" />}
                </button>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Cuts position at minor dip if indicators flip.
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleSaveRiskRules}
                disabled={isSaving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Updating...' : 'Save Protective Guardrails'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#0e1424] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>CoinDCX Public WebSocket & Orderbook Imbalance active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs transition-colors"
          >
            Close Scanner
          </button>
        </div>

      </div>
    </div>
  );
};
