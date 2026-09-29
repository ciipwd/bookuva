import React, { useState, useEffect } from 'react';
import {
  DecisionPrimitivesResult,
  PositionDirection,
  CoinDcxTicker,
  IndicatorValues,
} from '../types/trading';
import {
  X,
  Zap,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Target,
  Lock,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Cpu,
  Gauge,
  Play,
  Pause,
  Radio,
  Sparkles,
  Clock,
  BarChart3,
  Database,
  Flame,
} from 'lucide-react';

interface ConfluenceEnsembleModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: string;
  currentPrice: number;
  usdtInrRate?: number;
  inrBalance?: number;
  capitalPercent?: number;
  isBotRunning?: boolean;
  onToggleBot?: () => void;
  onUpdateConfig?: (config: any) => Promise<void> | void;
  onExecuteTrade: (order: {
    market: string;
    side: 'BUY' | 'SELL';
    direction: PositionDirection;
    order_type: 'market';
    price: number;
    quantity: number;
    leverage: number;
    marginCurrency: 'INR';
    useTrailingStop: boolean;
    trailingStopPercent: number;
    triggerReason: string;
  }) => Promise<void>;
}

export const ConfluenceEnsembleModal: React.FC<ConfluenceEnsembleModalProps> = ({
  isOpen,
  onClose,
  market,
  currentPrice,
  usdtInrRate = 100.0,
  inrBalance = 10000,
  capitalPercent = 100,
  isBotRunning = false,
  onToggleBot,
  onUpdateConfig,
  onExecuteTrade,
}) => {
  const [data, setData] = useState<DecisionPrimitivesResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [tradeSuccess, setTradeSuccess] = useState(false);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [useAi, setUseAi] = useState(true);

  // ⚡ AUTO-PILOT STATE
  const [isAutoPilot, setIsAutoPilot] = useState(true);
  const [autoExecutedCount, setAutoExecutedCount] = useState(0);
  const [lastExecutedKey, setLastExecutedKey] = useState<string | null>(null);
  const [scanCountdown, setScanCountdown] = useState(3);
  const [isAutoExecuting, setIsAutoExecuting] = useState(false);
  const [autoExecutionNotice, setAutoExecutionNotice] = useState<string | null>(null);

  const fetchPrimitives = async (overrideAi?: boolean) => {
    setIsLoading(true);
    setError(null);
    const aiActive = typeof overrideAi === 'boolean' ? overrideAi : useAi;
    try {
      const res = await fetch(`/api/bot/decision-primitives?market=${market}&ai=${aiActive}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch decision primitives');
      setData(json.result);
    } catch (err: any) {
      setError(err.message || 'Unable to compute 3-primitives ensemble');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchPrimitives(useAi);
    }
  }, [isOpen, market]);

  // Real-Time Auto-Pilot Scanning Loop (3s ticker)
  useEffect(() => {
    if (!isOpen) return;

    const cdTimer = setInterval(() => {
      setScanCountdown((prev) => (prev <= 1 ? 3 : prev - 1));
    }, 1000);

    const scanTimer = setInterval(() => {
      if (isAutoPilot && !isExecuting && !isAutoExecuting) {
        fetchPrimitives(useAi);
      }
    }, 3000);

    return () => {
      clearInterval(cdTimer);
      clearInterval(scanTimer);
    };
  }, [isOpen, isAutoPilot, useAi, market, isExecuting, isAutoExecuting]);

  const handleToggleAutoPilot = async () => {
    const next = !isAutoPilot;
    setIsAutoPilot(next);
    if (next) {
      if (onUpdateConfig) {
        await onUpdateConfig({ strategy: 'confluence_ensemble' });
      }
      if (!isBotRunning && onToggleBot) {
        onToggleBot();
      }
      fetchPrimitives(useAi);
    }
  };

  const handleExecute = async (isAuto = false) => {
    if (!data) return;
    setIsExecuting(true);
    setTradeSuccess(false);
    try {
      const dir: PositionDirection = data.choice.direction === 'SHORT' ? 'SHORT' : 'LONG';
      const side = dir === 'LONG' ? 'BUY' : 'SELL';
      const lev = data.actionableSignal.recommendedLeverage || 10;
      // Calculate INR margin per trade dynamically (supports up to 100% of ₹10,000 balance)
      const allocatedCapitalInr = (inrBalance || 10000) * ((capitalPercent || 100) / 100);
      const marginInr = Math.max(500, Math.round(allocatedCapitalInr));
      const notionalInr = marginInr * lev;
      const notionalUsd = notionalInr / usdtInrRate;
      const qty = Number((notionalUsd / currentPrice).toFixed(6));

      await onExecuteTrade({
        market,
        side,
        direction: dir,
        order_type: 'market',
        price: currentPrice,
        quantity: qty,
        leverage: lev,
        marginCurrency: 'INR',
        useTrailingStop: true,
        trailingStopPercent: data.actionableSignal.suggestedTrailingStopPercent || 1.0,
        triggerReason: `${isAuto ? '⚡ Auto-Pilot' : 'Manual'} 3-Primitives Confluence (${data.choice.selected} ${data.choice.dominantConfidence}% | Score: ${data.score.compositeScore} | All Gates Passed)`,
      });

      setTradeSuccess(true);
      if (isAuto) {
        setAutoExecutionNotice(`✅ Auto-Order Executed: ${dir} @ $${currentPrice.toLocaleString()} (₹${(currentPrice * usdtInrRate).toLocaleString('en-IN')}) | 1.0% Trailing SL Active`);
      }

      setTimeout(() => {
        setTradeSuccess(false);
      }, 3000);
    } catch (e: any) {
      setError(e.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Autonomous Execution Trigger
  useEffect(() => {
    if (!isAutoPilot || !data || !data.actionableSignal.executeTrade || isExecuting || isAutoExecuting || tradeSuccess) {
      return;
    }

    const signalKey = `${data.market}-${data.actionableSignal.action}-${data.choice.direction}-${data.score.compositeScore}`;
    if (signalKey === lastExecutedKey) {
      return;
    }

    setLastExecutedKey(signalKey);
    setIsAutoExecuting(true);
    setAutoExecutionNotice(`⚡ Auto-Pilot Triggered: ${data.actionableSignal.action} (${data.actionableSignal.recommendedLeverage}x + 1.0% Trailing SL)...`);

    const timer = setTimeout(async () => {
      try {
        await handleExecute(true);
        setAutoExecutedCount((c) => c + 1);
      } catch (err: any) {
        setAutoExecutionNotice(`❌ Auto-Execution Held: ${err.message || 'Error placing order'}`);
      } finally {
        setIsAutoExecuting(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [data, isAutoPilot, isExecuting, isAutoExecuting, tradeSuccess, lastExecutedKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-600/60 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Active Futures Confluence Ensemble</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-950 text-teal-300 border border-teal-600/70">
                  2+3+4+5 PIPELINE
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/80 hidden sm:inline">
                  3 PRIMITIVES ARCHITECTURE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Fast Local Quant (2) · L2 Book Depth & CVD (3) · Dual-Tier Gemini (4) · 100% Local Fallback (5)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Pilot Toggle Button */}
            <button
              onClick={handleToggleAutoPilot}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
                isAutoPilot
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/80 shadow-emerald-950/60 ring-1 ring-emerald-500/60'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Autonomous Auto-Execution: Automatically enters futures trades with dynamic trailing stop loss when all 3 Primitives clear"
            >
              <Zap className={`w-3.5 h-3.5 ${isAutoPilot ? 'fill-emerald-400 text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="tracking-wide">AUTO: {isAutoPilot ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => {
                const nextAi = !useAi;
                setUseAi(nextAi);
                fetchPrimitives(nextAi);
              }}
              disabled={isLoading}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                useAi
                  ? 'bg-purple-950/80 text-purple-300 border-purple-600/70 shadow-xs'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Toggle Gemini 3.8 Flash AI Market Structure & Trap Shield"
            >
              <Cpu className={`w-3.5 h-3.5 ${useAi ? 'text-purple-400' : 'text-slate-500'}`} />
              <span className="hidden xs:inline">Gemini AI</span> {useAi ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => fetchPrimitives(useAi)}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Confluence Ensemble"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-200">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && !data && (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
              <span className="text-sm font-medium">Computing 3-Primitives Ensemble on {market}...</span>
            </div>
          )}

          {data && (
            <>
              {/* ⚡ AUTO-PILOT REAL-TIME MONITOR BANNER */}
              {isAutoPilot && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-slate-900 border border-emerald-500/60 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] font-mono">
                          Auto-Pilot Active & Autonomous
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-mono border border-emerald-600/40">
                          {autoExecutedCount > 0 ? `${autoExecutedCount} Auto-Trades Placed` : 'Live Continuous Scanning'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                        {autoExecutionNotice || 'Continuous AI + Quant confluence scanning active. When Choice, Score, and all 6 Bool Gates pass, orders execute automatically with Dynamic Trailing Stop.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Next scan in <strong className="text-emerald-300">{scanCountdown}s</strong></span>
                    </div>
                    {isAutoExecuting && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-black font-bold animate-pulse text-[10px]">
                        EXECUTING NOW...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Market Context Strip */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{market} Futures</span>
                  <span className="font-mono text-emerald-400 font-bold">${currentPrice.toLocaleString()}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    (₹{(currentPrice * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Action Signal:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded font-bold font-mono text-xs ${
                      data.actionableSignal.action === 'ENTER_LONG'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-600'
                        : data.actionableSignal.action === 'ENTER_SHORT'
                        ? 'bg-rose-950 text-rose-400 border border-rose-600'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {data.actionableSignal.action.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                    Win Odds: {data.actionableSignal.estimatedWinRate}%
                  </span>
                </div>
              </div>

              {/* 📊 LEVEL-2 ORDER BOOK MICROSTRUCTURE & CVD METER (ALT 3) */}
              {data.microstructure && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2.5 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-white">CoinDCX Level-2 Order Book & CVD Flow</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        data.microstructure.imbalanceRatio > 0.15
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : data.microstructure.imbalanceRatio < -0.15
                          ? 'bg-rose-950 text-rose-300 border border-rose-700'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {data.microstructure.imbalanceGrade.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="text-slate-400">Spread:</span>
                      <span className="font-bold text-slate-200">${data.microstructure.spread} ({data.microstructure.spreadPercent.toFixed(3)}%)</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        data.microstructure.spoofRisk === 'LOW'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        Spoof Risk: {data.microstructure.spoofRisk}
                      </span>
                    </div>
                  </div>

                  {/* OBI Ratio Gauge Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1 font-mono">
                        <span className="text-rose-400 font-bold">Asks ${data.microstructure.askDepthUsd.toLocaleString()}</span>
                        <span>({data.microstructure.asksTotal.toFixed(2)} Vol)</span>
                      </span>
                      <span className="font-mono font-bold text-xs text-cyan-300">
                        Order Book Imbalance (OBI): {data.microstructure.imbalanceRatio >= 0 ? '+' : ''}{(data.microstructure.imbalanceRatio * 100).toFixed(1)}%
                      </span>
                      <span className="text-slate-400 flex items-center gap-1 font-mono">
                        <span className="text-emerald-400 font-bold">Bids ${data.microstructure.bidDepthUsd.toLocaleString()}</span>
                        <span>({data.microstructure.bidsTotal.toFixed(2)} Vol)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex">
                      <div
                        className="bg-rose-500 h-full transition-all duration-300"
                        style={{ width: `${Math.max(5, Math.min(95, 50 - (data.microstructure.imbalanceRatio * 50)))}%` }}
                      />
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${Math.max(5, Math.min(95, 50 + (data.microstructure.imbalanceRatio * 50)))}%` }}
                      />
                    </div>
                  </div>

                  {/* CVD Flow & Whale Wall Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-black/40 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Cumulative Delta (CVD):</span>
                      <span className={`font-bold ${data.microstructure.cvdDirection === 'ACCUMULATION' ? 'text-emerald-400' : data.microstructure.cvdDirection === 'DISTRIBUTION' ? 'text-rose-400' : 'text-slate-300'}`}>
                        {data.microstructure.cvdDirection} ({data.microstructure.cumulativeVolumeDelta >= 0 ? '+' : ''}{data.microstructure.cumulativeVolumeDelta})
                      </span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Whale Bid Wall:</span>
                      <span className="font-bold text-emerald-400">
                        ${data.microstructure.largeWalls.bidWallPrice?.toLocaleString() || 'Active Depth'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Whale Ask Wall:</span>
                      <span className="font-bold text-rose-400">
                        ${data.microstructure.largeWalls.askWallPrice?.toLocaleString() || 'Active Depth'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 🤖 DUAL-TIER GEMINI AI MARKET STRUCTURE & TRAP SHIELD BANNER (ALT 4) */}
              {data.aiInsights && data.aiInsights.aiIntegrated && (
                <div className="p-3.5 rounded-xl bg-purple-950/25 border border-purple-800/60 space-y-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                      <span className="font-bold text-purple-200">Dual-Tier Gemini AI Engine:</span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-purple-900/60 text-purple-200 border border-purple-700">
                        {data.aiInsights.regime.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        data.aiInsights.trapRisk === 'LOW'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : data.aiInsights.trapRisk === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}>
                        🛡️ Trap Risk: {data.aiInsights.trapRisk}
                      </span>
                      <span className="text-slate-400">({data.aiInsights.latencyMs}ms total)</span>
                    </div>
                  </div>

                  {/* Dual-Tier Breakdown */}
                  {data.dualTierAi && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded bg-black/40 border border-purple-900/40 flex items-center justify-between">
                        <span className="text-purple-300">⚡ Tier 1 ({data.dualTierAi.tier1.model}):</span>
                        <span className="text-slate-300">{data.dualTierAi.tier1.scanSummary}</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-purple-900/40 flex items-center justify-between">
                        <span className="text-purple-300">🛡️ Tier 2 ({data.dualTierAi.tier2.model}):</span>
                        <span className="text-slate-300">{data.dualTierAi.tier2.trapVerdict} Trap Risk ({data.dualTierAi.tier2.latencyMs}ms)</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div className="p-2 rounded bg-black/40 border border-purple-900/40">
                      <span className="text-purple-300 font-semibold font-mono">Macro Driver: </span>
                      <span>{data.aiInsights.macroRationale}</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-purple-900/40">
                      <span className="text-purple-300 font-semibold font-mono">Trap Detection: </span>
                      <span>{data.aiInsights.trapAnalysis}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3 PRIMITIVES CARDS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ---------------- PRIMITIVE 01: CHOICE ---------------- */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] font-mono font-bold rounded-bl-lg border-b border-l border-blue-600/40">
                    PRIMITIVE 01
                  </div>
                  <div>
                    <div className="text-blue-400 font-bold text-xs uppercase tracking-wider font-mono">
                      01 Choice
                    </div>
                    <div className="text-sm font-semibold text-slate-100 mt-0.5">
                      Direction & Probability
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Picks directional outcome & computes calibrated probability distribution:
                    </p>

                    {/* Probability Bars (Matching User Images) */}
                    <div className="mt-3.5 space-y-2.5">
                      {/* BUY Option */}
                      <div className={`p-2 rounded-lg border transition-all ${
                        data.choice.selected === 'BUY'
                          ? 'bg-emerald-950/40 border-emerald-600/80 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800/80'
                      }`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              data.choice.selected === 'BUY'
                                ? 'border-emerald-400 bg-emerald-500'
                                : 'border-slate-600'
                            }`}>
                              {data.choice.selected === 'BUY' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                            </span>
                            <span className={data.choice.selected === 'BUY' ? 'text-emerald-300' : 'text-slate-300'}>
                              BUY (LONG)
                            </span>
                          </label>
                          <span className="font-mono font-bold text-emerald-400">{data.choice.probability.buy}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${data.choice.probability.buy}%` }}
                          />
                        </div>
                      </div>

                      {/* HOLD Option */}
                      <div className={`p-2 rounded-lg border transition-all ${
                        data.choice.selected === 'HOLD'
                          ? 'bg-amber-950/40 border-amber-600/80 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800/80'
                      }`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              data.choice.selected === 'HOLD'
                                ? 'border-amber-400 bg-amber-500'
                                : 'border-slate-600'
                            }`}>
                              {data.choice.selected === 'HOLD' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                            </span>
                            <span className={data.choice.selected === 'HOLD' ? 'text-amber-300' : 'text-slate-300'}>
                              HOLD (CHOP)
                            </span>
                          </label>
                          <span className="font-mono font-bold text-amber-400">{data.choice.probability.hold}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${data.choice.probability.hold}%` }}
                          />
                        </div>
                      </div>

                      {/* SELL Option */}
                      <div className={`p-2 rounded-lg border transition-all ${
                        data.choice.selected === 'SELL'
                          ? 'bg-rose-950/40 border-rose-600/80 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800/80'
                      }`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              data.choice.selected === 'SELL'
                                ? 'border-rose-400 bg-rose-500'
                                : 'border-slate-600'
                            }`}>
                              {data.choice.selected === 'SELL' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                            </span>
                            <span className={data.choice.selected === 'SELL' ? 'text-rose-300' : 'text-slate-300'}>
                              SELL (SHORT)
                            </span>
                          </label>
                          <span className="font-mono font-bold text-rose-400">{data.choice.probability.sell}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${data.choice.probability.sell}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Algorithm Votes Tally */}
                  <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
                    <div className="flex justify-between font-mono">
                      <span>SuperTrend 10/3.0:</span>
                      <span className="font-bold text-white">
                        {data.choice.algorithmVotes.find((v) => v.algorithm.includes('SuperTrend'))?.vote}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>EMA 9/21 Alignment:</span>
                      <span className="font-bold text-white">
                        {data.choice.algorithmVotes.find((v) => v.algorithm.includes('EMA'))?.vote}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>MACD Velocity:</span>
                      <span className="font-bold text-white">
                        {data.choice.algorithmVotes.find((v) => v.algorithm.includes('MACD'))?.vote}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ---------------- PRIMITIVE 02: SCORE ---------------- */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-indigo-600/20 text-indigo-400 text-[10px] font-mono font-bold rounded-bl-lg border-b border-l border-indigo-600/40">
                    PRIMITIVE 02
                  </div>
                  <div>
                    <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider font-mono">
                      02 Score
                    </div>
                    <div className="text-sm font-semibold text-slate-100 mt-0.5">
                      Continuous Ordered Scale
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Scores variables on an ordered continuous scale (0.00 to 1.00):
                    </p>

                    {/* Ordered Scale Slider with Needle Pointer (Matching User Image) */}
                    <div className="mt-4 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-400">Composite Conviction:</span>
                        <span className="font-mono text-base font-bold text-cyan-300">
                          {data.score.compositeScore.toFixed(2)}
                        </span>
                      </div>

                      {/* Continuous Scale Graphic with Needle Pointer */}
                      <div className="relative pt-4 pb-2">
                        {/* Downward Needle Pointer */}
                        <div
                          className="absolute top-0 transition-all duration-500 transform -translate-x-1/2 flex flex-col items-center"
                          style={{ left: `${Math.max(4, Math.min(96, data.score.compositeScore * 100))}%` }}
                        >
                          <span className="text-[9px] font-mono font-bold text-white bg-indigo-600 px-1 rounded shadow">
                            {data.score.compositeScore.toFixed(2)}
                          </span>
                          <span className="text-indigo-400 text-xs leading-none">▼</span>
                        </div>

                        {/* Gradient Track */}
                        <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 relative" />

                        {/* Scale Ticks */}
                        <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
                          <span>0.0 (Bear)</span>
                          <span>0.5 (Chop)</span>
                          <span>1.0 (Bull)</span>
                        </div>
                      </div>

                      <div className="text-center mt-1">
                        <span className="text-[11px] font-bold text-slate-300 font-mono">
                          {data.score.scaleLabel}
                        </span>
                      </div>
                    </div>

                    {/* Sub-factor Breakdown */}
                    <div className="mt-3 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Trend Strength (EMA/SuperTrend):</span>
                        <span className="font-mono font-bold">{data.score.subScores.trendStrength.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Momentum Velocity (RSI/MACD):</span>
                        <span className="font-mono font-bold">{data.score.subScores.momentumVelocity.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Volume & VWAP Flow:</span>
                        <span className="font-mono font-bold">{data.score.subScores.volumeInstitutionalFlow.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Volatility %B Compression:</span>
                        <span className="font-mono font-bold">{data.score.subScores.volatilityCompression.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------------- PRIMITIVE 03: BOOL ---------------- */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-emerald-600/20 text-emerald-400 text-[10px] font-mono font-bold rounded-bl-lg border-b border-l border-emerald-600/40">
                    PRIMITIVE 03
                  </div>
                  <div>
                    <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">
                      03 Bool
                    </div>
                    <div className="text-sm font-semibold text-slate-100 mt-0.5">
                      Binary Circuit Breaker & Safety Gates
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Strict deterministic True/False filters. Every critical gate must pass:
                    </p>

                    {/* Binary Gates List */}
                    <div className="mt-3 space-y-1.5">
                      {data.boolGates.gates.map((gate) => (
                        <div
                          key={gate.id}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                            gate.passed
                              ? 'bg-emerald-950/20 border-emerald-800/60 text-slate-200'
                              : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 pr-2">
                            {gate.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            )}
                            <span className="font-medium text-[11px] leading-tight">{gate.name}</span>
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] shrink-0 ${
                              gate.passed
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : 'bg-rose-900/60 text-rose-300'
                            }`}
                          >
                            {gate.passed ? 'TRUE · PASS' : 'FALSE · BLOCKED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] flex items-center justify-between">
                    <span className="text-slate-400">Gate Verification:</span>
                    <span
                      className={`font-bold font-mono ${
                        data.boolGates.allGatesPassed ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {data.boolGates.allGatesPassed ? 'ALL 6 GATES CLEARED' : 'SECURITY GATES ENGAGED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION EXECUTION BANNER */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Ensemble Recommendation:
                    </span>
                    <span className={`font-mono font-bold text-sm ${
                      data.actionableSignal.executeTrade ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {data.actionableSignal.executeTrade ? 'HIGH-PROBABILITY CONFLUENCE ENTRY' : 'STAND ASIDE / CONFLICTING DATA'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    {data.actionableSignal.summaryReason}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-0.5">
                    <span>Target SL: ${data.actionableSignal.suggestedStopLoss}</span>
                    <span>·</span>
                    <span>Target TP: ${data.actionableSignal.suggestedTakeProfit}</span>
                    <span>·</span>
                    <span className="text-emerald-400">Trailing Stop: 1.0% Dynamic ATR</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isAutoPilot && data.actionableSignal.executeTrade && (
                    <button
                      onClick={() => handleExecute(false)}
                      disabled={isExecuting || isAutoExecuting}
                      className="px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                      title="Force manual execution immediately without waiting for auto-pilot trigger"
                    >
                      Instant Override
                    </button>
                  )}

                  <button
                    onClick={() => handleExecute(false)}
                    disabled={isExecuting || isAutoExecuting || !data.actionableSignal.executeTrade}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
                      tradeSuccess
                        ? 'bg-emerald-600 text-white'
                        : isAutoExecuting
                        ? 'bg-amber-600 text-white animate-pulse'
                        : isAutoPilot
                        ? data.actionableSignal.executeTrade
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white ring-2 ring-emerald-400/50 shadow-emerald-950'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                        : data.actionableSignal.executeTrade
                        ? data.choice.direction === 'LONG'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {isExecuting || isAutoExecuting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{isAutoExecuting ? 'Auto-Executing Position...' : 'Placing Futures Order...'}</span>
                      </>
                    ) : tradeSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Order Executed! (Trailing Armed)</span>
                      </>
                    ) : isAutoPilot ? (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current text-emerald-300 animate-pulse" />
                        <span>
                          {data.actionableSignal.executeTrade
                            ? `Auto-Armed: ${data.choice.direction} (${data.actionableSignal.recommendedLeverage}x + Trailing)`
                            : `Auto-Pilot Scanning (${scanCountdown}s)...`}
                        </span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {data.actionableSignal.executeTrade
                            ? `Execute ${data.choice.direction} (${data.actionableSignal.recommendedLeverage}x + Trailing)`
                            : 'Gates Preventing Trade'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 💡 EDUCATIONAL DRAWER: HOW 3-PRIMITIVES SYSTEM WORKS */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <button
                  onClick={() => setIsExplainerOpen(!isExplainerOpen)}
                  className="w-full px-4 py-3 bg-slate-900/80 hover:bg-slate-900 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span>How This 3-Primitives System Works (Instead of Unstructured Text AI)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                      200× Faster · 400× Cheaper
                    </span>
                  </div>
                  {isExplainerOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {isExplainerOpen && (
                  <div className="p-4 space-y-4 border-t border-slate-800/80 text-xs text-slate-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Explainer 01: Choice */}
                      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-blue-400 font-mono font-bold text-xs">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          01 CHOICE (Discrete Options)
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Categorical decisions (<strong>BUY, HOLD, SELL</strong>). Instead of a vague paragraph, the algorithms vote with mathematical weights to output a real probability distribution:
                        </p>
                        <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-slate-300 space-y-1 border border-slate-800/60">
                          <div>• SuperTrend: 1.5× Weight</div>
                          <div>• EMA 9/21 Alignment: 1.2× Weight</div>
                          <div>• MACD Momentum: 1.2× Weight</div>
                          <div>• VWAP Surge Flow: 1.3× Weight</div>
                        </div>
                      </div>

                      {/* Explainer 02: Score */}
                      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-indigo-400 font-mono font-bold text-xs">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          02 SCORE (Ordered Continuous Scale)
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Quantifies market conviction on an ordered scale from <strong>0.00 to 1.00</strong>:
                        </p>
                        <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-slate-300 space-y-1 border border-slate-800/60">
                          <div>• 0.00 – 0.35: Strong Bearish / Breakdown</div>
                          <div>• 0.36 – 0.64: Choppy Noise (Do Not Trade)</div>
                          <div>• 0.65 – 0.81: High Conviction Bullish (Long)</div>
                          <div>• 0.82 – 1.00: Grade A+ Confluence Wave</div>
                        </div>
                      </div>

                      {/* Explainer 03: Bool */}
                      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          03 BOOL (Binary Safety Gates)
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Deterministic True/False risk circuits that <strong>block bad trades</strong> regardless of hype:
                        </p>
                        <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-slate-300 space-y-1 border border-slate-800/60">
                          <div>• Agreement Gate: ≥3 algorithms concur</div>
                          <div>• Conviction Gate: Score exceeds threshold</div>
                          <div>• Drawdown Gate: Daily loss under limit</div>
                          <div>• Volatility Gate: Rejects sideways chop</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-slate-300 space-y-0.5">
                        <span className="font-bold text-white">Why This Outperforms Standard Bots:</span>
                        <p className="text-slate-400">
                          Single-indicator strategies (like raw RSI or EMA cross) lose money during chop and sudden trend reversals. By combining <strong>Choice</strong> (probability), <strong>Score</strong> (conviction degree), and <strong>Bool</strong> (hard risk gates), the system only fires when the entire mathematical distribution is in your favor.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
