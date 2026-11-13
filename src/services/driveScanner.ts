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

const DOCUMENT_SUBFOLDER_PATTERN = /^(academic|documents?|docs?|certificates?|certs?|photos?|pictures?|pics?|ids?|identity|scans?|files?|uploads?|attachments?|results?|marksheets?|transcripts?|cnic|passport|o\s*level|a\s*level|hssc|ssc|matric|inter|btec|consent|personal\s*statement|eng\s*proficiency|equivalence|domicile|supporting|misc|other|front|back|degree|undergraduate|postgraduate)$/i;

function isJunkSystemFile(fileName: string): boolean {
  return /^(\.ds_store|thumbs\.db|desktop\.ini|~\$.*|\._.*)$/i.test(fileName.trim());
}

/**
 * Recursively collects all non-folder files under a Google Drive folder (up to maxDepth)
 */
async function collectDriveFilesRecursively(
  folderId: string,
  auth: DriveAuthOptions,
  prefixPath: string = '',
  depth: number = 0,
  maxDepth: number = 4
): Promise<{ item: GoogleDriveItem; subPath: string }[]> {
  if (depth > maxDepth) return [];
  const children = await fetchDriveChildren(folderId, auth);
  const results: { item: GoogleDriveItem; subPath: string }[] = [];

  for (const child of children) {
    if (child.mimeType === 'application/vnd.google-apps.folder') {
      const nextPrefix = prefixPath ? `${prefixPath}/${child.name}` : child.name;
      const nested = await collectDriveFilesRecursively(child.id, auth, nextPrefix, depth + 1, maxDepth);
      results.push(...nested);
    } else if (!isJunkSystemFile(child.name)) {
      results.push({ item: child, subPath: prefixPath });
    }
  }
  return results;
}

