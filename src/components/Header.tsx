import React from 'react';
import { Play, Pause, AlertOctagon, ShieldCheck, TrendingUp, Zap, Radar, Layers } from 'lucide-react';
import { LiveWalletBalances } from '../types/trading';
import traderAvatar from '../assets/images/trader_avatar_1790244651266.jpg';

interface HeaderProps {
  activeTab: 'terminal' | 'strategy' | 'performance' | 'history' | 'security';
  setActiveTab: (tab: 'terminal' | 'strategy' | 'performance' | 'history' | 'security') => void;
  isRunning: boolean;
  isLiveMode: boolean;
  onToggleBot: () => void;
  onEmergencyStop: () => void;
  onOpenSecurity: () => void;
  onOpenScanner?: () => void;
  onOpenConfluenceEnsemble?: () => void;
  openPositionsCount: number;
  inrBalance?: number;
  inrMarginBalance?: number;
  liveBalances?: LiveWalletBalances | null;
  defaultLeverage?: number;
  usdtInrRate?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isRunning,
  isLiveMode,
  onToggleBot,
  onEmergencyStop,
  onOpenSecurity,
  onOpenScanner,
  onOpenConfluenceEnsemble,
  openPositionsCount,
  inrBalance = 10000,
  inrMarginBalance,
  liveBalances,
  defaultLeverage = 10,
  usdtInrRate = 100.0,
}) => {
  const displayInrBalance = inrMarginBalance !== undefined ? inrMarginBalance : inrBalance;
  const isBalanceLow = isLiveMode && liveBalances && !liveBalances.isFunded;
  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 border-b border-slate-800 bg-[#0B0E14] flex items-center justify-between shrink-0 select-none z-30 gap-2">
      {/* Zone 1: Brand & Market Mode */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-slate-950 font-black text-xs sm:text-sm tracking-tight shadow-sm shrink-0">
          CDX
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('terminal');
              }}
              className="text-xs sm:text-base font-bold tracking-tight text-white hover:text-slate-200 transition-colors truncate"
            >
              <span className="sm:hidden">CoinDCX AI Trader</span>
              <span className="hidden sm:inline">CoinDCX INR Futures AI Trader</span>
            </a>
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-bold shrink-0">
              <Zap className="w-2.5 h-2.5" /> {defaultLeverage}x INR MARGIN
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 truncate hidden xs:block">
            Auto Derivatives · 1 USDT = ₹{usdtInrRate.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links (Desktop) */}
      <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-400 shrink-0">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`py-1 transition-colors relative ${
            activeTab === 'terminal' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          Terminal & Chart
          {activeTab === 'terminal' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 -mb-2" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('strategy')}
          className={`py-1 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'strategy' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          Futures Strategy & Risk
          {activeTab === 'strategy' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 -mb-2" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`py-1 transition-colors relative ${
            activeTab === 'performance' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          INR Performance
          {activeTab === 'performance' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 -mb-2" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-1 transition-colors relative ${
            activeTab === 'history' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          Trade Logs
          {activeTab === 'history' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 -mb-2" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`py-1 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'security' ? 'text-white font-semibold' : 'hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          CoinDCX Vault
          {activeTab === 'security' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 -mb-2" />
          )}
        </button>
      </nav>

      {/* Zone 3: Collateral & Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* INR Futures Collateral Wallet (Compact on mobile) */}
        <div className={`flex flex-col items-end px-2 sm:px-3 py-0.5 sm:py-1 rounded border transition-colors ${
          isBalanceLow
            ? 'bg-amber-950/40 border-amber-800/80'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-medium">
              <span className="hidden sm:inline">{isLiveMode ? 'Live CoinDCX Margin' : 'Paper Futures Margin'}</span>
              <span className="sm:hidden">Margin</span>
            </span>
            {isBalanceLow && (
              <span className="text-[7px] sm:text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                Low
              </span>
            )}
          </div>
          <span className={`font-mono text-[11px] sm:text-xs font-bold tabular-nums ${
            isBalanceLow ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            ₹{displayInrBalance >= 100000 ? `${(displayInrBalance / 100000).toFixed(1)}L` : displayInrBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Live/Paper Mode Tag */}
        <button
          onClick={onOpenSecurity}
          className="text-[10px] sm:text-[11px] font-mono tracking-wide px-2 sm:px-2.5 py-1 sm:py-1.5 rounded border border-slate-700 hover:border-slate-500 bg-slate-900/80 text-slate-300 transition-colors"
          title="Click to manage CoinDCX Futures API Credentials"
        >
          {isLiveMode ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">LIVE INR</span>
              <span className="sm:hidden">LIVE</span>
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="hidden sm:inline">PAPER</span>
              <span className="sm:hidden">PAPER</span>
            </span>
          )}
        </button>

        {/* Trailing Stop Protection Indicator */}
        <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/60 text-[10px] text-emerald-300 font-mono font-medium shadow-xs" title="Dynamic Trailing Stop Loss is engaged across all positions and algorithmic entries">
          <span className="text-xs">🎯</span>
          <span>Trailing Active</span>
        </div>

        {/* Probability Radar Modal Trigger */}
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 rounded transition-colors shadow-sm"
            title="Auto-scan all CoinDCX futures markets for high-probability setups"
          >
            <Radar className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
            <span className="hidden md:inline">Auto-Radar</span>
          </button>
        )}

        {/* 3 Primitives Confluence Ensemble Trigger */}
        {onOpenConfluenceEnsemble && (
          <button
            onClick={onOpenConfluenceEnsemble}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 rounded transition-colors shadow-sm"
            title="Open 3-Primitives Confluence System (Choice, Score, Bool Gates)"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline">3-Primitives</span>
          </button>
        )}

        {/* Emergency Stop Switch */}
        {openPositionsCount > 0 && (
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/80 border border-rose-800/80 rounded transition-colors whitespace-nowrap"
            title="Immediately close all open leveraged positions and halt trading bot"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Halt</span>
          </button>
        )}

        {/* Bot Running Toggle Action */}
        <button
          onClick={onToggleBot}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            isRunning
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span className="hidden xs:inline">Active</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden xs:inline">Start</span>
            </>
          )}
        </button>

        {/* Trader Profile Avatar */}
        <div
          onClick={onOpenSecurity}
          className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-slate-700 hover:border-emerald-400 cursor-pointer transition-colors shrink-0"
          title="Trader Profile & CoinDCX Settings"
        >
          <img
            src={traderAvatar}
            alt="Quantitative Trader Profile"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.className =
                  'w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300';
                parent.innerHTML = 'AI';
              }
            }}
          />
        </div>
      </div>
    </header>
  );
};
