import React from 'react';
import {
  FileSpreadsheet,
  FolderSync,
  Layers,
  AlertCircle,
  Eye,
  EyeOff,
  History,
  Download,
  FileText,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { ScanSession } from '../types/verification';

interface HeaderProps {
  session: ScanSession | null;
  maskCnic: boolean;
  onToggleMaskCnic: () => void;
  onOpenScanModal: () => void;
  onOpenCategoryManager: () => void;
  onOpenReviewModal: () => void;
  onOpenAuditLog: () => void;
  onOpenSummaryModal: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  reviewCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  maskCnic,
  onToggleMaskCnic,
  onOpenScanModal,
  onOpenCategoryManager,
  onOpenReviewModal,
  onOpenAuditLog,
  onOpenSummaryModal,
  onExportExcel,
  onExportCsv,
  reviewCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Student Document Verification & Excel Reporting
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Auto-Matrix
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated Google Drive student folder scanner with dynamic document classification
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* CNIC Masking Toggle */}
            <button
              onClick={onToggleMaskCnic}
              title={maskCnic ? 'CNIC is currently masked (Click to reveal full CNIC)' : 'CNIC is revealed (Click to mask)'}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                maskCnic
                  ? 'bg-slate-800 text-amber-300 border-amber-500/30 hover:bg-slate-750'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/50 hover:bg-amber-500/20'
              }`}
            >
              {maskCnic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{maskCnic ? 'CNIC: Masked' : 'CNIC: Revealed'}</span>
            </button>

            {/* Document Review Flag button */}
            <button
              onClick={onOpenReviewModal}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                reviewCount > 0
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/40 hover:bg-rose-500/20 animate-pulse'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Review Files</span>
              {reviewCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {reviewCount}
                </span>
              )}
            </button>

            {/* Category Normalizer */}
            <button
              onClick={onOpenCategoryManager}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750 hover:text-white transition"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Categories</span>
            </button>

            {/* Summary Stats */}
            <button
              onClick={onOpenSummaryModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750 hover:text-white transition"
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
              <span>Summary</span>
            </button>

            {/* Audit Logs */}
            <button
              onClick={onOpenAuditLog}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750 hover:text-white transition"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Audit Log</span>
            </button>

            {/* Scan Drive Folder */}
            <button
              onClick={onOpenScanModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition ring-1 ring-indigo-400/40"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>Scan Folder</span>
            </button>

            {/* Export Excel (Primary) */}
            <div className="flex items-center rounded-lg bg-emerald-600 p-0.5 shadow-md shadow-emerald-600/20">
              <button
                onClick={onExportExcel}
                className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 rounded-l-md transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <div className="h-4 w-px bg-emerald-700" />
              <button
                onClick={onExportCsv}
                title="Download CSV"
                className="px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500 hover:text-white rounded-r-md transition"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