/**
 * Scans a REAL Google Drive folder via the official Google Drive v3 API.
 * Recursively traverses department/batch/student folders and all nested document files.
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

  // 2. Discover candidate student folders across up to 3 levels (Root / Program / Year / Student)
  const rootItems = await fetchDriveChildren(folderId, auth);
  const rootSubfolders = rootItems.filter(
    item => item.mimeType === 'application/vnd.google-apps.folder'
  );
  const rootFiles = rootItems.filter(
    item => item.mimeType !== 'application/vnd.google-apps.folder' && !isJunkSystemFile(item.name)
  );

  interface DriveStudentCandidate {
    folder: GoogleDriveItem;
    parentPath: string;
    fullPath: string;
    directFiles: GoogleDriveItem[];
  }

  const candidates: DriveStudentCandidate[] = [];

  const discoverCandidates = async (
    folder: GoogleDriveItem,
    parentTrail: string[],
    depth: number
  ): Promise<void> => {
    const children = await fetchDriveChildren(folder.id, auth);
    const childFolders = children.filter(c => c.mimeType === 'application/vnd.google-apps.folder');
    const childFiles = children.filter(
      c => c.mimeType !== 'application/vnd.google-apps.folder' && !isJunkSystemFile(c.name)
    );

    const hasCnicInName = /(?<!\d)\d{5}[-_\s]?\d{7}[-_\s]?\d{1}(?!\d)/.test(folder.name);
    const allChildFoldersAreDocSubfolders =
      childFolders.length > 0 &&
      childFolders.every(cf => DOCUMENT_SUBFOLDER_PATTERN.test(cf.name.trim()));

    // Treat this folder as a student folder if:
    // - It has CNIC in its name, OR
    // - It directly contains files (and isn't just a wrapper of sub-programs), OR
    // - Its subfolders are document-type folders (like O Level/, CNIC/), OR
    // - We're at depth 3 or no child folders exist
    if (
      hasCnicInName ||
      childFolders.length === 0 ||
      allChildFoldersAreDocSubfolders ||
      (childFiles.length >= 2 && depth >= 1) ||
      depth >= 3
    ) {
      candidates.push({
        folder,
        parentPath: parentTrail.join(' / '),
        fullPath: [rootMeta.name, ...parentTrail, folder.name].join('/'),
        directFiles: childFiles,
      });
    } else {
      // Recurse into child folders (Program / Year / Batch)
      for (const cf of childFolders) {
        await discoverCandidates(cf, [...parentTrail, folder.name], depth + 1);
      }
      // If there were loose files in the program folder, preserve them
      if (childFiles.length > 0) {
        candidates.push({
          folder: { ...folder, name: `${folder.name} (Loose Files)` },
          parentPath: parentTrail.join(' / '),
          fullPath: [rootMeta.name, ...parentTrail, folder.name].join('/'),
          directFiles: childFiles,
        });
      }
    }
  };

  for (const sf of rootSubfolders) {
    await discoverCandidates(sf, [], 1);
  }

  const discoveredCategories = new Set<string>(CORE_CATEGORIES);
  const students: StudentFolder[] = [];
  const unidentifiedFolders: StudentFolder[] = [];
  let totalFilesScanned = 0;
  const totalSubfolders = candidates.length + (rootFiles.length > 0 ? 1 : 0);

  // 3. For each discovered student folder, collect ALL files (including nested subfolders inside student)
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subfolder = candidate.folder;

    if (onProgress) {
      onProgress({
        scannedFolders: i + 1,
        totalFolders: Math.max(totalSubfolders, 1),
        studentFolders: students.length,
        filesScanned: totalFilesScanned,
        categoriesFound: discoveredCategories.size,
        currentFolder: subfolder.name,
        progressPercent: Math.round(((i + 1) / Math.max(totalSubfolders, 1)) * 90),
        statusText: `Scanning student folder [${i + 1}/${candidates.length}]: ${subfolder.name}`,
      });
    }

    const nestedFiles = await collectDriveFilesRecursively(subfolder.id, auth, '', 0, 3);

    const scannedFiles: ScannedFile[] = nestedFiles.map(({ item: df, subPath }, fIdx) => {
      totalFilesScanned++;
      const ext = df.name.split('.').pop() || '';
      const classification = classifyDocumentFile(df.name, df.mimeType, [], subPath);

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
        reason: subPath
          ? `${classification.reason || 'Found in subfolder'}: [${subPath}]`
          : classification.reason,
      };
    });

    const student = identifyStudentFromFolder(
      subfolder.name,
      subfolder.id,
      subfolder.webViewLink || `https://drive.google.com/drive/folders/${subfolder.id}`,
      scannedFiles
    );

    student.folderPath = candidate.fullPath;
    student.parentFolder = candidate.parentPath || rootMeta.name;
    student.belongsTo = candidate.parentPath || rootMeta.name;

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
      if (classification.category !== 'Unknown' && classification.confidence !== 'LOW') {
        discoveredCategories.add(classification.category);
      }
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
    rootStudent.belongsTo = rootMeta.name;
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

export interface FolderHierarchyItem {
  path: string;
  name: string;
  depth: number; // 1 = subfolder, 2 = sub-subfolder, 3 = sub-sub-subfolder
  parentPath: string;
  fileCount: number;
  recursiveFileCount: number;
  hasStudentPattern: boolean;
  detectedStudentName?: string;
  detectedCnic?: string;
}

export interface HierarchyAnalysis {
  rootFolderName: string;
  totalFiles: number;
  subFolders: FolderHierarchyItem[];
  suggestedLevel: 'auto' | 1 | 2 | 3 | 4;
  levelCounts: {
    level1Count: number;
    level2Count: number;
    level3Count: number;
    level4Count: number;
  };
}

/**
 * Analyzes local directory hierarchy to discover sub-folders and sub-sub-folders
 */
