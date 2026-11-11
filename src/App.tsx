/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  FileSpreadsheet,
  FolderSync,
  Layers,
  AlertCircle,
  FolderOpen,
  Download,
  FileText,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Table,
  Files,
  FolderX,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

import { AuditLog, ScanSession, StudentFolder } from './types/verification';
import { buildSampleSession } from './utils/sampleData';
import { generateVerificationExcel, downloadBlob, exportMatrixToCsv } from './utils/excelExport';
import { maskCnic } from './utils/studentIdentification';

import { Header } from './components/Header';
import { ScanModal } from './components/ScanModal';
import { MatrixTable } from './components/MatrixTable';
import { StudentDetailModal } from './components/StudentDetailModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { ReviewDocumentsModal } from './components/ReviewDocumentsModal';
import { SummaryStatsModal } from './components/SummaryStatsModal';
import { AuditLogModal } from './components/AuditLogModal';

export default function App() {
  // Initial scan session pre-loaded with comprehensive Admissions 2026 data
  const [session, setSession] = useState<ScanSession>(() => buildSampleSession());
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [maskCnicEnabled, setMaskCnicEnabled] = useState<boolean>(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'matrix' | 'details' | 'unidentified_files' | 'unidentified_folders'>('matrix');

  // Modals
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentFolder | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'log_init',
      timestamp: new Date().toISOString(),
      action: 'Session Initialized',
      details: 'Loaded admissions folder scanner workspace with 18 candidate folders.',
      user: 'admin@institution.edu',
    },
  ]);

  const addAuditLog = (action: string, details: string) => {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user: 'admin@institution.edu',
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Categories list
  const currentCategories = activeCategories.length > 0 ? activeCategories : session.categories;

  // Unidentified & low-confidence count
  const reviewCount = useMemo(() => {
    let count = 0;
    for (const s of session.students) {
      for (const f of s.files) {
        if (f.confidence === 'LOW' || f.category === 'Unknown') {
          count++;
        }
      }
    }
    return count;
  }, [session.students]);

  // Handle Scan Complete
  const handleScanComplete = (newSession: ScanSession) => {
    setSession(newSession);
    setActiveCategories(newSession.categories);
    addAuditLog(
      'Drive Folder Scanned',
      `Scanned "${newSession.folderName}" (${newSession.sourceType}): ${newSession.students.length} student folders, ${newSession.totalFilesCount} files, ${newSession.categories.length} categories.`
    );
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch (_) {}
  };

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      const blob = generateVerificationExcel(session, {
        maskCnicValues: maskCnicEnabled,
        activeCategories: currentCategories,
      });

      const today = new Date().toISOString().split('T')[0];
      const filename = `Student_Document_Verification_Report_${today}.xlsx`;
      downloadBlob(blob, filename);

      addAuditLog(
        'Excel Report Downloaded',
        `Generated 5-sheet workbook "${filename}" with ${currentCategories.length} dynamic document columns.`
      );

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    try {
      const blob = exportMatrixToCsv(session, currentCategories, maskCnicEnabled);
      const today = new Date().toISOString().split('T')[0];
      const filename = `Student_Document_Matrix_${today}.csv`;
      downloadBlob(blob, filename);

      addAuditLog(
        'CSV Export Downloaded',
        `Exported verification matrix "${filename}".`
      );
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  // Toggle Mask CNIC
  const handleToggleMaskCnic = () => {
    const next = !maskCnicEnabled;
    setMaskCnicEnabled(next);
    addAuditLog(
      'CNIC Privacy Toggled',
      `User ${next ? 'masked' : 'unmasked full'} student CNIC identification numbers.`
    );
  };

  // Handle Category Merge / Updates
  const handleUpdateCategories = (newCategories: string[], updatedSession: ScanSession) => {
    setActiveCategories(newCategories);
    setSession(updatedSession);
    addAuditLog(
      'Document Categories Updated',
      `Master categories list updated to ${newCategories.length} normalized columns.`
    );
  };

  // Handle Reclassify File
  const handleReclassifyFile = (studentId: string, fileId: string, newCategory: string) => {
    const updatedStudents = session.students.map(s => {
      if (s.id !== studentId) return s;
      const updatedFiles = s.files.map(f => {
        if (f.id === fileId) {
          return {
            ...f,
            category: newCategory,
            confidence: 'HIGH' as const,
            detectionMethod: 'Admin Manual Review' as const,
            reason: 'Manually verified and assigned by administrator.',
          };
        }
        return f;
      });
      return {
        ...s,
        files: updatedFiles,
        unidentifiedFiles: updatedFiles.filter(f => f.confidence === 'LOW' || f.category === 'Unknown'),
      };
    });

    let updatedCategories = [...currentCategories];
    if (!updatedCategories.includes(newCategory)) {
      updatedCategories.push(newCategory);
    }

    setSession({
      ...session,
      students: updatedStudents,
      categories: updatedCategories,
    });
    setActiveCategories(updatedCategories);

    addAuditLog(
      'File Reclassified',
      `Reclassified file "${fileId}" into category "${newCategory}".`
    );
  };

  // Flat list of all documents for Sheet 3 Details tab
  const allDocumentsList = useMemo(() => {
    const list: {
      student: StudentFolder;
      file: typeof session.students[0]['files'][0];
    }[] = [];
    for (const s of session.students) {
      for (const f of s.files) {
        list.push({ student: s, file: f });
      }
    }
    return list;
  }, [session.students]);

  // Unidentified files list
  const allUnidentifiedFilesList = useMemo(() => {
    const list: {
      student: StudentFolder;
      file: typeof session.students[0]['files'][0];
    }[] = [];
    for (const s of session.students) {
      for (const uf of s.unidentifiedFiles) {
        list.push({ student: s, file: uf });
      }
    }
    return list;
  }, [session.students]);

  // Unidentified folders
  const allUnidentifiedFolders = useMemo(() => {
    return [
      ...session.unidentifiedFolders,
      ...session.students.filter(s => s.identificationStatus === 'UNIDENTIFIED'),
    ];
  }, [session.unidentifiedFolders, session.students]);

  const identifiedCount = session.students.filter(s => s.identificationStatus === 'IDENTIFIED').length;
  const partialCount = session.students.filter(s => s.identificationStatus === 'PARTIALLY IDENTIFIED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        session={session}
        maskCnic={maskCnicEnabled}
        onToggleMaskCnic={handleToggleMaskCnic}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
        onOpenReviewModal={() => setIsReviewModalOpen(true)}
        onOpenAuditLog={() => setIsAuditModalOpen(true)}
        onOpenSummaryModal={() => setIsSummaryModalOpen(true)}
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        reviewCount={reviewCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Verification Overview Dashboard Card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Target Admissions Folder
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span className="text-xs font-mono text-slate-400">
                  ID: {session.folderId}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    session.sourceType === 'google_drive_link'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : session.sourceType === 'local_folder'
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {session.sourceType === 'google_drive_link'
                    ? '✓ Live Google Drive Link'
                    : session.sourceType === 'local_folder'
                    ? '✓ Live Local Directory'
                    : 'ℹ Demo Sample Dataset'}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-white flex flex-wrap items-center gap-3">
                <span>{session.folderName}</span>
                {session.driveUrl && session.driveUrl !== '#' && (
                  <a
                    href={session.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-normal text-indigo-400 hover:text-indigo-300 flex items-center bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                  >
                    <FolderOpen className="w-3.5 h-3.5 mr-1" />
                    Open in Google Drive
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </h2>
              <p className="text-xs text-slate-400 max-w-2xl">
                {session.sourceType === 'sample_dataset'
                  ? 'Currently displaying reference demonstration applicants. Click "Scan Actual Folder" to load your real Google Drive or local files.'
                  : `Active scan of "${session.folderName}". Files classified and mapped to the dynamic verification matrix.`}
              </p>
            </div>

            {/* Quick Action Button */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={handleExportExcel}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Excel Report (.xlsx)</span>
              </button>
              <button
                onClick={() => setIsScanModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition"
              >
                <FolderSync className="w-4 h-4" />
                <span>Scan Actual Folder</span>
              </button>
            </div>
          </div>

          {/* Metrics summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="text-[11px] text-slate-400">Student Folders</div>
              <div className="text-xl font-bold text-white font-mono mt-0.5">
                {session.students.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="text-[11px] text-slate-400">Identified Students</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                {identifiedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="text-[11px] text-slate-400">Unidentified Folders</div>
              <div className="text-xl font-bold text-rose-400 font-mono mt-0.5">
                {allUnidentifiedFolders.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="text-[11px] text-slate-400">Documents Found</div>
              <div className="text-xl font-bold text-sky-400 font-mono mt-0.5">
                {session.totalFilesCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-400">Dynamic Columns</div>
              <div className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                {currentCategories.length}
              </div>
            </div>
          </div>
        </div>

        {/* Authenticity Disclaimer Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-amber-200">Authenticity Disclaimer:</strong> The system automatically verifies that required documents and certificates exist in the student's folder. It does not establish legal authenticity or government validation.
          </div>
        </div>

        {/* Excel Sheets Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 overflow-x-auto">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Sheet 1: Verification Report (Matrix)</span>
            </button>

            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'details'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Files className="w-3.5 h-3.5" />
              <span>Sheet 3: Document Details ({allDocumentsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('unidentified_files')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'unidentified_files'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Sheet 4: Unidentified Files ({allUnidentifiedFilesList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('unidentified_folders')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'unidentified_folders'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FolderX className="w-3.5 h-3.5 text-amber-400" />
              <span>Sheet 5: Unidentified Folders ({allUnidentifiedFolders.length})</span>
            </button>
          </div>

          <button
            onClick={() => setIsSummaryModalOpen(true)}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-400 hover:bg-sky-500/10 border border-sky-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>View Sheet 2 Summary</span>
          </button>
        </div>

        {/* Tab 1: Verification Matrix (Primary) */}
        {activeTab === 'matrix' && (
          <MatrixTable
            session={session}
            maskCnicEnabled={maskCnicEnabled}
            onSelectStudent={(student) => setSelectedStudent(student)}
            activeCategories={currentCategories}
          />
        )}

        {/* Tab 2: Document Details Traceability (Sheet 3) */}
        {activeTab === 'details' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Document Traceability Log</h3>
                <p className="text-xs text-slate-400">
                  Every scanned file with MIME type, detection method, and Google Drive traceability ID
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {allDocumentsList.length} files
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-850 text-slate-300 font-semibold sticky top-0 z-20 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">CNIC</th>
                    <th className="py-3 px-4">Document Category</th>
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">MIME Type</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Confidence</th>
                    <th className="py-3 px-3 text-center">Drive Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {allDocumentsList.map(({ student, file }, idx) => (
                    <tr key={file.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-white">{student.studentName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-300">
                        {maskCnicEnabled ? maskCnic(student.cnic) : student.cnic || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {file.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-200">{file.fileName}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{file.mimeType}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{file.detectionMethod}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            file.confidence === 'HIGH'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : file.confidence === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          }`}
                        >
                          {file.confidence}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <a
                          href={file.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 inline-flex text-indigo-400 hover:text-white"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Unidentified Files (Sheet 4) */}
        {activeTab === 'unidentified_files' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Unidentified & Ambiguous Files</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Files that could not be confidently classified automatically and require manual review
                </p>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
              >
                Open Review Tool
              </button>
            </div>

            {allUnidentifiedFilesList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No unidentified files detected in this scan session.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-850 text-slate-300 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Possible Category</th>
                      <th className="py-3 px-3">Confidence</th>
                      <th className="py-3 px-6">Reason / Note</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {allUnidentifiedFilesList.map(({ student, file }) => (
                      <tr key={file.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">{student.studentName}</td>
                        <td className="py-3 px-4 font-mono text-slate-200">{file.fileName}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {file.possibleCategories?.join(', ') || 'Unknown'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                            {file.confidence}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-slate-400 text-xs">{file.reason || 'Manual review required'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setIsReviewModalOpen(true)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-semibold border border-slate-700"
                          >
                            Classify
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Unidentified Folders (Sheet 5) */}
        {activeTab === 'unidentified_folders' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <FolderX className="w-4 h-4 text-amber-400" />
                  <span>Unidentified Folders</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Folders in Google Drive that could not be matched to an applicant or student identity
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {allUnidentifiedFolders.length} folders
              </span>
            </div>

            {allUnidentifiedFolders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                All folders were identified successfully.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-850 text-slate-300 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Folder Name</th>
                      <th className="py-3 px-4">Drive ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6">Reason</th>
                      <th className="py-3 px-4 text-center">Drive Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {allUnidentifiedFolders.map((uf) => (
                      <tr key={uf.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">{uf.folderName}</td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{uf.folderId}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            {uf.identificationStatus}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-slate-400 text-xs">{uf.reason || 'Non-student folder'}</td>
                        <td className="py-3 px-4 text-center">
                          <a
                            href={uf.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 inline-flex text-indigo-400 hover:text-white"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onScanComplete={handleScanComplete}
      />

      <StudentDetailModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        categories={currentCategories}
        globalMaskCnic={maskCnicEnabled}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        session={session}
        activeCategories={currentCategories}
        onUpdateCategories={handleUpdateCategories}
      />

      <ReviewDocumentsModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        session={session}
        categories={currentCategories}
        onReclassifyFile={handleReclassifyFile}
      />

      <SummaryStatsModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        session={session}
        categories={currentCategories}
        onExportExcel={handleExportExcel}
      />

      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
      />
    </div>
  );
}
