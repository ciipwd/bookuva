import React from 'react';
import { Terminal, Shield, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';

interface SystemLog {
  id: string;
  timestamp: number;
  level: 'info' | 'trade' | 'warning' | 'error';
  message: string;
}

interface SystemLogPanelProps {
  logs: SystemLog[];
}

export const SystemLogPanel: React.FC<SystemLogPanelProps> = ({ logs }) => {
  const getBadge = (lvl: string) => {
    switch (lvl) {
      case 'trade':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
            EXEC
          </span>
        );
      case 'warning':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
            WARN
          </span>
        );
      case 'error':
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
            ERR
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
            SYS
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0E131F] border border-slate-800 rounded-lg p-3.5 flex flex-col gap-2 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-slate-200 font-bold">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Autonomous Engine Audit Trail</span>
        </div>
        <div className="text-[10px] text-slate-500">Live Tick Event Stream</div>
      </div>

      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
        {logs.length === 0 ? (
          <div className="text-slate-500 text-[11px] py-4 text-center">
            No system execution logs recorded yet.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="pt-1.5 flex items-start gap-2 text-[11px] leading-relaxed">
              <span className="text-slate-500 shrink-0 text-[10px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <div className="shrink-0">{getBadge(log.level)}</div>
              <span
                className={`break-words ${
                  log.level === 'trade'
                    ? 'text-emerald-300'
                    : log.level === 'error'
                    ? 'text-rose-300'
                    : log.level === 'warning'
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }`}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
