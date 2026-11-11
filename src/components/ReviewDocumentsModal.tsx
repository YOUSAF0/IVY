import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  FileQuestion,
  CheckCircle2,
  ExternalLink,
  Tag,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { ScanSession, ScannedFile, StudentFolder } from '../types/verification';

interface ReviewDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ScanSession;
  categories: string[];
  onReclassifyFile: (
    studentId: string,
    fileId: string,
    newCategory: string
  ) => void;
}

export const ReviewDocumentsModal: React.FC<ReviewDocumentsModalProps> = ({
  isOpen,
  onClose,
  session,
  categories,
  onReclassifyFile,
}) => {
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Gather all files that have LOW or MEDIUM confidence or are marked as 'Unknown'
  const reviewItems: {
    student: StudentFolder;
    file: ScannedFile;
  }[] = [];

  for (const student of session.students) {
    for (const file of student.files) {
      if (file.confidence === 'LOW' || file.category === 'Unknown') {
        reviewItems.push({ student, file });
      }
    }
  }

  const handleAssignCategory = (
    studentId: string,
    fileId: string,
    cat: string
  ) => {
    onReclassifyFile(studentId, fileId, cat);
    setSuccessMessage(`File reclassified into "${cat}". Updated report matrix!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-850/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Review Low-Confidence & Ambiguous Files</h2>
              <p className="text-xs text-slate-400">
                Manually resolve unclassified documents to ensure 100% matrix accuracy
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
        <div className="p-6 overflow-y-auto space-y-4">
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {reviewItems.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">All Documents Classified!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No files are currently pending review. Every discovered document has been assigned to a standardized category.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Found <strong className="text-rose-400">{reviewItems.length}</strong> file(s) requiring verification:
                </span>
                <span className="text-[11px] text-slate-500">
                  Priority 3 — Content & Admin Classification
                </span>
              </div>

              {reviewItems.map(({ student, file }) => {
                const candidates = file.possibleCategories || ['HSSC', 'SSC', 'Consent Form', 'Pic'];
                const customVal = customInputs[file.id] || '';

                return (
                  <div
                    key={file.id}
                    className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-3 hover:border-slate-600 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2 font-mono">
                          <FileQuestion className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-bold text-white">{file.fileName}</span>
                          <span className="text-[11px] text-slate-400">
                            ({(file.fileSize / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Student:{' '}
                          <span className="text-slate-200 font-semibold">
                            {student.studentName}
                          </span>{' '}
                          • Folder: <span className="font-mono text-slate-300">{student.folderName}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          {file.confidence} CONFIDENCE
                        </span>
                        <a
                          href={file.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
                          title="Open Drive File"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="font-semibold text-slate-300">Detection note:</span>{' '}
                      {file.reason || 'Filename does not strictly match academic keywords.'}
                    </div>

                    {/* Quick Category Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center">
                        <Tag className="w-3 h-3 mr-1 text-indigo-400" />
                        Assign Category:
                      </span>

                      {candidates.map(cand => (
                        <button
                          key={cand}
                          onClick={() => handleAssignCategory(student.id, file.id, cand)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white transition border border-slate-600"
                        >
                          {cand}
                        </button>
                      ))}

                      {/* Custom input or other categories */}
                      <div className="flex items-center space-x-1.5 ml-auto">
                        <input
                          type="text"
                          placeholder="Other category..."
                          value={customVal}
                          onChange={(e) =>
                            setCustomInputs({ ...customInputs, [file.id]: e.target.value })
                          }
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => {
                            if (customVal.trim()) {
                              handleAssignCategory(student.id, file.id, customVal.trim());
                            }
                          }}
                          disabled={!customVal.trim()}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold"
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Manual classifications are logged to the audit trail and update the matrix in real-time.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
};
