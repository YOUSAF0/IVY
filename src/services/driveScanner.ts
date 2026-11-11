import { ScanSession, StudentFolder, ScannedFile } from '../types/verification';
import { CORE_CATEGORIES, classifyDocumentFile } from '../utils/classification';
import { identifyStudentFromFolder } from '../utils/studentIdentification';

export interface ScanProgress {
  scannedFolders: number;
  totalFolders: number;
  studentFolders: number;
  filesScanned: number;
  categoriesFound: number;
  currentFolder: string;
  progressPercent: number;
  statusText: string;
}

export interface DriveAuthOptions {
  apiKey?: string;
  accessToken?: string;
}

export function extractDriveFolderId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  // Standard Drive folder link: https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Also support drive.google.com/open?id=XXXXX or drive.google.com/file/d/XXXXX
  const idMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/) || trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  // If provided bare ID (usually 25-60 alphanumeric chars)
  if (/^[a-zA-Z0-9_-]{15,70}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

interface GoogleDriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * Real Google Drive v3 API query helper
 */
async function fetchDriveChildren(
  parentFolderId: string,
  auth: DriveAuthOptions
): Promise<GoogleDriveItem[]> {
  const headers: Record<string, string> = {};
  if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken.trim()}`;
  }

  const query = `'${parentFolderId}' in parents and trashed = false`;
  const fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)';
  let allFiles: GoogleDriveItem[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', query);
    url.searchParams.set('fields', fields);
    url.searchParams.set('pageSize', '100');
    if (auth.apiKey) {
      url.searchParams.set('key', auth.apiKey.trim());
    }
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const errorMsg = errorJson?.error?.message || `Google Drive API returned status ${res.status}`;
      const errorStatus = res.status;
      throw new Error(`[${errorStatus}] ${errorMsg}`);
    }

    const data = await res.json();
    if (data.files && Array.isArray(data.files)) {
      allFiles = allFiles.concat(data.files);
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return allFiles;
}

/**
 * Fetches folder metadata (name) from Google Drive
 */
async function fetchFolderMetadata(
  folderId: string,
  auth: DriveAuthOptions
): Promise<{ name: string; webViewLink?: string }> {
  const headers: Record<string, string> = {};
  if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken.trim()}`;
  }

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${folderId}`);
  url.searchParams.set('fields', 'id,name,mimeType,webViewLink');
  if (auth.apiKey) {
    url.searchParams.set('key', auth.apiKey.trim());
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    return { name: `Drive Folder (${folderId.slice(0, 8)}...)` };
  }

  const data = await res.json();
  return {
    name: data.name || 'Admissions Drive Folder',
    webViewLink: data.webViewLink,
  };
}

/**
 * Scans a REAL Google Drive folder via the official Google Drive v3 API.
 * Recursively queries applicant folders and files.
 */
export async function scanRealGoogleDrive(
  folderId: string,
  auth: DriveAuthOptions,
  onProgress?: (p: ScanProgress) => void
): Promise<ScanSession> {
  if (onProgress) {
    onProgress({
      scannedFolders: 0,
      totalFolders: 1,
      studentFolders: 0,
      filesScanned: 0,
      categoriesFound: CORE_CATEGORIES.length,
      currentFolder: 'Connecting to Google Drive API...',
      progressPercent: 5,
      statusText: 'Querying root folder metadata and listing subfolders...',
    });
  }

  // 1. Fetch root folder metadata
  const rootMeta = await fetchFolderMetadata(folderId, auth);

  // 2. Fetch all direct children inside the root folder
  const rootItems = await fetchDriveChildren(folderId, auth);

  // Separate subfolders (applicant folders) and standalone files
  const subfolders = rootItems.filter(
    item => item.mimeType === 'application/vnd.google-apps.folder'
  );
  const rootFiles = rootItems.filter(
    item => item.mimeType !== 'application/vnd.google-apps.folder'
  );

  const discoveredCategories = new Set<string>(CORE_CATEGORIES);
  const students: StudentFolder[] = [];
  const unidentifiedFolders: StudentFolder[] = [];
  let totalFilesScanned = 0;
  const totalSubfolders = subfolders.length + (rootFiles.length > 0 ? 1 : 0);

  // 3. For each applicant subfolder, query files inside it
  for (let i = 0; i < subfolders.length; i++) {
    const subfolder = subfolders[i];

    if (onProgress) {
      onProgress({
        scannedFolders: i + 1,
        totalFolders: totalSubfolders,
        studentFolders: students.length,
        filesScanned: totalFilesScanned,
        categoriesFound: discoveredCategories.size,
        currentFolder: subfolder.name,
        progressPercent: Math.round(((i + 1) / totalSubfolders) * 90),
        statusText: `Scanning student folder [${i + 1}/${subfolders.length}]: ${subfolder.name}`,
      });
    }

    // Query files inside this subfolder
    const childDriveFiles = await fetchDriveChildren(subfolder.id, auth);

    const scannedFiles: ScannedFile[] = childDriveFiles.map((df, fIdx) => {
      totalFilesScanned++;
      const ext = df.name.split('.').pop() || '';
      const classification = classifyDocumentFile(df.name, df.mimeType);

      if (classification.category !== 'Unknown' && classification.confidence !== 'LOW') {
        discoveredCategories.add(classification.category);
      }

      return {
        id: `df_${subfolder.id}_${fIdx}`,
        fileName: df.name,
        fileExtension: ext,
        mimeType: df.mimeType || 'application/octet-stream',
        fileSize: parseInt(df.size || '0', 10),
        driveFileId: df.id,
        driveUrl: df.webViewLink || `https://drive.google.com/file/d/${df.id}/view`,
        category: classification.category,
        confidence: classification.confidence,
        detectionMethod: classification.detectionMethod,
        modifiedTime: df.modifiedTime || new Date().toISOString(),
        possibleCategories: classification.possibleCategories,
        reason: classification.reason,
      };
    });

    const student = identifyStudentFromFolder(
      subfolder.name,
      subfolder.id,
      subfolder.webViewLink || `https://drive.google.com/drive/folders/${subfolder.id}`,
      scannedFiles
    );

    if (student.identificationStatus === 'UNIDENTIFIED') {
      unidentifiedFolders.push(student);
    } else {
      students.push(student);
    }
  }

  // If there are files placed directly in root, group them into a folder
  if (rootFiles.length > 0) {
    const scannedRootFiles: ScannedFile[] = rootFiles.map((rf, rIdx) => {
      totalFilesScanned++;
      const ext = rf.name.split('.').pop() || '';
      const classification = classifyDocumentFile(rf.name, rf.mimeType);
      return {
        id: `root_f_${rIdx}`,
        fileName: rf.name,
        fileExtension: ext,
        mimeType: rf.mimeType,
        fileSize: parseInt(rf.size || '0', 10),
        driveFileId: rf.id,
        driveUrl: rf.webViewLink || `https://drive.google.com/file/d/${rf.id}/view`,
        category: classification.category,
        confidence: classification.confidence,
        detectionMethod: classification.detectionMethod,
        modifiedTime: rf.modifiedTime || new Date().toISOString(),
      };
    });

    const rootStudent = identifyStudentFromFolder(
      'Uncategorized Root Documents',
      folderId,
      `https://drive.google.com/drive/folders/${folderId}`,
      scannedRootFiles
    );
    unidentifiedFolders.push(rootStudent);
  }

  const dynamicCategories = Array.from(discoveredCategories).filter(
    c => !CORE_CATEGORIES.includes(c)
  ).sort();

  if (onProgress) {
    onProgress({
      scannedFolders: totalSubfolders,
      totalFolders: totalSubfolders,
      studentFolders: students.length,
      filesScanned: totalFilesScanned,
      categoriesFound: discoveredCategories.size,
      currentFolder: 'Complete',
      progressPercent: 100,
      statusText: `Scan complete: ${students.length} student folders, ${totalFilesScanned} files.`,
    });
  }

  return {
    id: `scan_drive_${Date.now()}`,
    folderName: rootMeta.name,
    folderId,
    driveUrl: `https://drive.google.com/drive/folders/${folderId}`,
    scanDate: new Date().toISOString(),
    status: 'completed',
    sourceType: 'google_drive_link',
    students,
    unidentifiedFolders,
    categories: [...CORE_CATEGORIES, ...dynamicCategories],
    totalFilesCount: totalFilesScanned,
  };
}

