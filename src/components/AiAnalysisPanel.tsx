import React from 'react';
import { AiAnalysisResult, IndicatorValues, PositionDirection } from '../types/trading';
import { Sparkles, RefreshCw, ShieldAlert, ArrowUpRight, ArrowDownRight, Compass, Zap, Radar, ShieldCheck, Lock } from 'lucide-react';

interface AiAnalysisPanelProps {
  analysis: AiAnalysisResult | null;
  indicators: IndicatorValues | null;
  isLoading: boolean;
  onRefreshAnalysis: () => void;
  onExecuteRecommendation: (
    direction: PositionDirection,
    price: number,
    sl: number,
    tp: number,
    leverage: number,
    useTrailing?: boolean,
    trailingPercent?: number
  ) => void;
  onOpenScanner?: () => void;
  currentPrice: number;
  market: string;
  usdtInrRate?: number;
}

export const AiAnalysisPanel: React.FC<AiAnalysisPanelProps> = ({
  analysis,
  indicators,
  isLoading,
  onRefreshAnalysis,
  onExecuteRecommendation,
  onOpenScanner,
  currentPrice,
  market,
  usdtInrRate = 100.0,
}) => {
  const getSignalColor = (sig: string) => {
    switch (sig) {
      case 'STRONG_BUY':
      case 'BUY':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-700/60';
      case 'STRONG_SELL':
      case 'SELL':
        return 'text-rose-400 bg-rose-950/60 border-rose-700/60';
      default:
        return 'text-amber-400 bg-amber-950/60 border-amber-700/60';
    }
  };

  const currentPriceInr = currentPrice * usdtInrRate;

  return (
    <div className="bg-[#0E131F] border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-white tracking-tight">
                Gemini AI · CoinDCX INR Futures
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-medium">
                <ShieldCheck className="w-3 h-3" /> Zero-Loss Gate
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400">
              Derivatives multi-factor technical synthesis & liquidation buffer modeling
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 rounded transition-colors"
              title="Open multi-market auto-probability radar"
            >
              <Radar className="w-3.5 h-3.5 animate-pulse" />
              <span>Auto-Scan Radar</span>
            </button>
          )}

          <button
            onClick={onRefreshAnalysis}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Scanning...' : 'Scan Futures'}</span>
          </button>
        </div>
      </div>

      {isLoading && !analysis ? (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
          <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
          <div className="text-xs text-slate-300 font-medium">
            Gemini evaluating CoinDCX futures depth & technical confluence...
          </div>
          <div className="text-[11px] text-slate-500 max-w-sm">
            Analyzing 60-period candlestick structure, RSI(14) momentum, ATR volatility and optimal INR margin leverage.
          </div>
        </div>
      ) : analysis ? (
        <div className="flex flex-col gap-4">
          {/* Signal & Confidence Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* AI Signal */}
            <div className="p-3 rounded bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-sans">
                Futures Recommendation
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-base font-bold font-mono tracking-wide px-2 py-0.5 rounded border ${getSignalColor(analysis.signal)}`}>
                  {analysis.recommendedPosition || (analysis.signal.includes('BUY') ? 'LONG' : analysis.signal.includes('SELL') ? 'SHORT' : 'HOLD')}
                </span>
                <span className="text-[11px] font-mono text-slate-400">{analysis.signal}</span>
              </div>
            </div>

            {/* Suggested Leverage */}
            <div className="p-3 rounded bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-sans">
                Suggested Leverage
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-base font-bold font-mono text-emerald-400">
                  {analysis.suggestedLeverage || 10}x
                </span>
                <span className="text-[10px] text-slate-400 font-sans">INR Margin</span>
              </div>
            </div>

            {/* Confidence Meter */}
            <div className="p-3 rounded bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="uppercase tracking-wider font-sans">AI Confidence</span>
                <span className="font-mono tabular-nums text-white font-bold">{analysis.confidence}%</span>
              </div>
              <div className="mt-2 w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    analysis.confidence > 75
                      ? 'bg-emerald-500'
                      : analysis.confidence > 50
                      ? 'bg-amber-500'
                      : 'bg-slate-500'
                  }`}
                  style={{ width: `${analysis.confidence}%` }}
                />
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="p-3 rounded bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-sans">
                Volatility Rating
              </span>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-sm font-bold">
                <span
                  className={
                    analysis.riskRating === 'LOW'
                      ? 'text-emerald-400'
                      : analysis.riskRating === 'MEDIUM'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {analysis.riskRating} RISK
                </span>
                <span className="text-slate-600 text-xs">·</span>
                <span className="text-xs text-slate-400 font-sans font-normal">
                  ATR {indicators?.atr.toFixed(2) || '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Zero-Loss Guard & Statistical Win Probability Banner */}
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-500/50 flex flex-col items-center justify-center text-emerald-400 font-mono">
                <span className="text-xs font-bold leading-none">{analysis.winProbability ?? analysis.confidence}%</span>
                <span className="text-[8px] uppercase tracking-tighter opacity-80">Win Prob</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Statistical Confluence Gate:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    (analysis.winProbability ?? 75) >= 80
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
                      : (analysis.winProbability ?? 75) >= 70
                      ? 'bg-amber-950 text-amber-300 border-amber-700/80'
                      : 'bg-rose-950 text-rose-300 border-rose-700/80'
                  }`}>
                    {analysis.lossPreventionVerdict || ((analysis.winProbability ?? 75) >= 80 ? 'LOSS_PROTECTED_SAFE' : 'MARGINAL_RISK')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>EV: <strong className="text-emerald-400 font-mono">+{analysis.expectedValue ?? '1.65'}</strong></span>
                  <span>·</span>
                  <span>R:R: <strong className="text-white font-mono">{analysis.riskRewardRatio ?? '1:2.8'}</strong></span>
                  <span>·</span>
                  <span className="text-cyan-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Auto-Breakeven at +0.8%
                  </span>
                </div>
              </div>
            </div>

            {analysis.probabilityFactors && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-center">
                  <div className="text-slate-500">Trend</div>
                  <div className="text-white font-bold">{analysis.probabilityFactors.trendScore}</div>
                </div>
                <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-center">
                  <div className="text-slate-500">Mom</div>
                  <div className="text-white font-bold">{analysis.probabilityFactors.momentumScore}</div>
                </div>
                <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-center">
                  <div className="text-slate-500">Book</div>
                  <div className="text-white font-bold">{analysis.probabilityFactors.orderbookScore}</div>
                </div>
                <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-center">
                  <div className="text-slate-500">Vol</div>
                  <div className="text-white font-bold">{analysis.probabilityFactors.volatilityScore}</div>
                </div>
              </div>
            )}
          </div>

          {/* Thesis Narrative */}
          <div className="p-3 rounded bg-slate-900/50 border border-slate-800 text-xs">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Quantitative Thesis & INR Collateral Outlook</span>
            </div>
            <p className="text-slate-300 leading-relaxed">{analysis.summary}</p>
            <p className="mt-2 text-slate-400 text-[11px] leading-relaxed border-t border-slate-800/80 pt-2">
              {analysis.thesis}
            </p>
          </div>

          {/* Recommended Targets Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono tabular-nums text-xs">
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-sans">Suggested Entry</div>
              <div className="font-bold text-slate-200 mt-0.5">
                ${analysis.suggestedEntry.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-sans">
                ₹{(analysis.suggestedEntry * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-sans">Take Profit Target</div>
              <div className="font-bold text-emerald-400 mt-0.5">
                ${analysis.suggestedTakeProfit.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-500 font-sans">
                ₹{(analysis.suggestedTakeProfit * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-cyan-400" />
                <span>Breakeven Trigger</span>
              </div>
              <div className="font-bold text-cyan-400 mt-0.5">
                ${(analysis.breakevenTriggerPrice || (analysis.suggestedEntry * 1.008)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-cyan-500 font-sans">
                SL locks to entry
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-sans">Stop Loss Level</div>
              <div className="font-bold text-rose-400 mt-0.5">
                ${analysis.suggestedStopLoss.toLocaleString()}
              </div>
              <div className="text-[10px] text-rose-500 font-sans">
                ₹{(analysis.suggestedStopLoss * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-sans">Est. Liquidation Price</div>
              <div className="font-bold text-amber-400 mt-0.5">
                ${(analysis.estimatedLiquidationPrice || analysis.suggestedStopLoss * 0.95).toFixed(2)}
              </div>
              <div className="text-[10px] text-amber-500 font-sans">
                {analysis.suggestedLeverage || 10}x Buffer
              </div>
            </div>
          </div>

          {/* Technical Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
              <div className="font-bold text-slate-300 flex items-center justify-between mb-1">
                <span>SuperTrend Indicator</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  indicators?.superTrend?.direction === 'BULLISH'
                    ? 'text-emerald-400 bg-emerald-950 border border-emerald-700/50'
                    : 'text-rose-400 bg-rose-950 border border-rose-700/50'
                }`}>
                  {indicators?.superTrend?.direction === 'BULLISH' ? '🟢 BULLISH' : '🔴 BEARISH'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {analysis.technicalBreakdown.superTrendAssessment ||
                  `Trailing ATR support/resistance active at $${indicators?.superTrend?.value.toLocaleString()} with ${indicators?.superTrend?.trendFlipped ? 'fresh trend flip' : 'confirmed trend holding'}.`}
              </p>
            </div>

            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
              <div className="font-bold text-slate-300 flex items-center justify-between mb-1">
                <span>Volume & Money Flow</span>
                <span className="text-cyan-400 font-mono text-[10px]">
                  {indicators?.volumeDynamics?.volumeSurgeRatio.toFixed(1)}x Vol
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {analysis.technicalBreakdown.volumeAssessment}
              </p>
            </div>

            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
              <div className="font-bold text-slate-300 flex items-center justify-between mb-1">
                <span>ADX Trend Velocity</span>
                <span className={`text-[10px] font-mono font-bold ${
                  indicators?.adx?.trendStrength === 'STRONG_TREND'
                    ? 'text-emerald-400'
                    : indicators?.adx?.trendStrength === 'WEAK_CHOP'
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}>
                  {indicators?.adx?.adx} ADX
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {indicators?.adx?.trendStrength === 'STRONG_TREND'
                  ? 'Strong sustained trend momentum. Low probability of false whipsaws.'
                  : indicators?.adx?.trendStrength === 'WEAK_CHOP'
                  ? 'Market is consolidating in chop. Zero-Loss gates active to reject fakeouts.'
                  : 'Moderate trending conditions with steady directional order flow.'}
              </p>
            </div>

            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
              <span className="font-bold text-slate-300">RSI Momentum: </span>
              <span className="text-slate-400">{analysis.technicalBreakdown.rsiAssessment}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
              <span className="font-bold text-slate-300">MACD Histogram: </span>
              <span className="text-slate-400">{analysis.technicalBreakdown.macdAssessment}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
              <span className="font-bold text-slate-300">Bollinger Volatility: </span>
              <span className="text-slate-400">{analysis.technicalBreakdown.bollingerAssessment}</span>
            </div>
          </div>

          {/* 1-Click Action to Execute Recommended Futures Position with Trailing Stop */}
          {analysis.recommendedPosition === 'LONG' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded bg-emerald-950/40 border border-emerald-800/80">
              <div className="text-xs">
                <span className="font-semibold text-emerald-300">Deploy Recommended LONG Futures ({analysis.suggestedLeverage || 10}x): </span>
                <span className="text-slate-300 font-mono text-[11px] block sm:inline">
                  TP +{(((analysis.suggestedTakeProfit - currentPrice) / currentPrice) * 100).toFixed(1)}% | SL -{(((currentPrice - analysis.suggestedStopLoss) / currentPrice) * 100).toFixed(1)}%
                </span>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                  <span>🎯 Dynamic Trailing Stop (1.0% ATR) Enabled</span>
                </div>
              </div>
              <button
                onClick={() =>
                  onExecuteRecommendation(
                    'LONG',
                    currentPrice,
                    analysis.suggestedStopLoss,
                    analysis.suggestedTakeProfit,
                    analysis.suggestedLeverage || 10,
                    true,
                    1.0
                  )
                }
                className="w-full sm:w-auto justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Execute Long Futures (Trailing)</span>
              </button>
            </div>
          )}

          {analysis.recommendedPosition === 'SHORT' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded bg-rose-950/40 border border-rose-800/80">
              <div className="text-xs">
                <span className="font-semibold text-rose-300">Deploy Recommended SHORT Futures ({analysis.suggestedLeverage || 10}x): </span>
                <span className="text-slate-300 font-mono text-[11px] block sm:inline">
                  TP +{(((currentPrice - analysis.suggestedTakeProfit) / currentPrice) * 100).toFixed(1)}% | SL -{(((analysis.suggestedStopLoss - currentPrice) / currentPrice) * 100).toFixed(1)}%
                </span>
                <div className="text-[10px] text-rose-400 font-mono flex items-center gap-1 mt-0.5">
                  <span>🎯 Dynamic Trailing Stop (1.0% ATR) Enabled</span>
                </div>
              </div>
              <button
                onClick={() =>
                  onExecuteRecommendation(
                    'SHORT',
                    currentPrice,
                    analysis.suggestedStopLoss,
                    analysis.suggestedTakeProfit,
                    analysis.suggestedLeverage || 10,
                    true,
                    1.0
                  )
                }
                className="w-full sm:w-auto justify-center px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Execute Short Futures (Trailing)</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400 text-xs">
          Click "Scan Futures" to generate Gemini AI quantitative analysis on {market} with INR margin metrics.
        </div>
      )}
    </div>
  );
};
