import React, { useState } from 'react';
import { Position } from '../types/trading';
import { XCircle, TrendingUp, TrendingDown, Clock, ShieldCheck, AlertTriangle, Lock, Shield, Target, Flame, Sliders } from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
  onClosePosition: (id: string, price: number) => void;
  onUpdateTrailing?: (positionId: string, trailingStopLoss: boolean, trailingStopPercent: number) => Promise<void>;
  usdtInrRate?: number;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  onClosePosition,
  onUpdateTrailing,
  usdtInrRate = 100.0,
}) => {
  const [editingTrailId, setEditingTrailId] = useState<string | null>(null);
  const [trailPercentInput, setTrailPercentInput] = useState<number>(1.0);
  return (
    <div className="bg-[#0E131F] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Active INR Futures Positions ({positions.length})
          </span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-[11px] text-slate-400 font-mono">
            Leveraged Contracts & Real-Time Liquidation Protection
          </span>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
          <ShieldCheck className="w-8 h-8 text-slate-600" />
          <div className="text-xs font-semibold text-slate-300">No Active Futures Positions Open</div>
          <p className="text-[11px] text-slate-500 max-w-sm">
            The algorithmic bot is monitoring CoinDCX orderbooks for Long and Short setups with INR margin.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card Layout (< md screens) */}
          <div className="block md:hidden divide-y divide-slate-800/80">
            {positions.map((pos) => {
              const dir = pos.positionDirection || (pos.side === 'BUY' ? 'LONG' : 'SHORT');
              const isLong = dir === 'LONG';
              const pnlInr = pos.unrealizedPnlInr || pos.unrealizedPnl * usdtInrRate;
              const isProfit = pnlInr >= 0;
              const openedDate = new Date(pos.openedAt).toLocaleTimeString();
              const leverage = pos.leverage || 10;
              const marginInr = pos.marginAmountInr || (pos.notionalValue * usdtInrRate) / leverage;

              const liqDist = pos.liquidationPrice > 0
                ? Math.abs(pos.currentPrice - pos.liquidationPrice) / pos.currentPrice * 100
                : 100;
              const isNearLiquidation = liqDist < 4;

              return (
                <div key={pos.id} className="p-3.5 flex flex-col gap-3 hover:bg-slate-900/30 transition-colors">
                  {/* Top Row: Symbol, Side, Leverage, Trailing / Breakeven Tags */}
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                          isLong
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {dir}
                      </span>
                      <span className="font-bold text-slate-100 text-sm">{pos.market} Perp</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-white font-mono text-[10px] font-bold border border-slate-700">
                        {leverage}x
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Trailing Stop Badge & Quick Edit Button */}
                      {pos.trailingStopLoss ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTrailId(editingTrailId === pos.id ? null : pos.id);
                            setTrailPercentInput(pos.trailingStopPercent || 1.0);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 font-mono transition-colors ${
                            pos.trailingActivated
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-600/80 hover:bg-emerald-900'
                              : 'bg-indigo-950 text-indigo-300 border-indigo-700/80 hover:bg-indigo-900'
                          }`}
                          title="Click to adjust trailing distance"
                        >
                          <Target className="w-3 h-3 text-emerald-400" />
                          <span>Trail {pos.trailingStopPercent || 1.0}%</span>
                          {pos.trailingActivated && <Flame className="w-2.5 h-2.5 text-amber-400 animate-pulse" />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (onUpdateTrailing) await onUpdateTrailing(pos.id, true, 1.0);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 font-sans"
                        >
                          <Target className="w-2.5 h-2.5 text-slate-400" />
                          <span>+Trail</span>
                        </button>
                      )}

                      {pos.trailingProfitLockedInr && pos.trailingProfitLockedInr > 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">
                          Locked: +₹{pos.trailingProfitLockedInr.toFixed(0)}
                        </span>
                      ) : null}

                      {pos.breakevenLocked && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/80 flex items-center gap-1 font-sans">
                          <Shield className="w-3 h-3 text-cyan-400" />
                          <span>Zero-Loss Lock</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inline Trailing Distance Quick Adjuster (Mobile) */}
                  {editingTrailId === pos.id && (
                    <div className="p-2.5 rounded bg-slate-900 border border-indigo-700/60 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300 font-sans text-[11px] font-semibold">Trail %:</span>
                        <div className="flex gap-1">
                          {[0.5, 1.0, 1.5, 2.0].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={async () => {
                                setTrailPercentInput(pct);
                                if (onUpdateTrailing) await onUpdateTrailing(pos.id, true, pct);
                                setEditingTrailId(null);
                              }}
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                (pos.trailingStopPercent || 1.0) === pct
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (onUpdateTrailing) await onUpdateTrailing(pos.id, !pos.trailingStopLoss, pos.trailingStopPercent || 1.0);
                            setEditingTrailId(null);
                          }}
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          {pos.trailingStopLoss ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTrailId(null)}
                          className="text-[10px] text-slate-400 hover:text-white px-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PnL Main Metric Display */}
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans">
                        Unrealized PnL (INR)
                      </span>
                      <div
                        className={`text-base font-mono font-bold flex items-center gap-1 mt-0.5 ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfit ? <TrendingUp className="w-4 h-4 inline" /> : <TrendingDown className="w-4 h-4 inline" />}
                        <span>
                          {isProfit ? '+' : ''}₹{pnlInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-sans">
                        Return on Margin
                      </span>
                      <div className={`font-mono text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{pos.unrealizedPnlPercent.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        (${pos.unrealizedPnl.toFixed(2)})
                      </div>
                    </div>
                  </div>

                  {/* Pricing Matrix 2x2 */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-sans">Entry / Mark</div>
                      <div className="text-slate-200 font-bold">${pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className="text-slate-400 text-[10px]">Mark: ${pos.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>

                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-sans">Margin (INR)</div>
                      <div className="text-emerald-400 font-bold">₹{marginInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      <div className="text-slate-500 text-[10px]">Size: ${pos.notionalValue.toFixed(0)}</div>
                    </div>

                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-sans">Est. Liquidation</div>
                      <div className={`font-bold ${isNearLiquidation ? 'text-rose-400' : 'text-amber-400'}`}>
                        ${pos.liquidationPrice.toFixed(2)}
                      </div>
                      <div className="text-slate-500 text-[10px]">Buffer: {liqDist.toFixed(1)}%</div>
                    </div>

                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-sans flex items-center justify-between">
                        <span>SL / TP Targets</span>
                        {pos.trailingStopLoss && (
                          <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5 font-mono">
                            <Target className="w-2.5 h-2.5" /> Trail {pos.trailingStopPercent || 1.0}%
                          </span>
                        )}
                      </div>
                      <div className={pos.trailingStopLoss ? "text-emerald-300 font-bold" : pos.breakevenLocked ? "text-cyan-300 font-bold" : "text-rose-400"}>
                        SL: ${pos.stopLossPrice.toFixed(2)}
                      </div>
                      <div className="text-emerald-400">TP: ${pos.takeProfitPrice.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Footer Action & Strategy */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{openedDate}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400 truncate max-w-[140px]">{pos.strategyUsed}</span>
                    </div>

                    <button
                      onClick={() => onClosePosition(pos.id, pos.currentPrice)}
                      className="px-3.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Close Position</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md screens) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-sans bg-slate-950/40">
                  <th className="py-2.5 px-4 font-semibold">Contract / Side</th>
                  <th className="py-2.5 px-4 font-semibold">Leverage & Margin (INR)</th>
                  <th className="py-2.5 px-4 font-semibold">Entry / Mark Price</th>
                  <th className="py-2.5 px-4 font-semibold">Est. Liquidation Price</th>
                  <th className="py-2.5 px-4 font-semibold">Unrealized PnL (INR & %)</th>
                  <th className="py-2.5 px-4 font-semibold">SL / TP Targets</th>
                  <th className="py-2.5 px-4 font-semibold">Strategy & Reason</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {positions.map((pos) => {
                  const dir = pos.positionDirection || (pos.side === 'BUY' ? 'LONG' : 'SHORT');
                  const isLong = dir === 'LONG';
                  const pnlInr = pos.unrealizedPnlInr || pos.unrealizedPnl * usdtInrRate;
                  const isProfit = pnlInr >= 0;
                  const openedDate = new Date(pos.openedAt).toLocaleTimeString();
                  const leverage = pos.leverage || 10;
                  const marginInr = pos.marginAmountInr || (pos.notionalValue * usdtInrRate) / leverage;

                  // Check liquidation proximity (< 3%)
                  const liqDist = pos.liquidationPrice > 0
                    ? Math.abs(pos.currentPrice - pos.liquidationPrice) / pos.currentPrice * 100
                    : 100;
                  const isNearLiquidation = liqDist < 4;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Market & Direction */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isLong
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {dir}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-200">{pos.market} Perp</span>
                              {pos.trailingStopLoss ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTrailId(editingTrailId === pos.id ? null : pos.id);
                                    setTrailPercentInput(pos.trailingStopPercent || 1.0);
                                  }}
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border flex items-center gap-0.5 font-mono cursor-pointer transition-colors ${
                                    pos.trailingActivated
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600/80 hover:bg-emerald-900'
                                      : 'bg-indigo-950 text-indigo-300 border-indigo-700/80 hover:bg-indigo-900'
                                  }`}
                                  title="Trailing stop active! Click to adjust trail %"
                                >
                                  <Target className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Trail {pos.trailingStopPercent || 1.0}%</span>
                                  {pos.trailingActivated && <Flame className="w-2.5 h-2.5 text-amber-400 animate-pulse" />}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onUpdateTrailing) await onUpdateTrailing(pos.id, true, 1.0);
                                  }}
                                  className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 flex items-center gap-0.5"
                                  title="Enable trailing stop on this position"
                                >
                                  <Target className="w-2.5 h-2.5" />
                                  <span>+Trail</span>
                                </button>
                              )}

                              {pos.trailingProfitLockedInr && pos.trailingProfitLockedInr > 0 ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono">
                                  +₹{pos.trailingProfitLockedInr.toFixed(0)} Locked
                                </span>
                              ) : null}

                              {pos.breakevenLocked && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/80 flex items-center gap-0.5 font-sans" title="Stop Loss locked at breakeven + fee. Position cannot lose capital!">
                                  <Shield className="w-2.5 h-2.5 text-cyan-400" />
                                  <span>Zero-Loss Guard</span>
                                </span>
                              )}
                            </div>
                            {editingTrailId === pos.id && (
                              <div className="mt-1 p-1.5 rounded bg-slate-900 border border-indigo-700/80 flex items-center gap-1.5 z-10 relative">
                                <span className="text-[10px] text-slate-300 font-sans">Trail %:</span>
                                {[0.5, 1.0, 1.5, 2.0].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={async () => {
                                      setTrailPercentInput(pct);
                                      if (onUpdateTrailing) await onUpdateTrailing(pos.id, true, pct);
                                      setEditingTrailId(null);
                                    }}
                                    className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                                      (pos.trailingStopPercent || 1.0) === pct
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                  >
                                    {pct}%
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onUpdateTrailing) await onUpdateTrailing(pos.id, !pos.trailingStopLoss, pos.trailingStopPercent || 1.0);
                                    setEditingTrailId(null);
                                  }}
                                  className="text-[9px] text-amber-400 hover:underline ml-1"
                                >
                                  {pos.trailingStopLoss ? 'Off' : 'On'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTrailId(null)}
                                  className="text-[9px] text-slate-400 hover:text-white ml-auto px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 inline" /> {openedDate}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Leverage & Margin */}
                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-white font-bold text-[10px] border border-slate-700">
                            {leverage}x
                          </span>
                          <span className="font-bold text-emerald-400">
                            ₹{marginInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          Pos: ${pos.notionalValue.toFixed(0)} (₹{(pos.notionalValue * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                        </div>
                      </td>

                      {/* Entry / Mark Price */}
                      <td className="py-3 px-4 text-slate-300">
                        <div>${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Mark: ${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </div>
                      </td>

                      {/* Liquidation Price */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <span className={`font-semibold ${isNearLiquidation ? 'text-rose-400 font-bold' : 'text-amber-400'}`}>
                            ${pos.liquidationPrice.toFixed(2)}
                          </span>
                          {isNearLiquidation && (
                            <span title="Liquidation warning: Price is near threshold!">
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          Buffer: {liqDist.toFixed(1)}%
                        </div>
                      </td>

                      {/* PnL in INR */}
                      <td className="py-3 px-4">
                        <div
                          className={`font-bold flex items-center gap-1 text-sm ${
                            isProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfit ? (
                            <TrendingUp className="w-3.5 h-3.5 inline" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 inline" />
                          )}
                          <span>
                            {isProfit ? '+' : ''}₹{pnlInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className={`text-[10px] ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isProfit ? '+' : ''}{pos.unrealizedPnlPercent.toFixed(2)}% RoM (${pos.unrealizedPnl.toFixed(2)})
                        </div>
                      </td>

                      {/* SL / TP */}
                      <td className="py-3 px-4 text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className={pos.trailingStopLoss ? "text-emerald-400 font-bold" : pos.breakevenLocked ? "text-cyan-400 font-bold" : "text-rose-400"}>
                            {pos.trailingStopLoss ? 'Trail SL:' : 'SL:'}
                          </span>
                          <span className={pos.trailingStopLoss ? "text-emerald-300 font-bold" : pos.breakevenLocked ? "text-cyan-300 font-bold" : ""}>
                            ${pos.stopLossPrice.toFixed(2)}
                          </span>
                          {pos.trailingStopLoss && (
                            <span title={`Trailing Stop Active: ${pos.trailingStopPercent || 1.0}% distance from peak`}>
                              <Target className="w-3 h-3 text-emerald-400" />
                            </span>
                          )}
                          {pos.breakevenLocked && !pos.trailingStopLoss && (
                            <span title="Breakeven Lock Active">
                              <Lock className="w-3 h-3 text-cyan-400" />
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-emerald-400">TP:</span> ${pos.takeProfitPrice.toFixed(2)}
                        </div>
                        {pos.trailingProfitLockedInr && pos.trailingProfitLockedInr > 0 ? (
                          <div className="text-[9px] text-emerald-400 font-sans mt-0.5 font-bold">
                            🔒 +₹{pos.trailingProfitLockedInr.toFixed(0)} Secured
                          </div>
                        ) : null}
                      </td>

                      {/* Strategy & Trigger */}
                      <td className="py-3 px-4 text-[11px] max-w-xs font-sans text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-300">{pos.strategyUsed}</span>
                          {pos.initialWinProbability && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              {pos.initialWinProbability}% Prob
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={pos.entryReason}>
                          {pos.entryReason}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id, pos.currentPrice)}
                          className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/80 text-rose-300 border border-rose-800 rounded text-xs transition-colors flex items-center gap-1 ml-auto"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Close</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