/**
 * Scans a local directory uploaded by user through <input type="file" webkitdirectory />
 * Parses the REAL local directory structure on the user's computer.
 */
export async function scanLocalDirectory(
  fileList: FileList,
  onProgress?: (p: ScanProgress) => void
): Promise<ScanSession> {
  const folderMap = new Map<string, File[]>();
  let rootFolderName = 'Admissions Local Folder';

  // Group files by applicant folder
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rawPath = file.webkitRelativePath || file.name;
    const pathParts = rawPath.split('/').filter(Boolean);

    if (pathParts.length >= 3) {
      // Structure: RootFolder / StudentFolder / file.pdf
      rootFolderName = pathParts[0];
      const studentFolder = pathParts[1];
      if (!folderMap.has(studentFolder)) {
        folderMap.set(studentFolder, []);
      }
      folderMap.get(studentFolder)!.push(file);
    } else if (pathParts.length === 2) {
      // Structure: StudentFolder / file.pdf
      const studentFolder = pathParts[0];
      if (!folderMap.has(studentFolder)) {
        folderMap.set(studentFolder, []);
      }
      folderMap.get(studentFolder)!.push(file);
    } else {
      // Root level file
      if (!folderMap.has('Root Unsorted')) {
        folderMap.set('Root Unsorted', []);
      }
      folderMap.get('Root Unsorted')!.push(file);
    }
  }

  const folderEntries = Array.from(folderMap.entries());
  const totalFolders = folderEntries.length;
  let filesScanned = 0;
  let scannedFolders = 0;
  const discoveredCategories = new Set<string>(CORE_CATEGORIES);

  const students: StudentFolder[] = [];
  const unidentifiedFolders: StudentFolder[] = [];

  for (let i = 0; i < totalFolders; i++) {
    const [subFolderName, files] = folderEntries[i];
    scannedFolders++;

    const scannedFiles: ScannedFile[] = files.map((file, fIdx) => {
      filesScanned++;
      const ext = file.name.split('.').pop() || '';
      const classification = classifyDocumentFile(file.name, file.type);

      if (classification.category !== 'Unknown' && classification.confidence !== 'LOW') {
        discoveredCategories.add(classification.category);
      }

      return {
        id: `local_f_${i}_${fIdx}`,
        fileName: file.name,
        fileExtension: ext,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        driveFileId: `local_${i}_${fIdx}`,
        driveUrl: '#',
        category: classification.category,
        confidence: classification.confidence,
        detectionMethod: classification.detectionMethod,
        modifiedTime: new Date(file.lastModified).toISOString(),
        possibleCategories: classification.possibleCategories,
        reason: classification.reason,
      };
    });

    const student = identifyStudentFromFolder(
      subFolderName,
      `local_folder_${i}`,
      '#',
      scannedFiles
    );

    if (student.identificationStatus === 'UNIDENTIFIED') {
      unidentifiedFolders.push(student);
    } else {
      students.push(student);
    }

    if (onProgress) {
      onProgress({
        scannedFolders,
        totalFolders,
        studentFolders: students.length,
        filesScanned,
        categoriesFound: discoveredCategories.size,
        currentFolder: subFolderName,
        progressPercent: Math.round((scannedFolders / totalFolders) * 100),
        statusText: `Processing actual student folder: ${subFolderName}`,
      });
      // Small pause for smooth UI progress
      await new Promise(r => setTimeout(r, 20));
    }
  }

  const dynamicCategories = Array.from(discoveredCategories).filter(
    c => !CORE_CATEGORIES.includes(c)
  ).sort();

  return {
    id: `scan_local_${Date.now()}`,
    folderName: rootFolderName,
    folderId: 'local_dir',
    driveUrl: 'Local Drive Folder',
    scanDate: new Date().toISOString(),
    status: 'completed',
    sourceType: 'local_folder',
    students,
    unidentifiedFolders,
    categories: [...CORE_CATEGORIES, ...dynamicCategories],
    totalFilesCount: filesScanned,
  };
}

