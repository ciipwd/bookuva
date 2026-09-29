import React from 'react';
import { OrderBook } from '../types/trading';

interface OrderBookPanelProps {
  orderBook: OrderBook | null;
  market: string;
  currentPrice: number;
}

export const OrderBookPanel: React.FC<OrderBookPanelProps> = ({ orderBook, market, currentPrice }) => {
  if (!orderBook) {
    return (
      <div className="bg-[#0E131F] border border-slate-800 rounded-lg p-4 text-xs text-slate-500 font-mono">
        Connecting to CoinDCX orderbook depth...
      </div>
    );
  }

  const asks = orderBook.asks.slice(0, 8).reverse();
  const bids = orderBook.bids.slice(0, 8);

  const totalAskQty = asks.reduce((acc, a) => acc + a.quantity, 0);
  const totalBidQty = bids.reduce((acc, b) => acc + b.quantity, 0);
  const maxAskTotal = Math.max(...asks.map((a) => a.total), 1);
  const maxBidTotal = Math.max(...bids.map((b) => b.total), 1);

  const buyPressure = totalBidQty + totalAskQty > 0 ? (totalBidQty / (totalBidQty + totalAskQty)) * 100 : 50;

  return (
    <div className="bg-[#0E131F] border border-slate-800 rounded-lg p-3.5 flex flex-col gap-3 font-mono text-xs select-none">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-200 text-xs">CoinDCX Orderbook</span>
          <span className="text-[10px] text-slate-500">[{market}]</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Spread: <span className="text-slate-200">{orderBook.spreadPercent.toFixed(3)}%</span>
        </div>
      </div>

      {/* Depth Pressure Gauge */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-sans">
          <span className="text-emerald-400 font-semibold">Bids: {buyPressure.toFixed(0)}%</span>
          <span className="text-rose-400 font-semibold">Asks: {(100 - buyPressure).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full" style={{ width: `${buyPressure}%` }} />
          <div className="bg-rose-500 h-full" style={{ width: `${100 - buyPressure}%` }} />
        </div>
      </div>

      {/* Asks (Sell Orders - Red) */}
      <div className="flex flex-col gap-0.5">
        <div className="grid grid-cols-3 text-[10px] text-slate-500 uppercase tracking-wider font-sans border-b border-slate-800/80 pb-1">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>
        {asks.map((a, idx) => {
          const depthPercent = Math.min(100, (a.total / maxAskTotal) * 100);
          return (
            <div key={`ask-${idx}`} className="relative grid grid-cols-3 py-0.5 text-[11px] tabular-nums">
              <div
                className="absolute inset-y-0 right-0 bg-rose-950/40 pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-rose-400 font-semibold z-10">{a.price.toLocaleString()}</span>
              <span className="text-right text-slate-300 z-10">{a.quantity.toFixed(4)}</span>
              <span className="text-right text-slate-400 z-10">${a.total.toFixed(0)}</span>
            </div>
          );
        })}
      </div>

      {/* Mid Market Price Bar */}
      <div className="py-1.5 px-2 bg-slate-900 border-y border-slate-800 flex items-center justify-between font-bold text-xs">
        <span className="text-slate-400 font-sans text-[11px]">Mid Market:</span>
        <span className="text-emerald-400 text-sm font-mono">${currentPrice.toLocaleString()}</span>
      </div>

      {/* Bids (Buy Orders - Green) */}
      <div className="flex flex-col gap-0.5">
        {bids.map((b, idx) => {
          const depthPercent = Math.min(100, (b.total / maxBidTotal) * 100);
          return (
            <div key={`bid-${idx}`} className="relative grid grid-cols-3 py-0.5 text-[11px] tabular-nums">
              <div
                className="absolute inset-y-0 right-0 bg-emerald-950/40 pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-emerald-400 font-semibold z-10">{b.price.toLocaleString()}</span>
              <span className="text-right text-slate-300 z-10">{b.quantity.toFixed(4)}</span>
              <span className="text-right text-slate-400 z-10">${b.total.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
