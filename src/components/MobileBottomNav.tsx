import React from 'react';
import {
  TrendingUp,
  Zap,
  BarChart2,
  Clock,
  Radar,
  ShieldCheck,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'terminal' | 'strategy' | 'performance' | 'history' | 'security';
  setActiveTab: (tab: 'terminal' | 'strategy' | 'performance' | 'history' | 'security') => void;
  onOpenScanner: () => void;
  onOpenSecurity: () => void;
  openPositionsCount: number;
  isRunning: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenSecurity,
  openPositionsCount,
  isRunning,
}) => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E14]/95 backdrop-blur-md border-t border-slate-800/90 px-1 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom select-none">
      {/* 1. Terminal / Chart */}
      <button
        onClick={() => setActiveTab('terminal')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg transition-colors relative ${
          activeTab === 'terminal'
            ? 'text-emerald-400 font-bold bg-emerald-950/40'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <TrendingUp className="w-4 h-4" />
          {openPositionsCount > 0 && (
            <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-emerald-500 text-black text-[9px] font-black rounded-full flex items-center justify-center">
              {openPositionsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-tight">Terminal</span>
      </button>

      {/* 2. Strategy & Risk */}
      <button
        onClick={() => setActiveTab('strategy')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg transition-colors relative ${
          activeTab === 'strategy'
            ? 'text-emerald-400 font-bold bg-emerald-950/40'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <Zap className="w-4 h-4" />
          {isRunning && (
            <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          )}
        </div>
        <span className="text-[10px] tracking-tight">Strategy</span>
      </button>

      {/* 3. Auto-Radar Scanner (Center Highlight Button) */}
      <button
        onClick={onOpenScanner}
        className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-transform active:scale-95 text-indigo-400 hover:text-indigo-300"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-700 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
          <Radar className="w-4 h-4 animate-pulse" />
        </div>
        <span className="text-[10px] font-bold text-indigo-300">Radar</span>
      </button>

      {/* 4. Performance */}
      <button
        onClick={() => setActiveTab('performance')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
          activeTab === 'performance'
            ? 'text-emerald-400 font-bold bg-emerald-950/40'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <BarChart2 className="w-4 h-4" />
        <span className="text-[10px] tracking-tight">Metrics</span>
      </button>

      {/* 5. Trade Logs / History */}
      <button
        onClick={() => setActiveTab('history')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
          activeTab === 'history'
            ? 'text-emerald-400 font-bold bg-emerald-950/40'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Clock className="w-4 h-4" />
        <span className="text-[10px] tracking-tight">History</span>
      </button>

      {/* 6. Vault */}
      <button
        onClick={onOpenSecurity}
        className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
      >
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="text-[10px] tracking-tight">Vault</span>
      </button>
    </nav>
  );
};