/**
 * Parses raw text or file paths pasted by user
 * e.g. Lines like:
 * "Muhammad Abdullah - 33102-3014734-3/CNIC.pdf"
 * "Muhammad Abdullah - 33102-3014734-3/O Level.pdf"
 * "Huzaifa Bilal/Personal Statement.pdf"
 */
export function parsePastedFolderTree(
  rawText: string,
  rootName: string = 'Imported Admissions Folder'
): ScanSession {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const folderMap = new Map<string, string[]>();

  for (const line of lines) {
    // Check if line contains path separator / or \
    const normalized = line.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);

    if (parts.length >= 2) {
      const folder = parts[0] === rootName && parts.length >= 3 ? parts[1] : parts[0];
      const filename = parts[parts.length - 1];
      if (!folderMap.has(folder)) {
        folderMap.set(folder, []);
      }
      folderMap.get(folder)!.push(filename);
    } else {
      // Just folder name or root file
      if (line.includes('.')) {
        if (!folderMap.has('General')) folderMap.set('General', []);
        folderMap.get('General')!.push(line);
      } else {
        if (!folderMap.has(line)) folderMap.set(line, []);
      }
    }
  }

  const folderEntries = Array.from(folderMap.entries());
  let filesScanned = 0;
  const discoveredCategories = new Set<string>(CORE_CATEGORIES);
  const students: StudentFolder[] = [];
  const unidentifiedFolders: StudentFolder[] = [];

  folderEntries.forEach(([folderName, files], idx) => {
    const scannedFiles: ScannedFile[] = files.map((fileName, fIdx) => {
      filesScanned++;
      const ext = fileName.split('.').pop() || '';
      const classification = classifyDocumentFile(fileName);

      if (classification.category !== 'Unknown' && classification.confidence !== 'LOW') {
        discoveredCategories.add(classification.category);
      }

      return {
        id: `paste_f_${idx}_${fIdx}`,
        fileName,
        fileExtension: ext,
        mimeType: 'application/pdf',
        fileSize: 500000,
        driveFileId: `file_${idx}_${fIdx}`,
        driveUrl: '#',
        category: classification.category,
        confidence: classification.confidence,
        detectionMethod: classification.detectionMethod,
        modifiedTime: new Date().toISOString(),
        possibleCategories: classification.possibleCategories,
        reason: classification.reason,
      };
    });

    const student = identifyStudentFromFolder(
      folderName,
      `imported_folder_${idx}`,
      '#',
      scannedFiles
    );

    if (student.identificationStatus === 'UNIDENTIFIED') {
      unidentifiedFolders.push(student);
    } else {
      students.push(student);
    }
  });

  const dynamicCategories = Array.from(discoveredCategories).filter(
    c => !CORE_CATEGORIES.includes(c)
  ).sort();

  return {
    id: `scan_import_${Date.now()}`,
    folderName: rootName,
    folderId: 'imported_structure',
    driveUrl: 'Imported Structure',
    scanDate: new Date().toISOString(),
    status: 'completed',
    sourceType: 'local_folder',
    students,
    unidentifiedFolders,
    categories: [...CORE_CATEGORIES, ...dynamicCategories],
    totalFilesCount: filesScanned,
  };
}
