import React, { useState, useRef, useMemo } from 'react';
import { Candle, IndicatorValues, Position, Trade } from '../types/trading';
import {
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateSuperTrend,
  calculateVWAP,
} from '../utils/indicators';
import { Layers, Eye, EyeOff, Maximize2, TrendingUp, BarChart2, Zap } from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  indicators: IndicatorValues | null;
  positions: Position[];
  trades: Trade[];
  market: string;
  timeframe: string;
  isLoading: boolean;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  indicators,
  positions,
  trades,
  market,
  timeframe,
  isLoading,
}) => {
  const [showSuperTrend, setShowSuperTrend] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showEMAs, setShowEMAs] = useState(true);
  const [showRsiSubPanel, setShowRsiSubPanel] = useState(true);
  const [showMacdSubPanel, setShowMacdSubPanel] = useState(false);
  const [showTrailingOverlay, setShowTrailingOverlay] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Compute arrays for chart overlays
  const {
    closes,
    volumes,
    times,
    ema9Arr,
    ema21Arr,
    bbUpperArr,
    bbLowerArr,
    bbMiddleArr,
    rsiArr,
    macdData,
    superTrendData,
    vwapArr,
  } = useMemo(() => {
    const c = candles.map((item) => item.close);
    const v = candles.map((item) => item.volume);
    const t = candles.map((item) => item.time);

    const ema9 = calculateEMA(c, 9);
    const ema21 = calculateEMA(c, 21);
    const bb = calculateBollingerBands(c, 20, 2);
    const rsi = calculateRSI(c, 14);
    const macd = calculateMACD(c, 12, 26, 9);
    const superTrend = calculateSuperTrend(candles, 10, 3.0);
    const vwap = calculateVWAP(candles);

    return {
      closes: c,
      volumes: v,
      times: t,
      ema9Arr: ema9,
      ema21Arr: ema21,
      bbUpperArr: bb.upper,
      bbLowerArr: bb.lower,
      bbMiddleArr: bb.middle,
      rsiArr: rsi,
      macdData: macd,
      superTrendData: superTrend,
      vwapArr: vwap,
    };
  }, [candles]);

  // Chart dimensions & scaling
  const width = 900;
  const mainHeight = showRsiSubPanel && showMacdSubPanel ? 280 : showRsiSubPanel || showMacdSubPanel ? 340 : 420;
  const subHeight = 80;
  const paddingRight = 65;
  const paddingLeft = 10;
  const paddingTop = 25;
  const paddingBottom = 20;

  const visibleCandles = candles.slice(-60); // Show last 60 candles
  const visibleStartIndex = Math.max(0, candles.length - 60);

  // Find min and max for main price scale
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let maxVolume = 0;

  for (let i = 0; i < visibleCandles.length; i++) {
    const c = visibleCandles[i];
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    if (c.volume > maxVolume) maxVolume = c.volume;

    const globalIdx = visibleStartIndex + i;
    if (showBollinger) {
      if (!isNaN(bbUpperArr[globalIdx]) && bbUpperArr[globalIdx] > maxPrice) maxPrice = bbUpperArr[globalIdx];
      if (!isNaN(bbLowerArr[globalIdx]) && bbLowerArr[globalIdx] < minPrice) minPrice = bbLowerArr[globalIdx];
    }
    if (showSuperTrend && superTrendData) {
      const stVal = superTrendData.values[globalIdx];
      if (!isNaN(stVal)) {
        if (stVal > maxPrice) maxPrice = stVal;
        if (stVal < minPrice) minPrice = stVal;
      }
    }
    if (showVwap && vwapArr) {
      const vw = vwapArr[globalIdx];
      if (!isNaN(vw)) {
        if (vw > maxPrice) maxPrice = vw;
        if (vw < minPrice) minPrice = vw;
      }
    }
  }

  if (minPrice === Infinity || maxPrice === -Infinity) {
    minPrice = 1;
    maxPrice = 2;
  }

  // Add 4% padding to top and bottom of price axis
  const priceMargin = (maxPrice - minPrice) * 0.05 || 1;
  const priceScaleMin = minPrice - priceMargin;
  const priceScaleMax = maxPrice + priceMargin;
  const priceRange = priceScaleMax - priceScaleMin;

  const chartInnerWidth = width - paddingLeft - paddingRight;
  const candleSlotWidth = visibleCandles.length > 0 ? chartInnerWidth / visibleCandles.length : 10;
  const candleBodyWidth = Math.max(2, candleSlotWidth * 0.65);

  const getY = (val: number) => {
    return paddingTop + (1 - (val - priceScaleMin) / priceRange) * (mainHeight - paddingTop - paddingBottom);
  };

  const getX = (index: number) => {
    return paddingLeft + index * candleSlotWidth + candleSlotWidth / 2;
  };

  // Build SVG path for continuous lines
  const buildLinePath = (arr: number[]) => {
    let path = '';
    for (let i = 0; i < visibleCandles.length; i++) {
      const gIdx = visibleStartIndex + i;
      const val = arr[gIdx];
      if (isNaN(val)) continue;
      const x = getX(i);
      const y = getY(val);
      if (!path) path += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  };

  // Build shaded polygon between upper and lower Bollinger bands
  const buildBollingerBandShade = () => {
    const upperPoints: string[] = [];
    const lowerPoints: string[] = [];

    for (let i = 0; i < visibleCandles.length; i++) {
      const gIdx = visibleStartIndex + i;
      const u = bbUpperArr[gIdx];
      const l = bbLowerArr[gIdx];
      if (isNaN(u) || isNaN(l)) continue;
      const x = getX(i).toFixed(1);
      upperPoints.push(`${x},${getY(u).toFixed(1)}`);
      lowerPoints.unshift(`${x},${getY(l).toFixed(1)}`);
    }

    if (upperPoints.length < 2) return '';
    return `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
  };

  // RSI Sub-Panel Path
  const buildRsiPath = () => {
    let path = '';
    for (let i = 0; i < visibleCandles.length; i++) {
      const gIdx = visibleStartIndex + i;
      const r = rsiArr[gIdx];
      if (isNaN(r)) continue;
      const x = getX(i);
      // Map 0-100 to subHeight
      const y = 10 + (1 - r / 100) * (subHeight - 20);
      if (!path) path += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  };

  // Active Candle to display on HUD (hovered or latest)
  const activeCandleIndex =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < visibleCandles.length
      ? hoverIndex
      : visibleCandles.length - 1;
  const activeCandle = visibleCandles[activeCandleIndex];
  const activeGlobalIndex = visibleStartIndex + activeCandleIndex;

  // Horizontal price grid lines
  const priceGridSteps = 5;
  const priceGridValues = Array.from({ length: priceGridSteps }).map((_, idx) => {
    return priceScaleMin + (priceRange / (priceGridSteps - 1)) * idx;
  });

  return (
    <div className="flex flex-col bg-[#0B0E14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Chart Top Controls & HUD */}
      <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Candle Data HUD */}
        {activeCandle ? (
          <div className="flex items-center gap-3 font-mono tabular-nums text-[11px] text-slate-300">
            <span className="font-semibold text-white">{market}</span>
            <span className="text-slate-500">[{timeframe}]</span>
            <span>
              O: <span className="text-slate-200">{activeCandle.open.toLocaleString()}</span>
            </span>
            <span>
              H: <span className="text-slate-200">{activeCandle.high.toLocaleString()}</span>
            </span>
            <span>
              L: <span className="text-slate-200">{activeCandle.low.toLocaleString()}</span>
            </span>
            <span>
              C:{' '}
              <span
                className={`font-bold ${
                  activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeCandle.close.toLocaleString()}
              </span>
            </span>
            <span className="hidden sm:inline text-slate-400">
              Vol: {activeCandle.volume.toFixed(2)}
            </span>
          </div>
        ) : (
          <span className="text-slate-500 font-mono">Loading chart stream...</span>
        )}

        {/* Indicators Overlay Toggle Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full shrink-0">
          <button
            onClick={() => setShowSuperTrend(!showSuperTrend)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
              showSuperTrend
                ? indicators?.superTrend?.direction === 'BULLISH'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                  : 'bg-rose-950 text-rose-300 border border-rose-600'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${indicators?.superTrend?.direction === 'BULLISH' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            SuperTrend
          </button>

          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showVwap
                ? 'bg-purple-950 text-purple-300 border border-purple-600'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            VWAP
          </button>

          <button
            onClick={() => setShowEMAs(!showEMAs)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showEMAs
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            EMA (9/21)
          </button>

          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showBollinger
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Bollinger
          </button>

          <button
            onClick={() => setShowRsiSubPanel(!showRsiSubPanel)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showRsiSubPanel
                ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            RSI
          </button>

          <button
            onClick={() => setShowMacdSubPanel(!showMacdSubPanel)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showMacdSubPanel
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            MACD
          </button>

          <button
            onClick={() => setShowTrailingOverlay(!showTrailingOverlay)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
              showTrailingOverlay
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-600'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Trailing Stop-Loss, TP, and Liq Price Lines on Chart"
          >
            <span className="text-xs">🎯</span>
            <span>Trail SL Lines</span>
          </button>
        </div>
      </div>

      {/* Live Technical Indicators Confluence Ticker Strip */}
      {indicators && (
        <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] flex items-center justify-between gap-3 overflow-x-auto font-mono">
          <div className="flex items-center gap-4 shrink-0">
            {/* SuperTrend */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-sans">SuperTrend:</span>
              <span
                className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                  indicators.superTrend?.direction === 'BULLISH'
                    ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-700/50'
                    : 'text-rose-400 bg-rose-950/80 border border-rose-700/50'
                }`}
              >
                {indicators.superTrend?.direction === 'BULLISH' ? '🟢 BULLISH' : '🔴 BEARISH'} ($
                {indicators.superTrend?.value.toLocaleString()})
              </span>
            </div>

            {/* Volume Dynamics */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-sans">Vol Surge:</span>
              <span
                className={`font-bold ${
                  indicators.volumeDynamics?.volumeSurgeRatio >= 1.3
                    ? 'text-emerald-400'
                    : indicators.volumeDynamics?.volumeSurgeRatio <= 0.7
                    ? 'text-slate-400'
                    : 'text-cyan-400'
                }`}
              >
                {indicators.volumeDynamics?.volumeSurgeRatio.toFixed(2)}x
              </span>
              <span className="text-slate-500">
                ({indicators.volumeDynamics?.volumeTrend})
              </span>
            </div>

            {/* VWAP */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-sans">VWAP:</span>
              <span className="text-purple-300 font-bold">
                ${indicators.volumeDynamics?.vwap.toFixed(2)}
              </span>
              <span
                className={`text-[10px] ${
                  indicators.volumeDynamics?.priceVsVwapPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ({indicators.volumeDynamics?.priceVsVwapPercent >= 0 ? '+' : ''}
                {indicators.volumeDynamics?.priceVsVwapPercent}%)
              </span>
            </div>

            {/* ADX Trend Strength */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-sans">ADX:</span>
              <span
                className={`font-bold ${
                  indicators.adx?.trendStrength === 'STRONG_TREND'
                    ? 'text-emerald-400'
                    : indicators.adx?.trendStrength === 'WEAK_CHOP'
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                {indicators.adx?.adx}
              </span>
              <span className="text-[10px] text-slate-500">
                {indicators.adx?.trendStrength === 'STRONG_TREND'
                  ? '⚡ TRENDING'
                  : indicators.adx?.trendStrength === 'WEAK_CHOP'
                  ? '⚠️ CHOP'
                  : 'MODERATE'}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 shrink-0 font-sans">
            Confluence Engine Active
          </div>
        </div>
      )}

      {/* Main SVG Chart Area */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden touch-pan-y"
        onMouseMove={(e) => {
          if (!containerRef.current || visibleCandles.length === 0) return;
          const rect = containerRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const relX = mouseX - (paddingLeft * rect.width) / width;
          const slotW = (chartInnerWidth * rect.width) / width / visibleCandles.length;
          const idx = Math.floor(relX / slotW);
          if (idx >= 0 && idx < visibleCandles.length) {
            setHoverIndex(idx);
          }
        }}
        onMouseLeave={() => setHoverIndex(null)}
        onTouchStart={(e) => {
          if (!containerRef.current || visibleCandles.length === 0) return;
          const touch = e.touches[0];
          const rect = containerRef.current.getBoundingClientRect();
          const mouseX = touch.clientX - rect.left;
          const relX = mouseX - (paddingLeft * rect.width) / width;
          const slotW = (chartInnerWidth * rect.width) / width / visibleCandles.length;
          const idx = Math.floor(relX / slotW);
          if (idx >= 0 && idx < visibleCandles.length) {
            setHoverIndex(idx);
          }
        }}
        onTouchMove={(e) => {
          if (!containerRef.current || visibleCandles.length === 0) return;
          const touch = e.touches[0];
          const rect = containerRef.current.getBoundingClientRect();
          const mouseX = touch.clientX - rect.left;
          const relX = mouseX - (paddingLeft * rect.width) / width;
          const slotW = (chartInnerWidth * rect.width) / width / visibleCandles.length;
          const idx = Math.floor(relX / slotW);
          if (idx >= 0 && idx < visibleCandles.length) {
            setHoverIndex(idx);
          }
        }}
        onTouchEnd={() => setHoverIndex(null)}
      >
        {isLoading && candles.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-slate-500 font-mono text-xs">
            Connecting to CoinDCX Candle Stream...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${
              mainHeight + (showRsiSubPanel ? subHeight : 0) + (showMacdSubPanel ? subHeight : 0)
            }`}
            className="w-full h-auto block"
          >
            <defs>
              {/* Bollinger Bands translucent gradient fill */}
              <linearGradient id="bbGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {/* Price Grid Horizontal Lines & Price Labels */}
            {priceGridValues.map((val, idx) => {
              const y = getY(val);
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="#1E293B"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={width - paddingRight + 6}
                    y={y + 3}
                    fill="#64748B"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {val >= 1000 ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : val.toFixed(4)}
                  </text>
                </g>
              );
            })}

            {/* Enhanced Volume Histogram with Volume Surge Highlighting */}
            {visibleCandles.map((c, idx) => {
              const x = getX(idx);
              const volHeight = maxVolume > 0 ? (c.volume / maxVolume) * 50 : 0;
              const y = mainHeight - paddingBottom - volHeight;
              const isBull = c.close >= c.open;
              const gIdx = visibleStartIndex + idx;
              const recentVols = volumes.slice(Math.max(0, gIdx - 20), gIdx);
              const avgVol = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 1;
              const isSurge = c.volume >= avgVol * 1.35;

              return (
                <g key={`vol-${idx}`}>
                  <rect
                    x={x - candleBodyWidth / 2}
                    y={y}
                    width={candleBodyWidth}
                    height={Math.max(1, volHeight)}
                    fill={isBull ? (isSurge ? '#10B981' : '#059669') : (isSurge ? '#F43F5E' : '#DC2626')}
                    stroke={isSurge ? (isBull ? '#34D399' : '#FB7185') : undefined}
                    strokeWidth={isSurge ? 1 : 0}
                    opacity={isSurge ? 0.75 : 0.3}
                  />
                  {isSurge && (
                    <circle cx={x} cy={y - 3} r="1.5" fill={isBull ? '#10B981' : '#F43F5E'} />
                  )}
                </g>
              );
            })}

            {/* Bollinger Bands Shaded Area & Lines */}
            {showBollinger && (
              <>
                <path d={buildBollingerBandShade()} fill="url(#bbGradient)" />
                <path
                  d={buildLinePath(bbUpperArr)}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="1.2"
                  strokeOpacity="0.8"
                />
                <path
                  d={buildLinePath(bbMiddleArr)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity="0.6"
                />
                <path
                  d={buildLinePath(bbLowerArr)}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="1.2"
                  strokeOpacity="0.8"
                />
              </>
            )}

            {/* Institutional VWAP Line */}
            {showVwap && (
              <path
                d={buildLinePath(vwapArr)}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                strokeOpacity="0.9"
              />
            )}

            {/* EMA Lines */}
            {showEMAs && (
              <>
                <path
                  d={buildLinePath(ema9Arr)}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                  strokeOpacity="0.9"
                />
                <path
                  d={buildLinePath(ema21Arr)}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeOpacity="0.9"
                />
              </>
            )}

            {/* SuperTrend Line (Green for Bullish Support, Red for Bearish Resistance) */}
            {showSuperTrend && superTrendData && (
              <g key="supertrend-layer">
                {visibleCandles.map((_, idx) => {
                  if (idx === 0) return null;
                  const gPrev = visibleStartIndex + idx - 1;
                  const gCurr = visibleStartIndex + idx;
                  const prevVal = superTrendData.values[gPrev];
                  const currVal = superTrendData.values[gCurr];
                  const dir = superTrendData.directions[gCurr];
                  if (isNaN(prevVal) || isNaN(currVal)) return null;

                  const x1 = getX(idx - 1);
                  const y1 = getY(prevVal);
                  const x2 = getX(idx);
                  const y2 = getY(currVal);
                  const color = dir === 'BULLISH' ? '#10B981' : '#F43F5E';

                  return (
                    <g key={`st-seg-${idx}`}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={color}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      {idx === visibleCandles.length - 1 && (
                        <circle cx={x2} cy={y2} r="3" fill={color} />
                      )}
                    </g>
                  );
                })}

                {/* SuperTrend Flip Badges */}
                {visibleCandles.map((c, idx) => {
                  const gIdx = visibleStartIndex + idx;
                  if (!superTrendData.trendFlips[gIdx]) return null;
                  const dir = superTrendData.directions[gIdx];
                  const x = getX(idx);
                  const isBuy = dir === 'BULLISH';
                  const y = isBuy ? getY(c.low) + 20 : getY(c.high) - 20;

                  return (
                    <g key={`st-flip-${idx}`}>
                      <rect
                        x={x - 20}
                        y={y - 7}
                        width="40"
                        height="14"
                        rx="3"
                        fill={isBuy ? '#065F46' : '#991B1B'}
                        stroke={isBuy ? '#10B981' : '#EF4444'}
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={y + 3}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {isBuy ? 'ST BUY' : 'ST SELL'}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Candlesticks (Wicks + Bodies) */}
            {visibleCandles.map((c, idx) => {
              const x = getX(idx);
              const isBull = c.close >= c.open;
              const color = isBull ? '#10B981' : '#F43F5E';

              const highY = getY(c.high);
              const lowY = getY(c.low);
              const openY = getY(c.open);
              const closeY = getY(c.close);

              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));

              return (
                <g key={`candle-${idx}`}>
                  {/* Wick */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  {/* Body */}
                  <rect
                    x={x - candleBodyWidth / 2}
                    y={bodyTop}
                    width={candleBodyWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="0.5"
                  />
                </g>
              );
            })}

            {/* Buy / Sell Execution Point & Trailing Stop Loss Lines for active positions on this market */}
            {positions
              .filter((p) => p.market === market)
              .map((pos) => {
                const entryY = getY(pos.entryPrice);
                const slY = pos.stopLossPrice ? getY(pos.stopLossPrice) : null;
                const tpY = pos.takeProfitPrice ? getY(pos.takeProfitPrice) : null;
                const liqY = pos.liquidationPrice ? getY(pos.liquidationPrice) : null;
                const isTrailing = pos.trailingStopLoss;
                const isLocked = pos.trailingProfitLockedInr && pos.trailingProfitLockedInr > 0;

                return (
                  <g key={pos.id}>
                    {/* Entry Price Line */}
                    <line
                      x1={paddingLeft}
                      y1={entryY}
                      x2={width - paddingRight}
                      y2={entryY}
                      stroke={pos.side === 'BUY' ? '#10B981' : '#EF4444'}
                      strokeWidth="1.2"
                      strokeDasharray="4 2"
                    />
                    <rect
                      x={width - paddingRight + 4}
                      y={entryY - 8}
                      width="58"
                      height="16"
                      fill={pos.side === 'BUY' ? '#065F46' : '#991B1B'}
                      rx="2"
                    />
                    <text
                      x={width - paddingRight + 7}
                      y={entryY + 3}
                      fill="#FFFFFF"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      ENTRY:{pos.entryPrice >= 1000 ? pos.entryPrice.toFixed(0) : pos.entryPrice.toFixed(1)}
                    </text>

                    {/* Trailing Stop Loss Line */}
                    {showTrailingOverlay && slY !== null && (
                      <g>
                        <line
                          x1={paddingLeft}
                          y1={slY}
                          x2={width - paddingRight}
                          y2={slY}
                          stroke={isTrailing ? (isLocked ? '#10B981' : '#06B6D4') : '#F43F5E'}
                          strokeWidth="1.5"
                          strokeDasharray="5 2.5"
                        />
                        <rect
                          x={width - paddingRight + 4}
                          y={slY - 8}
                          width="60"
                          height="16"
                          fill={isTrailing ? (isLocked ? '#065F46' : '#155E75') : '#881337'}
                          stroke={isTrailing ? '#22D3EE' : '#FB7185'}
                          strokeWidth="0.8"
                          rx="2"
                        />
                        <text
                          x={width - paddingRight + 7}
                          y={slY + 3}
                          fill="#FFFFFF"
                          fontSize="8"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {isTrailing ? '🎯TRAIL' : 'SL'}:{pos.stopLossPrice >= 1000 ? pos.stopLossPrice.toFixed(0) : pos.stopLossPrice.toFixed(1)}
                        </text>
                      </g>
                    )}

                    {/* Take Profit Target Line */}
                    {showTrailingOverlay && tpY !== null && (
                      <g>
                        <line
                          x1={paddingLeft}
                          y1={tpY}
                          x2={width - paddingRight}
                          y2={tpY}
                          stroke="#10B981"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          opacity="0.8"
                        />
                        <rect
                          x={width - paddingRight + 4}
                          y={tpY - 7}
                          width="52"
                          height="14"
                          fill="#064E3B"
                          rx="2"
                        />
                        <text
                          x={width - paddingRight + 7}
                          y={tpY + 3}
                          fill="#34D399"
                          fontSize="8"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          TP:{pos.takeProfitPrice >= 1000 ? pos.takeProfitPrice.toFixed(0) : pos.takeProfitPrice.toFixed(1)}
                        </text>
                      </g>
                    )}

                    {/* Liquidation Price Line */}
                    {showTrailingOverlay && liqY !== null && (
                      <g>
                        <line
                          x1={paddingLeft}
                          y1={liqY}
                          x2={width - paddingRight}
                          y2={liqY}
                          stroke="#E11D48"
                          strokeWidth="0.9"
                          strokeDasharray="2 3"
                          opacity="0.7"
                        />
                        <rect
                          x={width - paddingRight + 4}
                          y={liqY - 6}
                          width="48"
                          height="13"
                          fill="#4C0519"
                          rx="2"
                        />
                        <text
                          x={width - paddingRight + 6}
                          y={liqY + 3}
                          fill="#FDA4AF"
                          fontSize="7.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          LIQ:{pos.liquidationPrice >= 1000 ? pos.liquidationPrice.toFixed(0) : pos.liquidationPrice.toFixed(1)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

            {/* Crosshair on Hover */}
            {hoverIndex !== null && activeCandle && (
              <g>
                <line
                  x1={getX(hoverIndex)}
                  y1={paddingTop}
                  x2={getX(hoverIndex)}
                  y2={
                    mainHeight +
                    (showRsiSubPanel ? subHeight : 0) +
                    (showMacdSubPanel ? subHeight : 0)
                  }
                  stroke="#94A3B8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
                <line
                  x1={paddingLeft}
                  y1={getY(activeCandle.close)}
                  x2={width - paddingRight}
                  y2={getY(activeCandle.close)}
                  stroke="#94A3B8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
                {/* Crosshair Price Box on Right Axis */}
                <rect
                  x={width - paddingRight + 2}
                  y={getY(activeCandle.close) - 8}
                  width="60"
                  height="16"
                  fill="#0284C7"
                  rx="2"
                />
                <text
                  x={width - paddingRight + 6}
                  y={getY(activeCandle.close) + 3}
                  fill="#FFFFFF"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {activeCandle.close >= 1000
                    ? activeCandle.close.toFixed(1)
                    : activeCandle.close.toFixed(4)}
                </text>
              </g>
            )}

            {/* Sub-Panel 1: RSI (14) */}
            {showRsiSubPanel && (
              <g transform={`translate(0, ${mainHeight})`}>
                <rect
                  x={paddingLeft}
                  y="0"
                  width={chartInnerWidth}
                  height={subHeight}
                  fill="#080C14"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                {/* 70 Overbought & 30 Oversold dashed lines */}
                <line
                  x1={paddingLeft}
                  y1={10 + 0.3 * (subHeight - 20)}
                  x2={width - paddingRight}
                  y2={10 + 0.3 * (subHeight - 20)}
                  stroke="#EF4444"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />
                <text
                  x={width - paddingRight + 6}
                  y={13 + 0.3 * (subHeight - 20)}
                  fill="#EF4444"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  70
                </text>

                <line
                  x1={paddingLeft}
                  y1={10 + 0.7 * (subHeight - 20)}
                  x2={width - paddingRight}
                  y2={10 + 0.7 * (subHeight - 20)}
                  stroke="#10B981"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />
                <text
                  x={width - paddingRight + 6}
                  y={13 + 0.7 * (subHeight - 20)}
                  fill="#10B981"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  30
                </text>

                <text x={paddingLeft + 6} y="14" fill="#F59E0B" fontSize="9" fontWeight="bold">
                  RSI(14):{' '}
                  <tspan fill="#FFFFFF">
                    {!isNaN(rsiArr[activeGlobalIndex]) ? rsiArr[activeGlobalIndex].toFixed(1) : '--'}
                  </tspan>
                </text>

                {/* RSI Line */}
                <path
                  d={buildRsiPath()}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* Sub-Panel 2: MACD (12, 26, 9) */}
            {showMacdSubPanel && (
              <g
                transform={`translate(0, ${
                  mainHeight + (showRsiSubPanel ? subHeight : 0)
                })`}
              >
                <rect
                  x={paddingLeft}
                  y="0"
                  width={chartInnerWidth}
                  height={subHeight}
                  fill="#080C14"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                {/* Zero line */}
                <line
                  x1={paddingLeft}
                  y1={subHeight / 2}
                  x2={width - paddingRight}
                  y2={subHeight / 2}
                  stroke="#334155"
                  strokeWidth="0.8"
                />

                <text x={paddingLeft + 6} y="14" fill="#38BDF8" fontSize="9" fontWeight="bold">
                  MACD(12,26,9) Line / Signal / Histogram
                </text>

                {/* MACD Histogram Bars */}
                {visibleCandles.map((_, idx) => {
                  const gIdx = visibleStartIndex + idx;
                  const hist = macdData.histogram[gIdx];
                  if (isNaN(hist)) return null;
                  const x = getX(idx);
                  const barH = Math.min(30, Math.abs(hist) * 2);
                  const y = hist >= 0 ? subHeight / 2 - barH : subHeight / 2;
                  return (
                    <rect
                      key={`hist-${idx}`}
                      x={x - 1.5}
                      y={y}
                      width="3"
                      height={Math.max(1, barH)}
                      fill={hist >= 0 ? '#10B981' : '#F43F5E'}
                      opacity={0.8}
                    />
                  );
                })}
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Chart Footer Indicator Legend */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
            <span>EMA 9</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
            <span>EMA 21</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-purple-400 inline-block" />
            <span>Bollinger Bands</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2 bg-emerald-500/50 inline-block" />
            <span>Volume</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500">
          <span>CoinDCX Feed 60s Buffer</span>
          <span aria-hidden="true">·</span>
          <span>Tabular Real-Time Math</span>
        </div>
      </div>
    </div>
  );
};