export function analyzeLocalDirectoryHierarchy(fileList: FileList): HierarchyAnalysis {
  let rootFolderName = 'Admissions Local Folder';
  const folderStats = new Map<
    string,
    {
      name: string;
      depth: number;
      parentPath: string;
      directFiles: number;
      allFiles: number;
      files: File[];
    }
  >();

  let validFileCount = 0;
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (isJunkSystemFile(file.name)) continue;
    validFileCount++;

    const rawPath = file.webkitRelativePath || file.name;
    const parts = rawPath.split('/').filter(Boolean);

    if (parts.length > 0) {
      rootFolderName = parts[0];
    }

    // Traverse all ancestor directory paths
    // e.g. Admissions / Computer Science / Muhammad Abdullah / O Level.pdf
    let currentPath = '';
    for (let p = 0; p < parts.length - 1; p++) {
      const partName = parts[p];
      const parent = currentPath;
      currentPath = currentPath ? `${currentPath}/${partName}` : partName;

      if (!folderStats.has(currentPath)) {
        folderStats.set(currentPath, {
          name: partName,
          depth: p, // 0 = root, 1 = subfolder, 2 = sub-subfolder
          parentPath: parent,
          directFiles: 0,
          allFiles: 0,
          files: [],
        });
      }

      const stat = folderStats.get(currentPath)!;
      stat.allFiles++;
      // If this is the immediate folder containing the file
      if (p === parts.length - 2) {
        stat.directFiles++;
        stat.files.push(file);
      }
    }
  }

  // Filter out the root itself from subfolders list
  const subFolders: FolderHierarchyItem[] = [];
  let studentCandidatesLevel1 = 0;
  let studentCandidatesLevel2 = 0;
  let studentCandidatesLevel3 = 0;
  let level1Count = 0;
  let level2Count = 0;
  let level3Count = 0;
  let level4Count = 0;

  for (const [path, stat] of folderStats.entries()) {
    if (stat.depth === 0) continue; // skip root folder itself

    if (stat.depth === 1) level1Count++;
    if (stat.depth === 2) level2Count++;
    if (stat.depth === 3) level3Count++;
    if (stat.depth >= 4) level4Count++;

    // Check if folder name looks like a student (has CNIC or student name, not a doc subfolder/program)
    const cnicMatch = stat.name.match(/(?<!\d)\d{5}[-_\s]?\d{7}[-_\s]?\d{1}(?!\d)/);
    const isDocSubfolder = DOCUMENT_SUBFOLDER_PATTERN.test(stat.name.trim());
    const hasStudentName =
      !isDocSubfolder &&
      /[a-zA-Z]{3,}/.test(stat.name) &&
      !/^(archive|template|guidelines|draft|admin|forms|202\d|fall|spring|batch|semester|bscs|bba|mphil|mbbs|engineering|medical|undergraduate|postgraduate)/i.test(stat.name);
    const hasStudentPattern = !!cnicMatch || hasStudentName;

    if (hasStudentPattern) {
      if (stat.depth === 1) studentCandidatesLevel1++;
      if (stat.depth === 2) studentCandidatesLevel2++;
      if (stat.depth === 3) studentCandidatesLevel3++;
    }

    subFolders.push({
      path,
      name: stat.name,
      depth: stat.depth,
      parentPath: stat.parentPath,
      fileCount: stat.directFiles,
      recursiveFileCount: stat.allFiles,
      hasStudentPattern,
      detectedCnic: cnicMatch ? cnicMatch[0] : undefined,
      detectedStudentName: stat.name.replace(/(?<!\d)\d{5}[-_\s]?\d{7}[-_\s]?\d{1}(?!\d)/g, '').replace(/[-_]/g, ' ').trim(),
    });
  }

  // Sort subfolders by path
  subFolders.sort((a, b) => a.path.localeCompare(b.path));

  // Determine suggested level
  let suggestedLevel: 'auto' | 1 | 2 | 3 | 4 = 'auto';
  if (studentCandidatesLevel3 > studentCandidatesLevel2 && studentCandidatesLevel3 > studentCandidatesLevel1 && level3Count > 0) {
    suggestedLevel = 3;
  } else if (studentCandidatesLevel2 > studentCandidatesLevel1 && level2Count > 0) {
    suggestedLevel = 2;
  } else if (studentCandidatesLevel1 > 0) {
    suggestedLevel = 1;
  }

  return {
    rootFolderName,
    totalFiles: validFileCount,
    subFolders,
    suggestedLevel,
    levelCounts: {
      level1Count,
      level2Count,
      level3Count,
      level4Count,
    },
  };
}

export interface ScanLocalOptions {
  selectedPaths?: Set<string>; // If provided, only include files under these paths
  studentLevelMode?: 'auto' | 1 | 2 | 3 | 4;
}

/**
 * Scans a local directory with full support for selecting folders, sub-folders, and sub-sub-folders
 */
