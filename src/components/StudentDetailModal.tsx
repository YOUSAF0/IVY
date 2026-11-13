import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
  ShieldCheck,
  Eye,
  EyeOff,
  FolderOpen,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { StudentFolder } from '../types/verification';
import { maskCnic } from '../utils/studentIdentification';

interface StudentDetailModalProps {
  student: StudentFolder | null;
  onClose: () => void;
  categories: string[];
  globalMaskCnic: boolean;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  categories,
  globalMaskCnic,
}) => {
  const [localUnmask, setLocalUnmask] = useState(false);

  if (!student) return null;

  const isMasked = globalMaskCnic && !localUnmask;
  const displayCnic = isMasked ? maskCnic(student.cnic) : student.cnic || 'Not Found';

  // Group files by category
  const filesByCategory = new Map<string, typeof student.files>();
  for (const f of student.files) {
    const cat = f.category;
    if (!filesByCategory.has(cat)) {
      filesByCategory.set(cat, []);
    }
    filesByCategory.get(cat)!.push(f);
  }

  // Available categories for this student
  const availableCategories = categories.filter(c => filesByCategory.has(c));
  const missingCategories = categories.filter(c => !filesByCategory.has(c));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-850/60">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white">{student.studentName}</h2>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  student.identificationStatus === 'IDENTIFIED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : student.identificationStatus === 'PARTIALLY IDENTIFIED'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}
              >
                {student.identificationStatus}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold text-slate-300">CNIC:</span>
                <span className="font-mono text-slate-100">{displayCnic}</span>
                {student.cnic && (
                  <button
                    onClick={() => setLocalUnmask(!localUnmask)}
                    title={localUnmask ? 'Mask CNIC' : 'Reveal full CNIC'}
                    className="p-1 text-slate-400 hover:text-amber-400 transition"
                  >
                    {localUnmask ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold text-slate-300">Belongs To:</span>{' '}
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {student.belongsTo || student.parentFolder || 'Admissions'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-300">Folder:</span>{' '}
                <span className="font-mono text-slate-300">{student.folderName}</span>
              </div>
              {student.folderPath && student.folderPath !== student.folderName && (
                <div className="w-full text-[11px] text-slate-500 font-mono">
                  Full Path: {student.folderPath}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={student.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open in Drive</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Authenticity Disclaimer Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Authenticity Disclaimer:</span> This system verifies document category presence and availability. It does NOT establish legal validity or government authenticity.
            </div>
          </div>

          {/* Available Documents Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Available Documents ({availableCategories.length})
              </h3>
              <span className="text-xs text-slate-400">
                {student.files.length} total file(s) attached
              </span>
            </div>

            <div className="space-y-2.5">
              {availableCategories.map((cat) => {
                const files = filesByCategory.get(cat) || [];
                return (
                  <div
                    key={cat}
                    className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-sm text-white">{cat}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        AVAILABLE
                      </span>
                    </div>

                    {/* Files under this category */}
                    <div className="space-y-1.5 pl-6 pt-1 border-t border-slate-700/40">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex flex-wrap items-center justify-between text-xs text-slate-300 py-1 gap-2"
                        >
                          <div className="flex items-center space-x-2 font-mono">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-white font-medium">{file.fileName}</span>
                            <span className="text-slate-500 text-[11px]">
                              ({(file.fileSize / 1024).toFixed(0)} KB)
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {file.detectionMethod}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                file.confidence === 'HIGH'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : file.confidence === 'MEDIUM'
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                              }`}
                            >
                              {file.confidence} CONFIDENCE
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Missing Documents Section */}
          {missingCategories.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center mb-3">
                <XCircle className="w-4 h-4 mr-1.5 text-slate-500" />
                Missing Documents ({missingCategories.length})
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {missingCategories.map((cat) => (
                  <div
                    key={cat}
                    className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-800 text-xs text-slate-400 flex items-center justify-between"
                  >
                    <span className="truncate mr-2">{cat}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Not found
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Student ID: <span className="font-mono text-slate-300">{student.id}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Close Detail
          </button>
        </div>
      </div>
    </div>
  );
};
