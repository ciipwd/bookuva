import React, { useState } from 'react';
import { Trade } from '../types/trading';
import { Search, Filter, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradeHistoryTableProps {
  trades: Trade[];
  usdtInrRate?: number;
}

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({ trades, usdtInrRate = 100.0 }) => {
  const [filterType, setFilterType] = useState<'all' | 'wins' | 'losses'>('all');
  const [search, setSearch] = useState('');

  const filtered = trades.filter((t) => {
    if (filterType === 'wins' && t.realizedPnl <= 0) return false;
    if (filterType === 'losses' && t.realizedPnl > 0) return false;
    if (search && !t.market.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="bg-[#0E131F] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
      {/* Table Header & Filters */}
      <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            CoinDCX INR Futures Trade History ({trades.length})
          </h3>
          <div className="text-[11px] text-slate-400">
            Realized fills with INR margin collateral, leverage metrics & exchange fees
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Tabs */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({trades.length})
            </button>
            <button
              onClick={() => setFilterType('wins')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'wins'
                  ? 'bg-emerald-950 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Profits
            </button>
            <button
              onClick={() => setFilterType('losses')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'losses'
                  ? 'bg-rose-950 text-rose-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Losses
            </button>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter pair..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-white text-xs outline-none w-24"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-500 font-mono">
          No executed futures trades found matching filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-sans bg-slate-950/40">
                <th className="py-2.5 px-4 font-semibold">Time</th>
                <th className="py-2.5 px-4 font-semibold">Contract / Direction</th>
                <th className="py-2.5 px-4 font-semibold">Leverage & Margin (INR)</th>
                <th className="py-2.5 px-4 font-semibold">Entry → Exit Price</th>
                <th className="py-2.5 px-4 font-semibold">Quantity</th>
                <th className="py-2.5 px-4 font-semibold">Realized PnL (INR & %)</th>
                <th className="py-2.5 px-4 font-semibold">Fee (INR)</th>
                <th className="py-2.5 px-4 font-semibold">Exit Trigger</th>
                <th className="py-2.5 px-4 font-semibold">Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((trade) => {
                const dir = trade.positionDirection || (trade.side === 'BUY' ? 'LONG' : 'SHORT');
                const isLong = dir === 'LONG';
                const pnlInr = trade.realizedPnlInr || (trade.realizedPnl * usdtInrRate);
                const isProfit = pnlInr >= 0;
                const leverage = trade.leverage || 10;
                const marginInr = trade.marginAmountInr || ((trade.notionalValue * usdtInrRate) / leverage);
                const feeInr = trade.feeInr || (trade.fee * usdtInrRate);

                const timeStr = new Date(trade.closedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr key={trade.id} className="hover:bg-slate-900/40 transition-colors">
                    {/* Timestamp */}
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {timeStr}
                    </td>

                    {/* Contract & Direction */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLong
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {dir}
                        </span>
                        <span className="font-bold text-slate-200">{trade.market} Perp</span>
                      </div>
                    </td>

                    {/* Leverage & Margin */}
                    <td className="py-2.5 px-4 text-slate-300">
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-white font-bold text-[10px] border border-slate-700 mr-1.5">
                        {leverage}x
                      </span>
                      <span className="font-bold text-emerald-400">
                        ₹{marginInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </td>

                    {/* Prices */}
                    <td className="py-2.5 px-4 text-slate-300">
                      ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} →{' '}
                      <span className="font-bold text-white">
                        ${trade.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="py-2.5 px-4 text-slate-300">{trade.quantity}</td>

                    {/* Realized PnL in INR */}
                    <td className="py-2.5 px-4 font-bold">
                      <div
                        className={`flex items-center gap-0.5 ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>{isProfit ? '+' : ''}₹{pnlInr.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] font-normal text-slate-400">
                        ({isProfit ? '+' : ''}{trade.realizedPnlPercent.toFixed(2)}% RoM · ${trade.realizedPnl.toFixed(2)})
                      </div>
                    </td>

                    {/* Fee in INR */}
                    <td className="py-2.5 px-4 text-slate-400">
                      ₹{feeInr.toFixed(2)}
                    </td>

                    {/* Exit Trigger */}
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                          trade.exitReason === 'BREAKEVEN_GUARD'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80'
                            : trade.exitReason === 'EARLY_PROTECTIVE_CUT'
                            ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/80'
                            : trade.exitReason === 'TAKE_PROFIT'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                            : trade.exitReason === 'TRAILING_STOP'
                            ? 'bg-teal-950/80 text-teal-300 border-teal-700/80'
                            : trade.exitReason === 'LIQUIDATION'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {trade.exitReason === 'BREAKEVEN_GUARD' ? '🛡️ Breakeven Guard' :
                         trade.exitReason === 'EARLY_PROTECTIVE_CUT' ? '⚡ Protective Cut' :
                         trade.exitReason.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Strategy & Win Probability */}
                    <td className="py-2.5 px-4 text-[11px] font-sans text-slate-400">
                      <div>{trade.strategyUsed}</div>
                      {trade.winProbabilityAtEntry && (
                        <div className="text-[10px] font-mono text-emerald-400">
                          {trade.winProbabilityAtEntry}% Entry Prob
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