export async function scanLocalDirectoryAdvanced(
  fileList: FileList,
  options: ScanLocalOptions = {},
  onProgress?: (p: ScanProgress) => void
): Promise<ScanSession> {
  const { selectedPaths, studentLevelMode = 'auto' } = options;

  let rootFolderName = 'Admissions Local Folder';
  const studentFolderMap = new Map<
    string,
    {
      folderName: string;
      folderPath: string;
      parentFolder?: string;
      files: { file: File; subPathInsideStudent: string }[];
    }
  >();

  const allSelectedPathsArray = selectedPaths && selectedPaths.size > 0
    ? Array.from(selectedPaths)
    : null;

  // Process all files
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (isJunkSystemFile(file.name)) continue;

    const rawPath = file.webkitRelativePath || file.name;
    const parts = rawPath.split('/').filter(Boolean);

    if (parts.length > 0) {
      rootFolderName = parts[0];
    }

    // Check if file is inside one of the selected sub-folders, sub-sub-folders, or sub-sub-sub-folders
    if (allSelectedPathsArray) {
      const fileDirPath = parts.slice(0, -1).join('/');
      const isSelected = allSelectedPathsArray.some(
        sel => fileDirPath === sel || fileDirPath.startsWith(`${sel}/`)
      );
      if (!isSelected) {
        continue;
      }
    }

    // Determine the student folder based on studentLevelMode
    let studentFolderName = 'General Applicant';
    let studentFolderPath = '';
    let parentFolder = '';
    let subPathInsideStudent = '';
    let matchedIndex = -1;

    if (parts.length <= 2) {
      // Structure: Root / file.pdf OR Student / file.pdf
      studentFolderName = parts.length === 2 ? parts[0] : 'Root Documents';
      studentFolderPath = parts.length === 2 ? parts[0] : rootFolderName;
    } else if (studentLevelMode === 1) {
      // Level 1 Sub-folder: Root / StudentFolder / [sub-files.pdf]
      studentFolderName = parts[1];
      studentFolderPath = `${parts[0]}/${parts[1]}`;
      parentFolder = rootFolderName;
      subPathInsideStudent = parts.slice(2, -1).join('/');
    } else if (studentLevelMode === 2) {
      // Level 2 Sub-sub-folder: Root / Program or Dept / StudentFolder / [file.pdf]
      if (parts.length >= 4) {
        parentFolder = parts[1];
        studentFolderName = parts[2];
        studentFolderPath = `${parts[0]}/${parts[1]}/${parts[2]}`;
        subPathInsideStudent = parts.slice(3, -1).join('/');
      } else {
        studentFolderName = parts[1];
        studentFolderPath = `${parts[0]}/${parts[1]}`;
        parentFolder = rootFolderName;
      }
    } else if (studentLevelMode === 3) {
      // Level 3 Sub-sub-sub-folder: Root / Year / Program / StudentFolder / [file.pdf]
      if (parts.length >= 5) {
        parentFolder = `${parts[1]} / ${parts[2]}`;
        studentFolderName = parts[3];
        studentFolderPath = `${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}`;
        subPathInsideStudent = parts.slice(4, -1).join('/');
      } else if (parts.length >= 4) {
        parentFolder = parts[1];
        studentFolderName = parts[2];
        studentFolderPath = `${parts[0]}/${parts[1]}/${parts[2]}`;
      } else {
        studentFolderName = parts[1];
        studentFolderPath = `${parts[0]}/${parts[1]}`;
        parentFolder = rootFolderName;
      }
    } else if (studentLevelMode === 4) {
      // Level 4 Sub-sub-sub-sub-folder: Root / Year / Campus / Program / StudentFolder / [file.pdf]
      if (parts.length >= 6) {
        parentFolder = `${parts[1]} / ${parts[2]} / ${parts[3]}`;
        studentFolderName = parts[4];
        studentFolderPath = `${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}/${parts[4]}`;
        subPathInsideStudent = parts.slice(5, -1).join('/');
      } else if (parts.length >= 5) {
        parentFolder = `${parts[1]} / ${parts[2]}`;
        studentFolderName = parts[3];
        studentFolderPath = `${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}`;
      } else if (parts.length >= 4) {
        parentFolder = parts[1];
        studentFolderName = parts[2];
        studentFolderPath = `${parts[0]}/${parts[1]}/${parts[2]}`;
      } else {
        studentFolderName = parts[1];
        studentFolderPath = `${parts[0]}/${parts[1]}`;
        parentFolder = rootFolderName;
      }
    } else {
      // AUTO DETECT: Check parts for CNIC or student patterns from deepest subfolder down
      // 1. Check if any part contains CNIC
      for (let p = parts.length - 2; p >= 1; p--) {
        if (/(?<!\d)\d{5}[-_\s]?\d{7}[-_\s]?\d{1}(?!\d)/.test(parts[p])) {
          matchedIndex = p;
          break;
        }
      }

      // 2. Check for student-like folder name at depth 3 or 2 (skipping document subfolders)
      if (matchedIndex === -1 && parts.length >= 5) {
        const p3 = parts[3].trim();
        if (!DOCUMENT_SUBFOLDER_PATTERN.test(p3)) {
          matchedIndex = 3;
        }
      }

      if (matchedIndex === -1 && parts.length >= 4) {
        const p2 = parts[2].trim();
        if (!DOCUMENT_SUBFOLDER_PATTERN.test(p2)) {
          matchedIndex = 2;
        }
      }

      // 3. Fallback: if parts.length >= 3, use parts[1] (Level 1)
      if (matchedIndex === -1) {
        matchedIndex = parts.length >= 3 ? 1 : 0;
      }

      studentFolderName = parts[matchedIndex];
      studentFolderPath = parts.slice(0, matchedIndex + 1).join('/');
      if (matchedIndex > 1) {
        parentFolder = parts.slice(1, matchedIndex).join(' / ');
      }
      subPathInsideStudent = parts.slice(matchedIndex + 1, -1).join('/');
    }

    if (!studentFolderMap.has(studentFolderPath)) {
      studentFolderMap.set(studentFolderPath, {
        folderName: studentFolderName,
        folderPath: studentFolderPath,
        parentFolder: parentFolder || (parts.length > 2 && matchedIndex === 1 ? rootFolderName : ''),
        files: [],
      });
    }

    studentFolderMap.get(studentFolderPath)!.files.push({
      file,
      subPathInsideStudent,
    });
  }

  const folderEntries = Array.from(studentFolderMap.entries());
  const totalFolders = folderEntries.length;
  let filesScanned = 0;
  let scannedFolders = 0;
  const discoveredCategories = new Set<string>(CORE_CATEGORIES);

  const students: StudentFolder[] = [];
  const unidentifiedFolders: StudentFolder[] = [];

  for (let i = 0; i < totalFolders; i++) {
    const [, entry] = folderEntries[i];
    scannedFolders++;

    const scannedFiles: ScannedFile[] = entry.files.map(({ file, subPathInsideStudent }, fIdx) => {
      filesScanned++;
      const ext = file.name.split('.').pop() || '';
      const classification = classifyDocumentFile(file.name, file.type, [], subPathInsideStudent);

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
        reason: subPathInsideStudent
          ? `${classification.reason || 'Found in subfolder'}: [${subPathInsideStudent}]`
          : classification.reason,
      };
    });

    const student = identifyStudentFromFolder(
      entry.folderName,
      `local_folder_${i}`,
      '#',
      scannedFiles
    );

    student.folderPath = entry.folderPath;
    student.parentFolder = entry.parentFolder;
    student.belongsTo = entry.parentFolder || rootFolderName;

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
        currentFolder: entry.folderName,
        progressPercent: Math.round((scannedFolders / Math.max(totalFolders, 1)) * 100),
        statusText: `Processing student folder: ${entry.folderName}${entry.parentFolder ? ` (${entry.parentFolder})` : ''}`,
      });
      // Small tick
      await new Promise(r => setTimeout(r, 15));
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
 * Standard scanLocalDirectory backwards compatible wrapper
 */
