import React, { useState } from 'react';
import { BotConfig, StrategyType, PositionDirection, LiveWalletBalances } from '../types/trading';
import { Sliders, Shield, Zap, Check, AlertTriangle, ArrowUpDown, TrendingUp, TrendingDown, Radar, ShieldCheck, Lock, BarChart2 } from 'lucide-react';

interface BotControlPanelProps {
  config: BotConfig;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
  isLiveAvailable: boolean;
  onOpenSecurity: () => void;
  onOpenScanner?: () => void;
  usdtInrRate?: number;
  liveBalances?: LiveWalletBalances | null;
}

const STRATEGIES: Array<{
  id: StrategyType;
  name: string;
  description: string;
  tag: string;
}> = [
  {
    id: 'confluence_ensemble',
    name: 'Confluence Ensemble (3 Primitives: Choice, Score, Bool)',
    description: 'Premier system uniting SuperTrend, EMA Golden Cross, MACD Velocity, RSI, Bollinger & VWAP Flow into 3 Type-Safe Primitives for maximum trade accuracy.',
    tag: '3 Primitives Premier',
  },
  {
    id: 'supertrend_volume_flow',
    name: 'SuperTrend + Volume Flow Pro',
    description: 'High-accuracy confluence trading pairing trailing SuperTrend ATR flips with Institutional Volume Surges (>= 1.2x 20-SMA) and VWAP positioning.',
    tag: 'High Accuracy',
  },
  {
    id: 'gemini_ai_confluence',
    name: 'Gemini AI Confluence Engine',
    description: 'Autonomous multi-factor AI reasoning combining SuperTrend, Volume Surges, RSI, MACD, Bollinger Bands, and real-time candle momentum for both Long and Short futures.',
    tag: 'Flagship AI',
  },
  {
    id: 'rsi_macd_reversal',
    name: 'RSI + MACD Trend Reversal',
    description: 'Enters Long on oversold exhaustion (RSI < 35) and enters Short on overbought exhaustion (RSI > 65) with MACD momentum flips.',
    tag: 'Mean Reversion',
  },
  {
    id: 'bollinger_breakout',
    name: 'Bollinger Volatility Breakout',
    description: 'Capitalizes on band compression squeezes followed by high-volume breakouts through upper (Long) or lower (Short) bands.',
    tag: 'Volatility',
  },
  {
    id: 'ema_golden_cross',
    name: 'EMA Fast Cross & Trend Follower',
    description: 'Enters Long when EMA 9 crosses above EMA 21 (Golden Cross) and Short when EMA 9 crosses below EMA 21 (Death Cross).',
    tag: 'Trend Following',
  },
  {
    id: 'dynamic_grid_dca',
    name: 'Dynamic Grid & Scalping DCA',
    description: 'Systematically buys dips (Long) and shorts upper resistance (Short) to bank high-frequency INR margins.',
    tag: 'Grid Scalper',
  },
];

const LEVERAGE_OPTIONS = [2, 5, 10, 20, 50, 100];

