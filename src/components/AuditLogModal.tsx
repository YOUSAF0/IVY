import React from 'react';
import { X, History, Shield, ShieldCheck, Download } from 'lucide-react';
import { AuditLog } from '../types/verification';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLog[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-850/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">System Audit Log & Traceability</h2>
              <p className="text-xs text-slate-400">
                Immutable security and verification activity log for compliance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-3">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center space-x-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All folder scans, classification overrides, Excel exports, and CNIC privacy actions are automatically logged.
            </span>
          </div>

          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-white">{log.action}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      {log.user}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono text-[11px]">{log.details}</p>
                </div>
                <div className="text-[11px] text-slate-400 font-mono shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()} • {new Date(log.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
