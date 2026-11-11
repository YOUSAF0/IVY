import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  FileText,
  UserCheck,
  UserX,
  Sparkles,
} from 'lucide-react';
import { ScanSession, StudentFolder } from '../types/verification';
import { maskCnic } from '../utils/studentIdentification';

interface MatrixTableProps {
  session: ScanSession;
  maskCnicEnabled: boolean;
  onSelectStudent: (student: StudentFolder) => void;
  activeCategories: string[];
}

export const MatrixTable: React.FC<MatrixTableProps> = ({
  session,
  maskCnicEnabled,
  onSelectStudent,
  activeCategories,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [docFilter, setDocFilter] = useState<{
    category: string;
    state: 'has' | 'missing' | 'any';
  }>({ category: '', state: 'any' });

  // Filter students
  const filteredStudents = useMemo(() => {
    return session.students.filter(student => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = student.studentName.toLowerCase().includes(term);
        const matchesCnic = student.cnic.toLowerCase().includes(term);
        const matchesFolder = student.folderName.toLowerCase().includes(term);
        if (!matchesName && !matchesCnic && !matchesFolder) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        if (student.identificationStatus !== statusFilter) return false;
      }

      // 3. Dynamic Document filter
      if (docFilter.category && docFilter.state !== 'any') {
        const hasDoc = student.files.some(
          f => f.category.toLowerCase() === docFilter.category.toLowerCase()
        );
        if (docFilter.state === 'has' && !hasDoc) return false;
        if (docFilter.state === 'missing' && hasDoc) return false;
      }

      return true;
    });
  }, [session.students, searchTerm, statusFilter, docFilter]);

  const categories = activeCategories.length > 0 ? activeCategories : session.categories;

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'IDENTIFIED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <UserCheck className="w-2.5 h-2.5 mr-1" />
            IDENTIFIED
          </span>
        );
      case 'PARTIALLY IDENTIFIED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <HelpCircle className="w-2.5 h-2.5 mr-1" />
            PARTIAL
          </span>
        );
      case 'AMBIGUOUS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <ShieldAlert className="w-2.5 h-2.5 mr-1" />
            AMBIGUOUS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            <UserX className="w-2.5 h-2.5 mr-1" />
            UNIDENTIFIED
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, CNIC, folder..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Statuses ({session.students.length})</option>
                <option value="IDENTIFIED" className="bg-slate-900">Identified</option>
                <option value="PARTIALLY IDENTIFIED" className="bg-slate-900">Partially Identified</option>
                <option value="AMBIGUOUS" className="bg-slate-900">Ambiguous</option>
              </select>
            </div>

            {/* Dynamic Document Category Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-slate-400 text-[11px]">Document:</span>
              <select
                value={docFilter.category}
                onChange={(e) => setDocFilter(prev => ({ ...prev, category: e.target.value }))}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="" className="bg-slate-900">Any Document</option>
                {categories.map(c => (
                  <option key={c} value={c} className="bg-slate-900">{c}</option>
                ))}
              </select>
              {docFilter.category && (
                <select
                  value={docFilter.state}
                  onChange={(e) => setDocFilter(prev => ({ ...prev, state: e.target.value as any }))}
                  className="bg-slate-750 text-indigo-300 font-medium text-xs focus:outline-none cursor-pointer rounded px-1.5 py-0.5 border border-slate-700"
                >
                  <option value="any">Either</option>
                  <option value="has">Has (✓ TRUE)</option>
                  <option value="missing">Missing</option>
                </select>
              )}
            </div>

            {(searchTerm || statusFilter !== 'ALL' || docFilter.category) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setDocFilter({ category: '', state: 'any' });
                }}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Category Chips Scroll */}
        <div className="flex items-center space-x-2 pt-1 overflow-x-auto text-xs text-slate-400 pb-1">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center">
            <Sparkles className="w-3 h-3 text-amber-400 mr-1" />
            {categories.length} Document Columns:
          </span>
          {categories.map((cat) => {
            const isSelected = docFilter.category === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  if (isSelected) {
                    setDocFilter({ category: '', state: 'any' });
                  } else {
                    setDocFilter({ category: cat, state: 'has' });
                  }
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700/60 hover:bg-slate-750'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Matrix Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Table scroll container */}
        <div className="overflow-x-auto max-h-[640px] relative">
          <table className="w-full text-left text-xs border-collapse">
            {/* Table Header */}
            <thead className="bg-slate-850 text-slate-300 font-semibold sticky top-0 z-30 border-b border-slate-800 select-none shadow-sm">
              <tr>
                {/* Fixed Column 1: Sr No */}
                <th className="py-3.5 px-3 w-12 sticky left-0 z-30 bg-slate-850 border-r border-slate-800 text-center font-mono text-[11px] text-slate-400">
                  #
                </th>

                {/* Fixed Column 2: Student Name */}
                <th className="py-3.5 px-4 min-w-[190px] sticky left-12 z-30 bg-slate-850 border-r border-slate-800">
                  Student Name
                </th>

                {/* Fixed Column 3: CNIC */}
                <th className="py-3.5 px-4 min-w-[160px] sticky left-[238px] z-30 bg-slate-850 border-r border-slate-800">
                  CNIC
                </th>

                {/* Status Column */}
                <th className="py-3.5 px-3 min-w-[120px] border-r border-slate-800">
                  Status
                </th>

                {/* Dynamic Document Columns */}
                {categories.map((cat) => (
                  <th
                    key={cat}
                    title={cat}
                    className="py-3.5 px-3.5 min-w-[130px] border-r border-slate-800/60 text-slate-200 font-semibold tracking-tight text-center"
                  >
                    <div className="truncate max-w-[125px] mx-auto">{cat}</div>
                  </th>
                ))}

                {/* Actions */}
                <th className="py-3.5 px-3 min-w-[80px] text-center sticky right-0 bg-slate-850 border-l border-slate-800 z-30">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/70 font-sans">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + categories.length}
                    className="py-12 text-center text-slate-400"
                  >
                    No students matched the search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const displayCnic = maskCnicEnabled
                    ? maskCnic(student.cnic)
                    : student.cnic || '—';

                  return (
                    <tr
                      key={student.id}
                      onClick={() => onSelectStudent(student)}
                      className="group hover:bg-indigo-950/20 cursor-pointer transition-colors"
                    >
                      {/* Fixed Col 1: Sr no */}
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400 sticky left-0 z-20 bg-slate-900 group-hover:bg-slate-850 border-r border-slate-800">
                        {idx + 1}
                      </td>

                      {/* Fixed Col 2: Student Name */}
                      <td className="py-3 px-4 font-semibold text-white sticky left-12 z-20 bg-slate-900 group-hover:bg-slate-850 border-r border-slate-800">
                        <div className="flex items-center space-x-2">
                          <span className="truncate max-w-[170px]" title={student.studentName}>
                            {student.studentName}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">
                          {student.folderName}
                        </div>
                      </td>

                      {/* Fixed Col 3: CNIC */}
                      <td className="py-3 px-4 font-mono text-xs sticky left-[238px] z-20 bg-slate-900 group-hover:bg-slate-850 border-r border-slate-800">
                        <span
                          className={
                            student.cnic
                              ? 'text-slate-200'
                              : 'text-slate-500 italic text-[11px]'
                          }
                        >
                          {displayCnic}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 border-r border-slate-800">
                        {renderStatusBadge(student.identificationStatus)}
                      </td>

                      {/* Dynamic Document Columns */}
                      {categories.map((cat) => {
                        const matchedFiles = student.files.filter(
                          f => f.category.toLowerCase() === cat.toLowerCase()
                        );
                        const isAvailable = matchedFiles.length > 0;

                        return (
                          <td
                            key={cat}
                            className="py-3 px-3 text-center border-r border-slate-800/60"
                          >
                            {isAvailable ? (
                              <span
                                title={`${matchedFiles.length} file(s) available: ${matchedFiles.map(f => f.fileName).join(', ')}`}
                                className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                TRUE
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono text-sm select-none">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="py-3 px-3 text-center sticky right-0 bg-slate-900 group-hover:bg-slate-850 border-l border-slate-800 z-20"
                      >
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => onSelectStudent(student)}
                            title="View Student Documents"
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-3 bg-slate-850 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div>
            Showing <span className="font-semibold text-white">{filteredStudents.length}</span> of{' '}
            <span className="font-semibold text-white">{session.students.length}</span> student folders
            {filteredStudents.length < session.students.length && ' (filtered)'}
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <span className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" />
              TRUE = Available Document
            </span>
            <span className="flex items-center">
              <span className="text-slate-600 font-bold mr-1.5">—</span>
              Blank = Not Available
            </span>
            <span className="text-indigo-400 font-medium">
              Horizontal scroll enabled for dynamic columns →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