export async function scanLocalDirectory(
  fileList: FileList,
  onProgress?: (p: ScanProgress) => void
): Promise<ScanSession> {
  return scanLocalDirectoryAdvanced(fileList, { studentLevelMode: 'auto' }, onProgress);
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
      let folder = parts[0];
      let parentPath = '';
      if (parts.length >= 4) {
        // e.g. Year / Dept / Student / file.pdf
        folder = parts[parts.length - 2];
        parentPath = parts.slice(0, parts.length - 2).join(' / ');
      } else if (parts.length === 3) {
        // e.g. Dept / Student / file.pdf
        folder = parts[1];
        parentPath = parts[0];
      }
      const filename = parts[parts.length - 1];
      const mapKey = parentPath ? `${parentPath} > ${folder}` : folder;
      if (!folderMap.has(mapKey)) {
        folderMap.set(mapKey, []);
      }
      folderMap.get(mapKey)!.push(filename);
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

  folderEntries.forEach(([key, files], idx) => {
    const keyParts = key.split(' > ');
    const folderName = keyParts[keyParts.length - 1];
    const parentFolder = keyParts.length > 1 ? keyParts.slice(0, -1).join(' / ') : '';

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

    student.folderPath = key;
    student.parentFolder = parentFolder;
    student.belongsTo = parentFolder || rootName;

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