export const BotControlPanel: React.FC<BotControlPanelProps> = ({
  config,
  onUpdateConfig,
  isLiveAvailable,
  onOpenSecurity,
  onOpenScanner,
  usdtInrRate = 100.0,
  liveBalances,
}) => {
  const [strategy, setStrategy] = useState<StrategyType>(config.strategy);
  const [mode, setMode] = useState<'paper' | 'live'>(config.mode);
  const [defaultLeverage, setDefaultLeverage] = useState<number>(config.defaultLeverage || 10);
  const [allowedDirection, setAllowedDirection] = useState<'BOTH' | 'LONG_ONLY' | 'SHORT_ONLY'>(
    config.allowedDirection || 'BOTH'
  );
  const [capitalPercent, setCapitalPercent] = useState<number>(config.risk.capitalPerTradePercent);
  const [stopLossPercent, setStopLossPercent] = useState<number>(config.risk.stopLossPercent);
  const [takeProfitPercent, setTakeProfitPercent] = useState<number>(config.risk.takeProfitPercent);
  const [trailingStop, setTrailingStop] = useState<boolean>(config.risk.trailingStopLoss ?? true);
  const [trailingStopPercent, setTrailingStopPercent] = useState<number>(config.risk.trailingStopPercent ?? 1.0);
  const [trailingActivationPercent, setTrailingActivationPercent] = useState<number>(config.risk.trailingActivationPercent ?? 0.5);
  const [trailingUseSuperTrend, setTrailingUseSuperTrend] = useState<boolean>(config.risk.trailingUseSuperTrend ?? true);
  const [maxPositions, setMaxPositions] = useState<number>(config.risk.maxOpenPositions);
  const [drawdownLimit, setDrawdownLimit] = useState<number>(config.risk.maxDailyDrawdownPercent);
  const [cooldown, setCooldown] = useState<number>(config.risk.cooldownMinutes);
  const [minConfidence, setMinConfidence] = useState<number>(config.minAiConfidence);
  const [minWinProbabilityPercent, setMinWinProbabilityPercent] = useState<number>(config.risk.minWinProbabilityPercent ?? 80);
  const [autoBreakevenLock, setAutoBreakevenLock] = useState<boolean>(config.risk.autoBreakevenLock ?? true);
  const [breakevenTriggerPercent, setBreakevenTriggerPercent] = useState<number>(config.risk.breakevenTriggerPercent ?? 0.8);
  const [earlyMomentumCut, setEarlyMomentumCut] = useState<boolean>(config.risk.earlyMomentumCut ?? true);
  const [superTrendFilter, setSuperTrendFilter] = useState<boolean>(config.risk.superTrendFilter ?? true);
  const [volumeSurgeFilter, setVolumeSurgeFilter] = useState<boolean>(config.risk.volumeSurgeFilter ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onUpdateConfig({
        strategy,
        mode,
        tradingType: 'futures',
        marginCurrency: 'INR',
        defaultLeverage,
        allowedDirection,
        minAiConfidence: minConfidence,
        risk: {
          ...config.risk,
          capitalPerTradePercent: capitalPercent,
          stopLossPercent,
          takeProfitPercent,
          trailingStopLoss: trailingStop,
          trailingStopPercent,
          trailingActivationPercent,
          trailingUseSuperTrend,
          maxOpenPositions: maxPositions,
          maxDailyDrawdownPercent: drawdownLimit,
          cooldownMinutes: cooldown,
          minWinProbabilityPercent,
          autoBreakevenLock,
          breakevenTriggerPercent,
          earlyMomentumCut,
          superTrendFilter,
          volumeSurgeFilter,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#0E131F] border border-slate-800 rounded-lg p-5 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            CoinDCX INR Futures Configuration & Risk Rules
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 rounded transition-colors"
            >
              <Radar className="w-3.5 h-3.5 animate-pulse" />
              <span>Probability Radar</span>
            </button>
          )}
          <div className="text-xs text-slate-400 font-mono">
            1 USDT = ₹{usdtInrRate.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Mode & Currency Collateral Selector */}
      <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">Execution Mode</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
              INR Margin Futures Collateral
            </span>
          </div>
          {!isLiveAvailable && (
            <button
              onClick={onOpenSecurity}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
            >
              Configure Live CoinDCX Keys
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('paper')}
            className={`p-3 rounded border text-left transition-colors ${
              mode === 'paper'
                ? 'bg-slate-800 border-emerald-500/80 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-xs text-emerald-400">High-Fidelity Paper Futures</div>
            <div className="text-[11px] text-slate-400 mt-1 leading-snug">
              Simulation with ₹10,00,000 virtual INR collateral, live CoinDCX orderbook fills and liquidation modeling.
            </div>
          </button>

          <button
            onClick={() => {
              if (!isLiveAvailable) {
                onOpenSecurity();
              } else {
                setMode('live');
              }
            }}
            className={`p-3 rounded border text-left transition-colors ${
              mode === 'live'
                ? 'bg-slate-800 border-amber-500/80 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-xs text-amber-400 flex items-center justify-between">
              <span>Live CoinDCX Futures</span>
              {!isLiveAvailable ? (
                <span className="text-[10px] text-rose-400 font-normal">Keys Required</span>
              ) : liveBalances ? (
                <span className={`text-[10px] font-mono font-bold ${liveBalances.isFunded ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ₹{liveBalances.inr.toFixed(2)} INR
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 leading-snug">
              Direct routing to CoinDCX derivatives API with INR margin mode via HMAC-SHA256 signature vault.
            </div>
            {mode === 'live' && liveBalances && !liveBalances.isFunded && (
              <div className="mt-2 p-2 rounded bg-amber-950/60 border border-amber-800/80 text-[10px] text-amber-300 font-sans leading-normal">
                ⚠️ <strong>Low Live Balance:</strong> CoinDCX requires min 60 USDT (~₹{liveBalances.minOrderValueInr.toFixed(0)}) order value. To execute live orders, ensure sufficient wallet funds.
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Futures Leverage & Trade Direction Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leverage Setting */}
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Default Futures Leverage</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">{defaultLeverage}x</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 mt-1">
            {LEVERAGE_OPTIONS.map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => setDefaultLeverage(lev)}
                className={`py-1.5 rounded font-bold text-xs transition-colors ${
                  defaultLeverage === lev
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            Higher leverage magnifies return on INR margin but tightens liquidation distance.
          </span>
        </div>

        {/* Trade Direction */}
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-300">Permitted Trade Direction</span>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            <button
              type="button"
              onClick={() => setAllowedDirection('BOTH')}
              className={`py-1.5 px-2 rounded font-bold text-xs flex items-center justify-center gap-1 transition-colors ${
                allowedDirection === 'BOTH'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>Both</span>
            </button>
            <button
              type="button"
              onClick={() => setAllowedDirection('LONG_ONLY')}
              className={`py-1.5 px-2 rounded font-bold text-xs flex items-center justify-center gap-1 transition-colors ${
                allowedDirection === 'LONG_ONLY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Long Only</span>
            </button>
            <button
              type="button"
              onClick={() => setAllowedDirection('SHORT_ONLY')}
              className={`py-1.5 px-2 rounded font-bold text-xs flex items-center justify-center gap-1 transition-colors ${
                allowedDirection === 'SHORT_ONLY'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              <span>Short Only</span>
            </button>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            Allows the bot to capitalize on uptrends (Long) and bear market breakdowns (Short).
          </span>
        </div>
      </div>

      {/* Strategy Selection List */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Select Active Futures Algorithm
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {STRATEGIES.map((s) => {
            const isSelected = strategy === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500/80 shadow-sm'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {s.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {s.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Parameters Grid */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Futures Risk & Margin Safeguards</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono tabular-nums text-xs">
          {/* INR Margin Allocation per Trade */}
          <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
              <span>INR Capital Per Trade</span>
              <span className="font-mono text-emerald-400 font-bold text-xs">{capitalPercent}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={capitalPercent}
              onChange={(e) => setCapitalPercent(Number(e.target.value))}
              className="w-full mt-2 accent-emerald-500 cursor-pointer"
            />
            {/* Quick 10% - 100% Preset Buttons */}
            <div className="grid grid-cols-5 gap-1 mt-2">
              {[10, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setCapitalPercent(pct)}
                  className={`py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    capitalPercent === pct
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                  }`}
                >
                  {pct === 100 ? '100%' : `${pct}%`}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-sans flex items-center justify-between">
              <span>Allocation range: 1% – 100%</span>
              <span className="text-emerald-400/90 font-mono font-bold">
                ≈ ₹{((10000 * capitalPercent) / 100).toLocaleString('en-IN')} INR
              </span>
            </div>
          </div>

          {/* Stop Loss % */}
          <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
              <span>Stop Loss Threshold</span>
              <span className="font-mono text-rose-400 font-bold">{stopLossPercent}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={stopLossPercent}
              onChange={(e) => setStopLossPercent(Number(e.target.value))}
              className="w-full mt-2 accent-rose-500 cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1 font-sans">
              Automated bracket protection
            </div>
          </div>

          {/* Take Profit % */}
          <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
              <span>Take Profit Target</span>
              <span className="font-mono text-emerald-400 font-bold">+{takeProfitPercent}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={takeProfitPercent}
              onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
              className="w-full mt-2 accent-emerald-500 cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1 font-sans">
              Automated profit-taking level
            </div>
          </div>

          {/* Trailing Stop Loss Pro */}
          <div className={`p-3.5 rounded-lg border transition-all ${
            trailingStop
              ? 'bg-emerald-950/30 border-emerald-700/70 shadow-sm'
              : 'bg-slate-900/50 border-slate-800'
          }`}>
            <div className="flex items-center justify-between text-slate-300 text-[11px] font-sans">
              <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                <span className="text-base">🎯</span> Use Trailing Stop Loss
              </span>
              <button
                type="button"
                onClick={() => setTrailingStop(!trailingStop)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wide transition-colors ${
                  trailingStop
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {trailingStop ? 'ACTIVE · ON' : 'DISABLED'}
              </button>
            </div>

            {trailingStop && (
              <div className="mt-3 flex flex-col gap-2.5 pt-2 border-t border-emerald-900/50">
                {/* Trail Distance % */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span className="text-slate-400">Trailing Ratchet Distance:</span>
                    <span className="font-bold text-emerald-300 font-mono">{trailingStopPercent}%</span>
                  </div>
                  {/* Preset Pills */}
                  <div className="grid grid-cols-4 gap-1.5 mt-1.5 mb-1.5">
                    {[0.5, 1.0, 1.5, 2.0].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTrailingStopPercent(preset)}
                        className={`py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                          trailingStopPercent === preset
                            ? 'bg-emerald-600 text-white border border-emerald-400'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="5.0"
                    step="0.1"
                    value={trailingStopPercent}
                    onChange={(e) => setTrailingStopPercent(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Activation Profit Gate */}
                <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80">
                  <div className="flex justify-between text-[10px] text-slate-300">
                    <span className="text-slate-400">Trailing Activation Gate:</span>
                    <span className="font-bold text-white font-mono">
                      {trailingActivationPercent === 0 ? 'Immediate (0%)' : `+${trailingActivationPercent}% Profit`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.1"
                    value={trailingActivationPercent}
                    onChange={(e) => setTrailingActivationPercent(Number(e.target.value))}
                    className="w-full mt-1 accent-indigo-500 cursor-pointer"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {trailingActivationPercent === 0
                      ? 'Trails from entry immediately'
                      : `Trailing begins once position achieves +${trailingActivationPercent}% gain`}
                  </div>
                </div>

                {/* Dynamic SuperTrend ATR Confluence Toggle */}
                <div className="flex items-center justify-between text-[10px] p-2 rounded bg-emerald-950/40 border border-emerald-800/60">
                  <span className="text-emerald-300 font-medium">Link with SuperTrend (10, 3.0) ATR Trail:</span>
                  <button
                    type="button"
                    onClick={() => setTrailingUseSuperTrend(!trailingUseSuperTrend)}
                    className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                      trailingUseSuperTrend ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {trailingUseSuperTrend ? 'LINKED' : 'OFF'}
                  </button>
                </div>
              </div>
            )}

            <div className="text-[10px] text-slate-400 mt-2 font-sans leading-tight">
              Ratchets Stop Loss upward on longs and downward on shorts to bank profit while giving winners room to run.
            </div>
          </div>

          {/* Max Open Positions */}
          <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
              <span>Max Concurrent Positions</span>
              <span className="font-mono text-white font-bold">{maxPositions}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={maxPositions}
              onChange={(e) => setMaxPositions(Number(e.target.value))}
              className="w-full mt-2 accent-indigo-500 cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1 font-sans">
              Prevents over-exposure across multiple futures pairs
            </div>
          </div>

          {/* Daily Drawdown Circuit Breaker */}
          <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
              <span>Drawdown Circuit Breaker</span>
              <span className="font-mono text-amber-400 font-bold">{drawdownLimit}%</span>
            </div>
            <input
              type="range"
              min="2"
              max="15"
              step="0.5"
              value={drawdownLimit}
              onChange={(e) => setDrawdownLimit(Number(e.target.value))}
              className="w-full mt-2 accent-amber-500 cursor-pointer"
            />
            <div className="text-[10px] text-slate-500 mt-1 font-sans">
              Halts trading if daily loss reaches threshold
            </div>
          </div>

          {/* 🎯 Zero-Loss Probability Gate */}
          <div className="p-3 rounded bg-indigo-950/30 border border-indigo-800/60">
            <div className="flex items-center justify-between text-slate-300 text-[11px] font-sans">
              <span className="font-semibold flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Min Win Probability Gate
              </span>
              <span className="font-mono text-emerald-400 font-bold">{minWinProbabilityPercent}%</span>
            </div>
            <input
              type="range"
              min="65"
              max="95"
              step="1"
              value={minWinProbabilityPercent}
              onChange={(e) => setMinWinProbabilityPercent(Number(e.target.value))}
              className="w-full mt-2 accent-emerald-500 cursor-pointer"
            />
            <div className="text-[10px] text-slate-400 mt-1 font-sans">
              Auto-scans probabilities; skips trades below {minWinProbabilityPercent}%
            </div>
          </div>

          {/* 🛡️ Auto-Breakeven Zero-Loss Lock */}
          <div className="p-3 rounded bg-cyan-950/30 border border-cyan-800/60">
            <div className="flex items-center justify-between text-slate-300 text-[11px] font-sans">
              <span className="font-semibold flex items-center gap-1 text-cyan-400">
                <Lock className="w-3.5 h-3.5" /> Breakeven Lock (+{breakevenTriggerPercent}%)
              </span>
              <button
                type="button"
                onClick={() => setAutoBreakevenLock(!autoBreakevenLock)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  autoBreakevenLock ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {autoBreakevenLock ? 'LOCKED' : 'OFF'}
              </button>
            </div>
            {autoBreakevenLock && (
              <input
                type="range"
                min="0.3"
                max="2.0"
                step="0.1"
                value={breakevenTriggerPercent}
                onChange={(e) => setBreakevenTriggerPercent(Number(e.target.value))}
                className="w-full mt-2 accent-cyan-500 cursor-pointer"
              />
            )}
            <div className="text-[10px] text-slate-400 mt-1 font-sans">
              Moves SL to Entry + fee buffer at +{breakevenTriggerPercent}% to eliminate loss
            </div>
          </div>

          {/* ⚡ Early Adverse Momentum Cut */}
          <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-sans">
              <span className="font-semibold flex items-center gap-1 text-indigo-400">
                <Zap className="w-3.5 h-3.5" /> Early Momentum Cut
              </span>
              <button
                type="button"
                onClick={() => setEarlyMomentumCut(!earlyMomentumCut)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  earlyMomentumCut ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {earlyMomentumCut ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
            <div className="text-[10px] text-slate-500 mt-2 font-sans leading-tight">
              Cuts position early on indicator reversal, preventing full stop-loss
            </div>
          </div>

          {/* 🟢 SuperTrend Confluence Gate */}
          <div className="p-3 rounded bg-emerald-950/20 border border-emerald-800/40">
            <div className="flex items-center justify-between text-slate-300 text-[11px] font-sans">
              <span className="font-semibold flex items-center gap-1 text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" /> SuperTrend Direction Gate
              </span>
              <button
                type="button"
                onClick={() => setSuperTrendFilter(!superTrendFilter)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  superTrendFilter ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {superTrendFilter ? 'STRICT' : 'OFF'}
              </button>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 font-sans leading-tight">
              Blocks trades against the 10,3 SuperTrend trailing line to ensure trend alignment
            </div>
          </div>

          {/* 📊 Institutional Volume Surge Filter */}
          <div className="p-3 rounded bg-purple-950/20 border border-purple-800/40">
            <div className="flex items-center justify-between text-slate-300 text-[11px] font-sans">
              <span className="font-semibold flex items-center gap-1 text-purple-400">
                <BarChart2 className="w-3.5 h-3.5" /> Volume Surge Filter (≥1.2x)
              </span>
              <button
                type="button"
                onClick={() => setVolumeSurgeFilter(!volumeSurgeFilter)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  volumeSurgeFilter ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {volumeSurgeFilter ? 'SURGE ONLY' : 'OFF'}
              </button>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 font-sans leading-tight">
              Rejects low-volume false breakouts; requires volume expansion above 20-SMA
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
        {savedSuccess && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> INR Futures Settings Deployed!
          </span>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>{isSaving ? 'Deploying...' : 'Save & Deploy INR Futures Config'}</span>
        </button>
      </div>
    </div>
  );
};
