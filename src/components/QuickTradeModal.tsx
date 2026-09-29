import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Zap, Shield, AlertTriangle } from 'lucide-react';
import { PositionDirection, LiveWalletBalances } from '../types/trading';

interface QuickTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: string;
  currentPrice: number;
  usdtInrRate?: number;
  defaultLeverage?: number;
  onExecuteTrade: (order: {
    market: string;
    side: 'BUY' | 'SELL';
    direction: PositionDirection;
    order_type: 'market' | 'limit';
    price: number;
    quantity: number;
    leverage: number;
    marginCurrency: 'INR' | 'USDT';
    useTrailingStop?: boolean;
    trailingStopPercent?: number;
    trailingUseSuperTrend?: boolean;
  }) => Promise<void>;
  isLiveMode: boolean;
  inrBalance?: number;
  liveBalances?: LiveWalletBalances | null;
}

const LEVERAGE_PRESETS = [2, 5, 10, 20, 50, 100];

export const QuickTradeModal: React.FC<QuickTradeModalProps> = ({
  isOpen,
  onClose,
  market,
  currentPrice,
  usdtInrRate = 100.0,
  defaultLeverage = 10,
  onExecuteTrade,
  isLiveMode,
  inrBalance = 10000,
  liveBalances,
}) => {
  const [direction, setDirection] = useState<PositionDirection>('LONG');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [price, setPrice] = useState<number>(currentPrice || 0);
  const [quantity, setQuantity] = useState<number>(0.01);
  const [leverage, setLeverage] = useState<number>(defaultLeverage);
  const [useTrailingStop, setUseTrailingStop] = useState<boolean>(true);
  const [trailingStopPercent, setTrailingStopPercent] = useState<number>(1.0);
  const [trailingUseSuperTrend, setTrailingUseSuperTrend] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const executionPrice = orderType === 'market' ? currentPrice : price;
  const notionalUsd = (executionPrice || currentPrice) * quantity;
  const notionalInr = notionalUsd * usdtInrRate;
  const marginRequiredInr = leverage > 0 ? notionalInr / leverage : notionalInr;
  const estFeeUsd = notionalUsd * 0.0005; // 0.05%
  const estFeeInr = estFeeUsd * usdtInrRate;

  // Calculate estimated liquidation price
  const maintenanceMarginRate = 0.005;
  const bankruptcyBuffer = (1 / Math.max(1, leverage)) - maintenanceMarginRate;
  const estLiquidationPrice = direction === 'LONG'
    ? Math.max(0, executionPrice * (1 - bankruptcyBuffer))
    : executionPrice * (1 + bankruptcyBuffer);

  const hasInsufficientMargin = marginRequiredInr > inrBalance;
  const isBelowLiveMinOrderValue = isLiveMode && notionalUsd < 60;
  const minRequiredQty = executionPrice > 0 ? Number((61 / executionPrice).toFixed(4)) : 0.001;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onExecuteTrade({
        market,
        side: direction === 'LONG' ? 'BUY' : 'SELL',
        direction,
        order_type: orderType,
        price: executionPrice,
        quantity,
        leverage,
        marginCurrency: 'INR',
        useTrailingStop,
        trailingStopPercent,
        trailingUseSuperTrend,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Order failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0E131F] border border-slate-800 rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              CoinDCX INR Futures · {market}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5 text-xs font-mono">
          {/* Routing Mode */}
          <div className="text-[11px] font-sans flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800/60">
            <span>Execution Channel:</span>
            <span className={isLiveMode ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isLiveMode ? 'CoinDCX Live Derivatives (INR Margin)' : 'High-Fidelity Paper Futures'}
            </span>
          </div>

          {/* Direction Selector (LONG vs SHORT) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('LONG')}
              className={`py-2 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                direction === 'LONG'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>LONG (Buy)</span>
            </button>
            <button
              type="button"
              onClick={() => setDirection('SHORT')}
              className={`py-2 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                direction === 'SHORT'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>SHORT (Sell)</span>
            </button>
          </div>

          {/* Leverage Selector */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mb-1">
              <span>Leverage Multiplier:</span>
              <span className="font-bold text-emerald-400">{leverage}x Leverage</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {LEVERAGE_PRESETS.map((lev) => (
                <button
                  key={lev}
                  type="button"
                  onClick={() => setLeverage(lev)}
                  className={`py-1 rounded text-center font-bold text-[11px] transition-colors ${
                    leverage === lev
                      ? 'bg-emerald-600 text-white border border-emerald-500'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          {/* Order Type */}
          <div className="flex items-center justify-between bg-slate-950 p-1 border border-slate-800 rounded text-slate-400">
            <button
              type="button"
              onClick={() => setOrderType('market')}
              className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors ${
                orderType === 'market' ? 'bg-slate-800 text-white' : 'hover:text-slate-200'
              }`}
            >
              Market Order
            </button>
            <button
              type="button"
              onClick={() => setOrderType('limit')}
              className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors ${
                orderType === 'limit' ? 'bg-slate-800 text-white' : 'hover:text-slate-200'
              }`}
            >
              Limit Order
            </button>
          </div>

          {/* Price Input (if limit) */}
          {orderType === 'limit' && (
            <div>
              <label className="block text-[11px] font-sans text-slate-400 mb-1">
                Limit Price (USD)
              </label>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mb-1">
              <span>Contract Quantity</span>
              <span>Mark: ${currentPrice.toLocaleString()}</span>
            </div>
            <input
              type="number"
              step="any"
              min="0.00001"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Quick Capital % & Quantity Shortcuts */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mb-1">
              <span>Use INR Capital %:</span>
              <span className="text-emerald-400 font-bold font-mono">₹{inrBalance.toLocaleString('en-IN')} Available</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-[10px]">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    const marginInr = (inrBalance * pct) / 100;
                    const notionalInr = marginInr * leverage;
                    const notionalUsd = notionalInr / usdtInrRate;
                    const calculatedQty = Number((notionalUsd / (executionPrice || currentPrice)).toFixed(6));
                    setQuantity(calculatedQty);
                  }}
                  className="py-1 bg-slate-900 hover:bg-emerald-950/80 hover:text-emerald-300 border border-slate-800 hover:border-emerald-600 rounded text-slate-300 font-bold font-mono transition-colors"
                >
                  {pct === 100 ? '100% ALL' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* INR Margin & Risk Calculation Card */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] flex flex-col gap-1.5 text-slate-400">
            <div className="flex justify-between">
              <span>Notional Contract Value:</span>
              <span className="font-bold text-white">
                ${notionalUsd.toFixed(2)} (₹{notionalInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-400 font-semibold">Required INR Collateral:</span>
              <span className="font-bold text-emerald-400 text-xs">
                ₹{marginRequiredInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Est. Liquidation Price:</span>
              <span className="font-bold text-amber-400">
                ${estLiquidationPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Maker/Taker Fee (0.05%):</span>
              <span>₹{estFeeInr.toFixed(2)} (${estFeeUsd.toFixed(3)})</span>
            </div>
          </div>

          {/* 🎯 Trailing Stop Loss Protection Card */}
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/60 text-[11px] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTrailingStop}
                  onChange={(e) => setUseTrailingStop(e.target.checked)}
                  className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <span>🎯</span> Use Trailing Stop Loss
                </span>
              </label>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                useTrailingStop ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {useTrailingStop ? `${trailingStopPercent}% Trail` : 'OFF'}
              </span>
            </div>

            {useTrailingStop && (
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-emerald-900/40">
                <div className="flex items-center justify-between text-[10px] text-slate-300">
                  <span>Trail Ratchet Distance:</span>
                  <span className="font-bold text-emerald-400">{trailingStopPercent}% from Peak</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 1.0, 1.5, 2.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTrailingStopPercent(preset)}
                      className={`py-1 rounded text-center font-bold text-[10px] transition-colors ${
                        trailingStopPercent === preset
                          ? 'bg-emerald-600 text-white border border-emerald-400'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] pt-1">
                  <span className="text-slate-400">SuperTrend ATR Confluence:</span>
                  <button
                    type="button"
                    onClick={() => setTrailingUseSuperTrend(!trailingUseSuperTrend)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      trailingUseSuperTrend ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {trailingUseSuperTrend ? 'LINKED' : 'OFF'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CoinDCX Live Mode Minimum Order Rule Notice */}
          {isBelowLiveMinOrderValue && (
            <div className="p-2.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-[11px] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  CoinDCX Min Order Rule: 60 USDT
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(minRequiredQty)}
                  className="px-2 py-0.5 rounded bg-amber-800/80 hover:bg-amber-700 text-white font-bold text-[10px]"
                >
                  Set to {minRequiredQty}
                </button>
              </div>
              <p className="text-[10px] text-amber-200/90 leading-tight">
                Current value is ${notionalUsd.toFixed(2)}. CoinDCX rejects futures orders under $60 USDT.
              </p>
            </div>
          )}

          {/* Live Low Balance Warning */}
          {isLiveMode && liveBalances && !liveBalances.isFunded && (
            <div className="p-2.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-[11px] flex flex-col gap-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                Live Wallet Balance Low: ₹{liveBalances.inr.toFixed(2)} INR
              </div>
              <p className="text-[10px] text-amber-200/90 leading-tight">
                CoinDCX live orders require active balance in your CoinDCX futures wallet (~₹{liveBalances.minOrderValueInr.toFixed(0)} min). Deposit funds or switch to Paper Trading to test strategies with ₹10,00,000 virtual margin.
              </p>
            </div>
          )}

          {hasInsufficientMargin && !isBelowLiveMinOrderValue && (
            <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Insufficient INR Collateral! Available: ₹{inrBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex flex-col gap-1">
              <div className="font-bold text-rose-300">Order Rejected by CoinDCX:</div>
              <div className="font-mono text-[11px]">{errorMsg}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || quantity <= 0 || hasInsufficientMargin}
            className={`py-2.5 px-4 rounded text-xs font-bold text-white transition-colors disabled:opacity-50 ${
              direction === 'LONG'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            {isSubmitting
              ? 'Executing Futures Order...'
              : `Confirm ${direction} Futures (${leverage}x Leverage)`}
          </button>
        </form>
      </div>
    </div>
  );
};
