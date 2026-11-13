import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  FolderSync,
  Upload,
  Link,
  Sparkles,
  CheckCircle2,
  FolderCheck,
  FileCheck2,
  AlertTriangle,
  Key,
  ShieldAlert,
  ClipboardList,
  Info,
  Folder,
  FolderTree,
  ChevronRight,
  CheckSquare,
  Square,
  Search,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import {
  ScanProgress,
  extractDriveFolderId,
  scanRealGoogleDrive,
  scanLocalDirectoryAdvanced,
  analyzeLocalDirectoryHierarchy,
  HierarchyAnalysis,
  parsePastedFolderTree,
} from '../services/driveScanner';
import { ScanSession } from '../types/verification';
import { buildSampleSession } from '../utils/sampleData';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (session: ScanSession) => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'local' | 'paste' | 'presets'>('local');
  const [driveUrl, setDriveUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showAuthFields, setShowAuthFields] = useState(false);

  // Local Directory State
  const [localFileList, setLocalFileList] = useState<FileList | null>(null);
  const [hierarchyAnalysis, setHierarchyAnalysis] = useState<HierarchyAnalysis | null>(null);
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<Set<string>>(new Set());
  const [studentLevelMode, setStudentLevelMode] = useState<'auto' | 1 | 2 | 3 | 4>('auto');
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [depthFilter, setDepthFilter] = useState<'all' | '1' | '2' | '3' | '4'>('all');

  const [pastedText, setPastedText] = useState(
    `Admissions 2026/Computer Science/Muhammad Abdullah - 33102-3014734-3/CNIC.pdf
Admissions 2026/Computer Science/Muhammad Abdullah - 33102-3014734-3/O Level Certificate.pdf
Admissions 2026/Computer Science/Muhammad Abdullah - 33102-3014734-3/A Level Certificate.pdf
Admissions 2026/Computer Science/Muhammad Abdullah - 33102-3014734-3/Personal Statement.pdf
Admissions 2026/Computer Science/Muhammad Abdullah - 33102-3014734-3/applicant_photo.jpg
Admissions 2026/Computer Science/Huzaifa Bilal - 33102-6411602-7/CNIC Front.jpg
Admissions 2026/Computer Science/Huzaifa Bilal - 33102-6411602-7/CNIC Back.jpg
Admissions 2026/Computer Science/Huzaifa Bilal - 33102-6411602-7/HSSC Certificate.pdf
Admissions 2026/Computer Science/Huzaifa Bilal - 33102-6411602-7/SSC Matric Result.pdf
Admissions 2026/Computer Science/Huzaifa Bilal - 33102-6411602-7/English Proficiency Letter.pdf
Admissions 2026/Business Administration/Natasha Gulam - 33102-5819201-2/CNIC.pdf
Admissions 2026/Business Administration/Natasha Gulam - 33102-5819201-2/Pic.jpg
Admissions 2026/Business Administration/Natasha Gulam - 33102-5819201-2/BTEC Extended Diploma.pdf`
  );

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState<{
    title: string;
    details: string;
    code?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered subfolder list based on search and depth
  const filteredSubFolders = useMemo(() => {
    if (!hierarchyAnalysis) return [];
    return hierarchyAnalysis.subFolders.filter(sf => {
      if (depthFilter !== 'all' && sf.depth !== parseInt(depthFilter, 10)) {
        return false;
      }
      if (folderSearchTerm.trim()) {
        const term = folderSearchTerm.toLowerCase();
        return (
          sf.name.toLowerCase().includes(term) ||
          sf.path.toLowerCase().includes(term) ||
          (sf.detectedStudentName && sf.detectedStudentName.toLowerCase().includes(term)) ||
          (sf.detectedCnic && sf.detectedCnic.includes(term))
        );
      }
      return true;
    });
  }, [hierarchyAnalysis, folderSearchTerm, depthFilter]);

  // Total files in currently selected folders
  const selectedFilesEstimate = useMemo(() => {
    if (!hierarchyAnalysis || selectedFolderPaths.size === 0) return 0;
    let count = 0;
    hierarchyAnalysis.subFolders.forEach(sf => {
      if (selectedFolderPaths.has(sf.path)) {
        count += sf.fileCount;
      }
    });
    return count;
  }, [hierarchyAnalysis, selectedFolderPaths]);

  // Real Google Drive Scan Handler
  const handleStartDriveScan = async () => {
    setScanError(null);
    const folderId = extractDriveFolderId(driveUrl);

    if (!folderId) {
      setScanError({
        title: 'Invalid Google Drive Link',
        details: 'Please enter a valid Google Drive folder URL (e.g. https://drive.google.com/drive/folders/XXXXXXXX) or folder ID.',
      });
      return;
    }

    setIsScanning(true);
    setProgress({
      scannedFolders: 0,
      totalFolders: 1,
      studentFolders: 0,
      filesScanned: 0,
      categoriesFound: 0,
      currentFolder: 'Connecting to Google Drive...',
      progressPercent: 5,
      statusText: `Connecting to Google Drive folder: ${folderId}`,
    });

    try {
      const session = await scanRealGoogleDrive(
        folderId,
        { apiKey: apiKey.trim(), accessToken: accessToken.trim() },
        (p) => setProgress(p)
      );

      setTimeout(() => {
        setIsScanning(false);
        onScanComplete(session);
        onClose();
      }, 400);
    } catch (err: any) {
      console.error('Google Drive scan error:', err);
      setIsScanning(false);
      setScanError({
        title: 'Google Drive Access Failed',
        details: err?.message || 'Access denied or folder not found.',
      });
    }
  };

  // Local Directory Selection (Loads Hierarchy for inspection)
  const handleLocalFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const analysis = analyzeLocalDirectoryHierarchy(files);
      setLocalFileList(files);
      setHierarchyAnalysis(analysis);
      setStudentLevelMode(analysis.suggestedLevel);

      // By default, select all discovered sub-folders and sub-sub-folders
      const allPaths = new Set<string>();
      analysis.subFolders.forEach(sf => allPaths.add(sf.path));
      setSelectedFolderPaths(allPaths);
    } catch (err: any) {
      console.error(err);
      setScanError({
        title: 'Failed to Read Folder Structure',
        details: err?.message || 'Could not parse local folder directory hierarchy.',
      });
    }
  };

  // Execute Scan on Selected Local Folders
  const handleGenerateFromSelectedFolders = async () => {
    if (!localFileList) return;
    setScanError(null);
    setIsScanning(true);
    setProgress({
      scannedFolders: 0,
      totalFolders: selectedFolderPaths.size || 10,
      studentFolders: 0,
      filesScanned: 0,
      categoriesFound: 0,
      currentFolder: 'Scanning selected sub-folders...',
      progressPercent: 5,
      statusText: 'Processing chosen sub-folders and sub-sub-folders...',
    });

    try {
      const session = await scanLocalDirectoryAdvanced(
        localFileList,
        {
          selectedPaths: selectedFolderPaths,
          studentLevelMode,
        },
        (p) => setProgress(p)
      );

      setTimeout(() => {
        setIsScanning(false);
        onScanComplete(session);
        onClose();
      }, 400);
    } catch (err: any) {
      console.error(err);
      setIsScanning(false);
      setScanError({
        title: 'Folder Scan Failed',
        details: err?.message || 'Could not generate report from selected folders.',
      });
    }
  };

  // Toggle single folder path
  const handleToggleFolderPath = (path: string) => {
    const next = new Set(selectedFolderPaths);
    if (next.has(path)) {
      // Uncheck this path and all its child sub-sub-folders
      next.delete(path);
      hierarchyAnalysis?.subFolders.forEach(sf => {
        if (sf.path.startsWith(`${path}/`)) {
          next.delete(sf.path);
        }
      });
    } else {
      // Check this path and all its children
      next.add(path);
      hierarchyAnalysis?.subFolders.forEach(sf => {
        if (sf.path.startsWith(`${path}/`)) {
          next.add(sf.path);
        }
      });
    }
    setSelectedFolderPaths(next);
  };

  // Select all / Deselect all
  const handleSelectAllFolders = () => {
    if (!hierarchyAnalysis) return;
    const all = new Set<string>();
    hierarchyAnalysis.subFolders.forEach(sf => all.add(sf.path));
    setSelectedFolderPaths(all);
  };

  const handleDeselectAllFolders = () => {
    setSelectedFolderPaths(new Set());
  };

  const handleSelectOnlyDepth = (depth: number) => {
    if (!hierarchyAnalysis) return;
    const filtered = new Set<string>();
    hierarchyAnalysis.subFolders.forEach(sf => {
      if (sf.depth === depth) filtered.add(sf.path);
    });
    setSelectedFolderPaths(filtered);
  };

  // Pasted Text Import Handler
  const handleParsePastedStructure = () => {
    setScanError(null);
    if (!pastedText.trim()) {
      setScanError({
        title: 'Empty Input',
        details: 'Please paste student folder paths or file names.',
      });
      return;
    }

    setIsScanning(true);
    setProgress({
      scannedFolders: 0,
      totalFolders: 1,
      studentFolders: 0,
      filesScanned: 0,
      categoriesFound: 0,
      currentFolder: 'Parsing structure...',
      progressPercent: 20,
      statusText: 'Classifying documents from pasted file tree...',
    });

    setTimeout(() => {
      try {
        const session = parsePastedFolderTree(pastedText, 'Imported Admissions Folder');
        setIsScanning(false);
        onScanComplete(session);
        onClose();
      } catch (err: any) {
        setIsScanning(false);
        setScanError({
          title: 'Parsing Failed',
          details: err?.message || 'Could not parse the pasted text into folders.',
        });
      }
    }, 400);
  };

  // Preset Dataset Handler
  const handleLoadPreset = (name: string) => {
    setScanError(null);
    setIsScanning(true);
    setProgress({
      scannedFolders: 0,
      totalFolders: 18,
      studentFolders: 0,
      filesScanned: 0,
      categoriesFound: 0,
      currentFolder: 'Loading reference dataset...',
      progressPercent: 10,
      statusText: `Loading ${name}...`,
    });

    setTimeout(() => {
      const session = buildSampleSession(name);
      setIsScanning(false);
      onScanComplete(session);
      onClose();
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Scan & Select Folders / Sub-folders</h2>
              <p className="text-xs text-slate-400">
                Pick specific sub-folders or sub-sub-folders and generate verified Excel matrices
              </p>
            </div>
          </div>
          {!isScanning && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Error Display */}
          {scanError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-rose-200 text-sm">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>✗ {scanError.title}</span>
              </div>
              <div className="text-[11px] text-rose-200/90 pl-6 leading-relaxed">
                {scanError.details}
              </div>
            </div>
          )}

          {isScanning ? (
            /* Progress view */
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-indigo-400 flex items-center">
                  <FolderSync className="w-4 h-4 mr-1.5 animate-spin" />
                  Scanning chosen folders...
                </span>
                <span className="font-mono text-sm font-bold text-white">
                  {progress?.progressPercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progress?.progressPercent || 0}%` }}
                />
              </div>

              {/* Real-time stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Folders Scanned</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {progress?.scannedFolders} / {progress?.totalFolders}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Student Folders</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {progress?.studentFolders}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Files Scanned</div>
                  <div className="text-lg font-bold text-sky-400 font-mono mt-0.5">
                    {progress?.filesScanned}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Categories Found</div>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                    {progress?.categoriesFound}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800 text-xs text-slate-300 font-mono truncate">
                {progress?.statusText}
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div className="flex border-b border-slate-800 overflow-x-auto">
                <button
                  onClick={() => { setActiveTab('local'); setScanError(null); }}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    activeTab === 'local'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FolderTree className="w-4 h-4" />
                  <span>Select Local Folder & Sub-folders</span>
                </button>

                <button
                  onClick={() => { setActiveTab('drive'); setScanError(null); }}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    activeTab === 'drive'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Link className="w-4 h-4" />
                  <span>Google Drive Link</span>
                </button>

                <button
                  onClick={() => { setActiveTab('paste'); setScanError(null); }}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    activeTab === 'paste'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Paste File Listing</span>
                </button>

                <button
                  onClick={() => { setActiveTab('presets'); setScanError(null); }}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    activeTab === 'presets'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Demo Datasets</span>
                </button>
              </div>

              {/* Tab 1: Local Directory with Sub-folder & Sub-sub-folder Selection */}
              {activeTab === 'local' && (
                <div className="space-y-4">
                  {!hierarchyAnalysis ? (
                    /* Initial File Picker State */
                    <div className="space-y-4">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition bg-slate-800/20 hover:bg-slate-800/40"
                      >
                        <FolderTree className="w-10 h-10 text-indigo-400 mx-auto mb-2.5" />
                        <div className="text-sm font-bold text-white mb-1">
                          Select Admissions Folder from Your Computer
                        </div>
                        <p className="text-xs text-slate-400 max-w-md mx-auto mb-3">
                          Select any folder containing student application folders. You will be able to select/deselect specific sub-folders and sub-sub-folders before generating the report!
                        </p>
                        <span className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md">
                          <Upload className="w-4 h-4" />
                          <span>Browse Local Folder...</span>
                        </span>
                        <input
                          type="file"
                          ref={fileInputRef}
                          // @ts-expect-error webkitdirectory is standard in modern browsers
                          webkitdirectory=""
                          directory=""
                          multiple
                          className="hidden"
                          onChange={handleLocalFolderSelect}
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                        <div className="font-semibold text-white flex items-center">
                          <FolderCheck className="w-4 h-4 text-emerald-400 mr-2" />
                          Hierarchical Sub-folder Support:
                        </div>
                        <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-5">
                          <li><strong>Direct Sub-folders (Level 1)</strong>: e.g. <code className="text-slate-300">Admissions / Muhammad Abdullah</code></li>
                          <li><strong>Sub-sub-folders (Level 2)</strong>: e.g. <code className="text-slate-300">Admissions / Computer Science / Muhammad Abdullah</code></li>
                          <li><strong>Nested Document folders</strong>: Files inside <code className="text-slate-300">Student / Academic / O Level.pdf</code> are automatically grouped under that student!</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    /* Interactive Sub-Folder & Sub-Sub-Folder Selector UI */
                    <div className="space-y-4">
                      {/* Folder Summary Banner */}
                      <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white flex items-center">
                              <Folder className="w-4 h-4 text-indigo-400 mr-1.5" />
                              {hierarchyAnalysis.rootFolderName}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              {hierarchyAnalysis.totalFiles} Files Discovered
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
                            <span>Level 1 Sub-folders: <strong className="text-slate-200">{hierarchyAnalysis.levelCounts.level1Count}</strong></span>
                            <span>Level 2 Sub-sub-folders: <strong className="text-slate-200">{hierarchyAnalysis.levelCounts.level2Count}</strong></span>
                            {hierarchyAnalysis.levelCounts.level3Count > 0 && (
                              <span>Level 3+: <strong className="text-slate-200">{hierarchyAnalysis.levelCounts.level3Count}</strong></span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition shrink-0"
                        >
                          Change Folder...
                        </button>
                      </div>

                      {/* Student Folder Level Mapping Selector */}
                      <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 flex items-center">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 mr-1.5" />
                            Which folder level represents the Applicants / Students?
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Nested document files will be attached to that student
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setStudentLevelMode('auto')}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              studentLevelMode === 'auto'
                                ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>Auto-Detect</span>
                              {studentLevelMode === 'auto' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Matches applicant folders & CNICs at any depth
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setStudentLevelMode(1)}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              studentLevelMode === 1
                                ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>Level 1 Sub-folders</span>
                              {studentLevelMode === 1 && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Root / Student / [files]
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setStudentLevelMode(2)}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              studentLevelMode === 2
                                ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>Level 2 Sub-sub</span>
                              {studentLevelMode === 2 && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Root / Program / Student / [files]
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setStudentLevelMode(3)}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              studentLevelMode === 3
                                ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                                : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>Level 3 Sub-sub-sub</span>
                              {studentLevelMode === 3 && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Root / Year / Program / Student
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Sub-Folder Selection Controls */}
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Select Folders & Sub-folders to Include ({selectedFolderPaths.size}/{hierarchyAnalysis.subFolders.length})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <button
                              onClick={handleSelectAllFolders}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700"
                            >
                              Select All
                            </button>
                            <button
                              onClick={handleDeselectAllFolders}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700"
                            >
                              Deselect All
                            </button>
                            {hierarchyAnalysis.levelCounts.level1Count > 0 && (
                              <button
                                onClick={() => handleSelectOnlyDepth(1)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium border border-slate-700"
                              >
                                Only L1 Sub-folders
                              </button>
                            )}
                            {hierarchyAnalysis.levelCounts.level2Count > 0 && (
                              <button
                                onClick={() => handleSelectOnlyDepth(2)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium border border-slate-700"
                              >
                                Only L2 Sub-sub
                              </button>
                            )}
                            {hierarchyAnalysis.levelCounts.level3Count > 0 && (
                              <button
                                onClick={() => handleSelectOnlyDepth(3)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] font-medium border border-slate-700"
                              >
                                Only L3 Sub-sub-sub
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={folderSearchTerm}
                              onChange={(e) => setFolderSearchTerm(e.target.value)}
                              placeholder="Filter sub-folders by name, applicant, or program..."
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <select
                            value={depthFilter}
                            onChange={(e) => setDepthFilter(e.target.value as any)}
                            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none"
                          >
                            <option value="all">All Depths</option>
                            <option value="1">Level 1 Sub-folders</option>
                            <option value="2">Level 2 Sub-sub-folders</option>
                            {hierarchyAnalysis.levelCounts.level3Count > 0 && (
                              <option value="3">Level 3 Sub-sub-sub-folders</option>
                            )}
                            {(hierarchyAnalysis.levelCounts.level4Count || 0) > 0 && (
                              <option value="4">Level 4+ Folders</option>
                            )}
                          </select>
                        </div>

                        {/* Sub-Folders Checklist Tree */}
                        <div className="max-h-64 overflow-y-auto border border-slate-800 bg-slate-900 rounded-xl divide-y divide-slate-800/60 p-1">
                          {filteredSubFolders.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400">
                              No folders match your search filter.
                            </div>
                          ) : (
                            filteredSubFolders.map((sf) => {
                              const isChecked = selectedFolderPaths.has(sf.path);
                              return (
                                <div
                                  key={sf.path}
                                  onClick={() => handleToggleFolderPath(sf.path)}
                                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                                    isChecked
                                      ? 'bg-indigo-950/20 hover:bg-indigo-950/30'
                                      : 'hover:bg-slate-800/50 opacity-60'
                                  }`}
                                  style={{
                                    paddingLeft: `${Math.min(sf.depth * 14 + 8, 56)}px`,
                                  }}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}} // handled by parent onClick
                                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 shrink-0"
                                    />
                                    <Folder
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        sf.depth === 1
                                          ? 'text-indigo-400'
                                          : sf.depth === 2
                                          ? 'text-sky-400'
                                          : sf.depth === 3
                                          ? 'text-purple-400'
                                          : 'text-amber-400'
                                      }`}
                                    />
                                    <div className="min-w-0">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-semibold text-white truncate max-w-[280px]">
                                          {sf.name}
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 ${
                                            sf.depth === 1
                                              ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                              : sf.depth === 2
                                              ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                                              : sf.depth === 3
                                              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                          }`}
                                        >
                                          {sf.depth === 1
                                            ? 'Sub-folder L1'
                                            : sf.depth === 2
                                            ? 'Sub-sub-folder L2'
                                            : sf.depth === 3
                                            ? 'Sub-sub-sub L3'
                                            : `Level ${sf.depth}`}
                                        </span>
                                        {sf.hasStudentPattern && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                            Student Candidate
                                          </span>
                                        )}
                                      </div>

                                      {/* Belongs to label */}
                                      {sf.parentPath ? (
                                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
                                          <span className="text-slate-500 font-medium">Belongs To:</span>
                                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 font-mono text-[9px] truncate max-w-[280px] border border-slate-700/60">
                                            {sf.parentPath}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-slate-500 font-mono truncate max-w-[340px]">
                                          {sf.path}
                                        </div>
                                      )}

                                      {sf.detectedStudentName && (
                                        <div className="text-[10px] text-emerald-400/90 truncate mt-0.5">
                                          Student: <strong className="text-emerald-300">{sf.detectedStudentName}</strong>
                                          {sf.detectedCnic ? ` • CNIC: ${sf.detectedCnic}` : ''}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                      {sf.fileCount} file{sf.fileCount !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Final Generate Action */}
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                        <div className="text-xs text-slate-300">
                          {hierarchyAnalysis.subFolders.length === 0 ? (
                            <>
                              Root Folder Selected • <strong className="text-white">{hierarchyAnalysis.totalFiles}</strong> file(s)
                            </>
                          ) : (
                            <>
                              Selected: <strong className="text-white">{selectedFolderPaths.size}</strong> folder(s) • ~<strong className="text-white">{selectedFilesEstimate}</strong> files
                            </>
                          )}
                          <span className="block text-[11px] text-indigo-300 font-medium mt-0.5">
                            Reports include "Belongs To" and exact document &amp; file lists per student folder
                          </span>
                        </div>

                        <button
                          onClick={handleGenerateFromSelectedFolders}
                          disabled={selectedFolderPaths.size === 0 && !(hierarchyAnalysis.subFolders.length === 0 && hierarchyAnalysis.totalFiles > 0)}
                          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition"
                        >
                          <FolderCheck className="w-4 h-4" />
                          <span>
                            {hierarchyAnalysis.subFolders.length === 0
                              ? `Generate Report (${hierarchyAnalysis.totalFiles} files)`
                              : `Generate Report for Selected Folders (${selectedFolderPaths.size})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Google Drive Link */}
              {activeTab === 'drive' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Your Google Drive Folder Link or Folder ID
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
                        className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      The system will query Google Drive v3 API to inspect all actual student subfolders and actual files inside.
                    </p>
                  </div>

                  {/* Authentication toggle */}
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-800/30">
                    <button
                      type="button"
                      onClick={() => setShowAuthFields(!showAuthFields)}
                      className="flex items-center justify-between w-full text-xs text-slate-300 font-semibold"
                    >
                      <span className="flex items-center space-x-2">
                        <Key className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Google Drive API Key or OAuth Access Token (Optional)</span>
                      </span>
                      <span className="text-indigo-400 text-[11px]">
                        {showAuthFields ? 'Hide' : 'Configure Credentials'}
                      </span>
                    </button>

                    {showAuthFields && (
                      <div className="mt-3 space-y-3 pt-3 border-t border-slate-800">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Google Cloud API Key (for public "Anyone with link" Drive folders)
                          </label>
                          <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            OAuth Access Token (for private organization Drive folders)
                          </label>
                          <input
                            type="password"
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder="ya29.a0..."
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleStartDriveScan}
                    disabled={!driveUrl.trim()}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
                  >
                    <FolderSync className="w-4 h-4" />
                    <span>Scan Actual Google Drive Folder</span>
                  </button>
                </div>
              )}

              {/* Tab 3: Paste File Listing */}
              {activeTab === 'paste' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Paste File Paths or Drive Folder Hierarchy (One per line)
                    </label>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={8}
                      placeholder="Program/Student Name - CNIC/File1.pdf&#10;Program/Student Name - CNIC/File2.pdf"
                      className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Paste from Google Drive file listings, rclone exports, or file system trees. Format: <code className="text-indigo-300">[Sub-folder]/[Sub-sub-folder]/Filename.ext</code>
                    </p>
                  </div>

                  <button
                    onClick={handleParsePastedStructure}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Scan Pasted Student List</span>
                  </button>
                </div>
              )}

              {/* Tab 4: Demo Datasets */}
              {activeTab === 'presets' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start space-x-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Notice:</strong> These are reference mock datasets for testing the Excel report layout. To scan your real applicants, use the <strong>Select Local Folder & Sub-folders</strong> tab above.
                    </span>
                  </div>

                  <div
                    onClick={() => handleLoadPreset('Admissions 2026 (Sample Reference)')}
                    className="p-4 rounded-xl border border-slate-800 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/80 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-white">
                        Sample Dataset 1: Undergraduate Admissions
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                        Demo Reference
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Simulated 18 applicant folders with O Level, A Level, CNIC, and sample degree files.
                    </p>
                  </div>

                  <div
                    onClick={() => handleLoadPreset('Spring 2026 Postgraduate (Sample Reference)')}
                    className="p-4 rounded-xl border border-slate-800 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/80 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-white">
                        Sample Dataset 2: Postgraduate & Specialized
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        Demo Reference
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Simulated applicant folders with MPhil Clinical & Surgery, BS Mass Comm, and IELTS.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
