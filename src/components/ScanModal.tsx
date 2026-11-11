import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import {
  ScanProgress,
  extractDriveFolderId,
  scanRealGoogleDrive,
  scanLocalDirectory,
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
  const [activeTab, setActiveTab] = useState<'drive' | 'local' | 'paste' | 'presets'>('drive');
  const [driveUrl, setDriveUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showAuthFields, setShowAuthFields] = useState(false);

  const [pastedText, setPastedText] = useState(
    `Admissions 2026/Muhammad Abdullah - 33102-3014734-3/CNIC.pdf
Admissions 2026/Muhammad Abdullah - 33102-3014734-3/O Level Certificate.pdf
Admissions 2026/Muhammad Abdullah - 33102-3014734-3/A Level Certificate.pdf
Admissions 2026/Muhammad Abdullah - 33102-3014734-3/Personal Statement.pdf
Admissions 2026/Muhammad Abdullah - 33102-3014734-3/applicant_photo.jpg
Admissions 2026/Huzaifa Bilal - 33102-6411602-7/CNIC Front.jpg
Admissions 2026/Huzaifa Bilal - 33102-6411602-7/CNIC Back.jpg
Admissions 2026/Huzaifa Bilal - 33102-6411602-7/HSSC Certificate.pdf
Admissions 2026/Huzaifa Bilal - 33102-6411602-7/SSC Matric Result.pdf
Admissions 2026/Huzaifa Bilal - 33102-6411602-7/English Proficiency Letter.pdf
Admissions 2026/Natasha Gulam - 33102-5819201-2/CNIC.pdf
Admissions 2026/Natasha Gulam - 33102-5819201-2/Pic.jpg
Admissions 2026/Natasha Gulam - 33102-5819201-2/BTEC Extended Diploma.pdf`
  );

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState<{
    title: string;
    details: string;
    code?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

      // Section 5 error message as requested in prompt:
      setScanError({
        title: 'Google Drive Access Failed',
        details: err?.message || 'Access denied or folder not found.',
      });
    }
  };

  // Local Directory Scan Handler
  const handleLocalFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    setProgress({
      scannedFolders: 0,
      totalFolders: 10,
      studentFolders: 0,
      filesScanned: 0,
      categoriesFound: 0,
      currentFolder: 'Reading actual local student files...',
      progressPercent: 5,
      statusText: 'Analyzing actual folders from selected directory...',
    });

    try {
      const session = await scanLocalDirectory(files, (p) => setProgress(p));
      setTimeout(() => {
        setIsScanning(false);
        onScanComplete(session);
        onClose();
      }, 400);
    } catch (err: any) {
      console.error(err);
      setIsScanning(false);
      setScanError({
        title: 'Local Folder Scan Failed',
        details: err?.message || 'Could not read local folder structure.',
      });
    }
  };

  // Pasted Text / Structure Import Handler
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Scan Actual Student Folders</h2>
              <p className="text-xs text-slate-400">
                Extract actual applicant folders, classify documents, and build the Excel matrix
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
          {/* Section 5 Error Display if Google Drive Access Failed */}
          {scanError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-rose-200 text-sm">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>✗ {scanError.title}</span>
              </div>
              <div className="text-[11px] text-rose-200/90 pl-6 leading-relaxed">
                {scanError.details}
              </div>
              <div className="pt-2 pl-6 border-t border-rose-500/20 text-[11px] text-slate-300 space-y-1">
                <div className="font-semibold text-white">Please make sure:</div>
                <div>1. The folder is shared with "Anyone with the link can view", OR you have provided an API Key/Access Token.</div>
                <div>2. The Google Drive folder link or ID is valid.</div>
                <div>3. Or use <strong>"Select Local Folder"</strong> tab below to scan your downloaded files directly without any API key!</div>
              </div>
            </div>
          )}

          {isScanning ? (
            /* Progress view */
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-indigo-400 flex items-center">
                  <FolderSync className="w-4 h-4 mr-1.5 animate-spin" />
                  Scanning actual folders...
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
                  onClick={() => { setActiveTab('local'); setScanError(null); }}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    activeTab === 'local'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Select Local Drive Folder</span>
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

              {/* Tab 1: Google Drive Link */}
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

              {/* Tab 2: Local Directory Upload */}
              {activeTab === 'local' && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition bg-slate-800/20 hover:bg-slate-800/40"
                  >
                    <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <div className="text-xs font-bold text-white mb-1">
                      Pick Your Downloaded or Synced Google Drive Folder
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Select your local folder containing student folders. Scans your actual files directly in the browser with 0 API keys and 0 authentication needed!
                    </p>
                    <span className="mt-3 inline-block px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md">
                      Browse Local Folder...
                    </span>
                    {/* Hidden folder input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      // @ts-expect-error webkitdirectory is standard in Chromium/modern browsers
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={handleLocalFolderSelect}
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start space-x-2.5 text-[11px] text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Reads your <strong>exact actual file names</strong>, sizes, and student folders. No mock data will ever be substituted.
                    </span>
                  </div>
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
                      placeholder="Student Name - CNIC/File1.pdf&#10;Student Name - CNIC/File2.pdf"
                      className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Paste from Google Drive file listings, rclone exports, or file system trees. Format: <code className="text-indigo-300">Student Folder/Filename.ext</code>
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
                      <strong>Notice:</strong> These are reference mock datasets for testing the Excel report layout. To scan your real applicants, use the <strong>Google Drive Link</strong> or <strong>Select Local Folder</strong> tabs above.
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
