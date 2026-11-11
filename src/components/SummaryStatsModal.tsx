import React from 'react';
import {
  X,
  BarChart3,
  Users,
  FileCheck2,
  FolderSync,
  HelpCircle,
  ShieldAlert,
  FolderX,
  Download,
} from 'lucide-react';
import { ScanSession } from '../types/verification';

interface SummaryStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ScanSession;
  categories: string[];
  onExportExcel: () => void;
}

export const SummaryStatsModal: React.FC<SummaryStatsModalProps> = ({
  isOpen,
  onClose,
  session,
  categories,
  onExportExcel,
}) => {
  if (!isOpen) return null;

  const validStudents = session.students.filter(
    s => s.identificationStatus !== 'UNIDENTIFIED'
  );
  const totalFolders = session.students.length + session.unidentifiedFolders.length;
  const identifiedCount = session.students.filter(s => s.identificationStatus === 'IDENTIFIED').length;
  const partialCount = session.students.filter(s => s.identificationStatus === 'PARTIALLY IDENTIFIED').length;
  const ambiguousCount = session.students.filter(s => s.identificationStatus === 'AMBIGUOUS').length;
  const unidentifiedCount = session.unidentifiedFolders.length + session.students.filter(s => s.identificationStatus === 'UNIDENTIFIED').length;

  const currentCategories = categories.length > 0 ? categories : session.categories;

  // Calculate availability stats for every category
  const statsList = currentCategories.map(cat => {
    const studentCountWithDoc = validStudents.filter(s =>
      s.files.some(f => f.category.toLowerCase() === cat.toLowerCase())
    ).length;
    const percentage = validStudents.length > 0
      ? Math.round((studentCountWithDoc / validStudents.length) * 100)
      : 0;

    return {
      category: cat,
      count: studentCountWithDoc,
      percentage,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-850/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Document Availability Statistics (Sheet 2 Summary)</h2>
              <p className="text-xs text-slate-400">
                Aggregated student verification rates across all discovered document categories
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
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Folders</span>
                <FolderSync className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-white font-mono mt-1">
                {totalFolders}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {session.totalFilesCount} total files scanned
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Identified</span>
                <Users className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                {identifiedCount}
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5">
                {totalFolders ? Math.round((identifiedCount / totalFolders) * 100) : 0}% success rate
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Partially / Ambiguous</span>
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                {partialCount + ambiguousCount}
              </div>
              <div className="text-[10px] text-amber-400/80 mt-0.5">
                Missing CNIC or Name
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Unidentified Folders</span>
                <FolderX className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-xl font-bold text-rose-400 font-mono mt-1">
                {unidentifiedCount}
              </div>
              <div className="text-[10px] text-rose-400/80 mt-0.5">
                Listed in Sheet 5
              </div>
            </div>
          </div>

          {/* Document Availability Breakdown List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Document Availability Breakdown ({statsList.length} Categories)
              </h3>
              <span className="text-[11px] text-slate-400">
                Calculated over {validStudents.length} verified applicants
              </span>
            </div>

            <div className="space-y-2.5">
              {statsList.map(({ category, count, percentage }) => (
                <div
                  key={category}
                  className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{category}</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-300 font-bold">
                        {count} / {validStudents.length}
                      </span>
                      <span className="text-[11px] font-bold text-sky-400 w-10 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentage >= 80
                          ? 'bg-emerald-500'
                          : percentage >= 50
                          ? 'bg-sky-500'
                          : percentage >= 20
                          ? 'bg-amber-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <button
            onClick={onExportExcel}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full 5-Sheet Excel</span>
          </button>
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
