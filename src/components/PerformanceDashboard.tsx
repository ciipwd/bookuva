import React from 'react';
import { PerformanceStats, Trade } from '../types/trading';
import {
  TrendingUp,
  TrendingDown,
  Award,
  ShieldAlert,
  Download,
  RotateCcw,
  BarChart2,
  PieChart,
} from 'lucide-react';

interface PerformanceDashboardProps {
  performance: PerformanceStats;
  trades: Trade[];
  onResetSimulation: () => void;
  usdtInrRate?: number;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  performance,
  trades,
  onResetSimulation,
  usdtInrRate = 100.0,
}) => {
  const netProfitInr = performance.netProfitInr || performance.netProfit * usdtInrRate;
  const isNetProfit = netProfitInr >= 0;
  const currentEquityInr = performance.currentEquityInr || performance.currentEquity * usdtInrRate;
  const startingEquityInr = performance.startingEquityInr || performance.startingEquity * usdtInrRate;

  // Export CSV Report with INR data
  const handleExportCSV = () => {
    if (trades.length === 0) return;
    const headers = [
      'Trade ID',
      'Contract',
      'Direction',
      'Leverage',
      'Margin Currency',
      'Margin Amount (INR)',
      'Entry Price ($)',
      'Exit Price ($)',
      'Quantity',
      'Realized PnL (INR)',
      'Realized PnL ($)',
      'Return on Margin (%)',
      'Fee (INR)',
      'Exit Reason',
      'Strategy',
      'Opened At',
      'Closed At',
    ];

    const rows = trades.map((t) => [
      t.id,
      t.market,
      t.positionDirection || (t.side === 'BUY' ? 'LONG' : 'SHORT'),
      `${t.leverage || 10}x`,
      t.marginCurrency || 'INR',
      t.marginAmountInr || 0,
      t.entryPrice,
      t.exitPrice,
      t.quantity,
      t.realizedPnlInr || (t.realizedPnl * usdtInrRate),
      t.realizedPnl,
      t.realizedPnlPercent,
      t.feeInr || (t.fee * usdtInrRate),
      t.exitReason,
      t.strategyUsed,
      new Date(t.openedAt).toISOString(),
      new Date(t.closedAt).toISOString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CoinDCX_INR_Futures_Performance_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Equity History Curve in INR
  const equityPoints = performance.equityHistory || [];
  const minEquityInr = Math.min(
    ...equityPoints.map((p) => p.equityInr || p.equity * usdtInrRate),
    startingEquityInr * 0.95
  );
  const maxEquityInr = Math.max(
    ...equityPoints.map((p) => p.equityInr || p.equity * usdtInrRate),
    startingEquityInr * 1.05
  );
  const equityRange = maxEquityInr - minEquityInr || 1;

  const chartWidth = 700;
  const chartHeight = 200;
  const chartPadLeft = 70;
  const chartPadRight = 20;
  const chartPadTop = 20;
  const chartPadBottom = 30;

  const getEqX = (idx: number) => {
    if (equityPoints.length <= 1) return chartPadLeft;
    return (
      chartPadLeft +
      (idx / (equityPoints.length - 1)) * (chartWidth - chartPadLeft - chartPadRight)
    );
  };

  const getEqY = (val: number) => {
    return (
      chartPadTop +
      (1 - (val - minEquityInr) / equityRange) * (chartHeight - chartPadTop - chartPadBottom)
    );
  };

  let equityPath = '';
  let equityAreaPath = '';
  if (equityPoints.length > 0) {
    equityPath = equityPoints.reduce((acc, pt, idx) => {
      const val = pt.equityInr || pt.equity * usdtInrRate;
      const x = getEqX(idx);
      const y = getEqY(val);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');

    const lastX = getEqX(equityPoints.length - 1);
    const firstX = getEqX(0);
    const bottomY = chartHeight - chartPadBottom;
    equityAreaPath = `${equityPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }

  return (
    <div className="bg-[#0E131F] border border-slate-800 rounded-lg p-5 flex flex-col gap-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <span>CoinDCX INR Futures Performance Analytics</span>
          </h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Verified risk-adjusted metrics for leveraged Long & Short futures with INR collateral (1 USDT = ₹{usdtInrRate.toFixed(2)})
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={trades.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onResetSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 rounded text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Stats</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono tabular-nums">
        {/* Net Realized Profit (INR) */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans uppercase tracking-wider">
            Net Realized PnL (INR)
          </div>
          <div
            className={`text-xl font-bold mt-1 flex items-baseline gap-1 ${
              isNetProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            <span>
              {isNetProfit ? '+' : ''}₹{netProfitInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-normal">
              ({isNetProfit ? '+' : ''}{performance.netProfitPercent.toFixed(2)}%)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-1">
            Collateral: ₹{currentEquityInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${performance.currentEquity.toFixed(0)})
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans uppercase tracking-wider">
            Futures Win Rate
          </div>
          <div className="text-xl font-bold mt-1 text-slate-100 flex items-baseline gap-1.5">
            <span>{performance.winRate}%</span>
            <span className="text-xs text-slate-400 font-normal">
              ({performance.winningTrades}W / {performance.losingTrades}L)
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-1">
            Total Closed Trades: {performance.totalTrades}
          </div>
        </div>

        {/* Profit Factor */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans uppercase tracking-wider">
            Profit Factor
          </div>
          <div className="text-xl font-bold mt-1 text-cyan-400">
            {performance.profitFactor > 0 ? performance.profitFactor.toFixed(2) : '--'}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-1">
            Gross: ₹{(performance.grossProfit * usdtInrRate).toFixed(0)} / Loss: ₹{(performance.grossLoss * usdtInrRate).toFixed(0)}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans uppercase tracking-wider">
            Max Drawdown
          </div>
          <div className="text-xl font-bold mt-1 text-rose-400">
            {performance.maxDrawdownPercent.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-1">
            Margin Risk Circuit Breaker: 5.0%
          </div>
        </div>
      </div>

      {/* Equity Curve SVG Chart in INR */}
      <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">INR Futures Margin Collateral Growth</span>
          <span className="text-[11px] text-slate-400 font-mono">
            Initial Capital: ₹{startingEquityInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48 block">
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal baseline */}
            <line
              x1={chartPadLeft}
              y1={getEqY(startingEquityInr)}
              x2={chartWidth - chartPadRight}
              y2={getEqY(startingEquityInr)}
              stroke="#334155"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={chartPadLeft - 5}
              y={getEqY(startingEquityInr) + 3}
              fill="#64748B"
              fontSize="9"
              textAnchor="end"
              fontFamily="monospace"
            >
              ₹{(startingEquityInr / 100000).toFixed(1)}L
            </text>

            {/* Current Top Value */}
            <text
              x={chartPadLeft - 5}
              y={chartPadTop + 10}
              fill="#64748B"
              fontSize="9"
              textAnchor="end"
              fontFamily="monospace"
            >
              ₹{(maxEquityInr / 100000).toFixed(2)}L
            </text>

            {/* Equity Area & Line */}
            {equityAreaPath && <path d={equityAreaPath} fill="url(#equityGrad)" />}
            {equityPath && (
              <path
                d={equityPath}
                fill="none"
                stroke={isNetProfit ? '#10B981' : '#F43F5E'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
        <div className="p-3 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 font-sans">Avg Trade PnL (INR)</div>
          <div className="text-sm font-bold text-slate-200 mt-0.5">
            ₹{(performance.averageTradePnl * usdtInrRate).toFixed(2)} (${performance.averageTradePnl.toFixed(2)})
          </div>
        </div>

        <div className="p-3 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 font-sans">Gross Profit (INR)</div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">
            +₹{(performance.grossProfit * usdtInrRate).toFixed(0)} (+${performance.grossProfit.toFixed(1)})
          </div>
        </div>

        <div className="p-3 rounded bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 font-sans">Gross Loss (INR)</div>
          <div className="text-sm font-bold text-rose-400 mt-0.5">
            -₹{(performance.grossLoss * usdtInrRate).toFixed(0)} (-${performance.grossLoss.toFixed(1)})
          </div>
        </div>
      </div>
    </div>
  );
};
