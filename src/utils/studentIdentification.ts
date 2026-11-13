import { ConfidenceLevel, ScannedFile, StudentFolder, StudentIdentificationStatus } from '../types/verification';

// CNIC format: 5 digits - 7 digits - 1 digit (works even when bordered by underscores or letters)
export const CNIC_REGEX = /(?<!\d)(\d{5})[-_\s]?(\d{7})[-_\s]?(\d{1})(?!\d)/;
export const UNHYPHENATED_CNIC_REGEX = /(?<!\d)\d{13}(?!\d)/;

export function formatCnic(raw: string): string {
  const match = raw.match(CNIC_REGEX);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const clean = raw.replace(/\D/g, '');
  if (clean.length === 13) {
    return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`;
  }
  return raw.trim();
}

export function maskCnic(cnic: string): string {
  if (!cnic || cnic === 'Not Found' || cnic === '—') return '—';
  const clean = formatCnic(cnic);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-*******-${parts[2]}`;
  }
  // Fallback mask
  if (clean.length >= 6) {
    return `${clean.slice(0, 5)}*******${clean.slice(-1)}`;
  }
  return clean;
}

const NON_STUDENT_FOLDER_KEYWORDS = [
  'admin',
  'archive',
  'template',
  'blank form',
  'instructions',
  'guideline',
  'backup',
  'incoming',
  'export',
];

/**
 * Identifies a student from folder name, folder metadata, and child file names.
 */
export function identifyStudentFromFolder(
  folderName: string,
  folderId: string,
  folderDriveUrl: string,
  files: ScannedFile[]
): StudentFolder {
  let studentName = '';
  let cnic = '';
  let confidence: ConfidenceLevel = 'LOW';
  let identificationStatus: StudentIdentificationStatus = 'UNIDENTIFIED';
  let reason = '';

  const cleanFolderName = folderName.trim();

  // Check if administrative / non-student folder
  const matchesAdminKeyword = NON_STUDENT_FOLDER_KEYWORDS.some(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-zA-Z])${escaped}s?(?:$|[^a-zA-Z])`, 'i').test(cleanFolderName);
  });

  // 1. Priority 1: Extract CNIC from folder name
  const folderCnicMatch = cleanFolderName.match(CNIC_REGEX);
  if (folderCnicMatch) {
    cnic = `${folderCnicMatch[1]}-${folderCnicMatch[2]}-${folderCnicMatch[3]}`;
  }

  // Extract Name from folder name
  // Format variants:
  // "Muhammad Abdullah - 33102-3014734-3"
  // "001_Muhammad_Abdullah"
  // "001 - Muhammad Abdullah"
  // "Muhammad Abdullah"
  let namePart = cleanFolderName;

  // Remove CNIC if present
  if (cnic) {
    namePart = namePart.replace(CNIC_REGEX, '');
  }

  // Remove leading numbers/prefixes like "001_", "001 - ", "01."
  namePart = namePart.replace(/^(\d+[\s\-_.]+)+/, '');

  // Remove dashes, underscores, trailing brackets
  namePart = namePart.replace(/[()[\]{}]/g, ' ').replace(/[-_]/g, ' ').trim();

  // If there's an actual name string with characters
  if (namePart.length >= 3 && /[a-zA-Z]/.test(namePart)) {
    studentName = namePart
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // 2. Priority 2: Inspect File Names inside folder if CNIC or Name missing
  if (!cnic || !studentName) {
    for (const f of files) {
      if (!cnic) {
        const fileCnic = f.fileName.match(CNIC_REGEX);
        if (fileCnic) {
          cnic = `${fileCnic[1]}-${fileCnic[2]}-${fileCnic[3]}`;
        }
      }

      // If student name missing from folder name, check if file starts with a name
      if (!studentName && /_cnic|_degree|_cert|_statement|_photo/i.test(f.fileName)) {
        const candidate = f.fileName
          .split(/_cnic|_degree|_cert|_statement|_photo/i)[0]
          .replace(/[_\-]/g, ' ')
          .trim();
        if (candidate.length >= 3 && !/^\d+$/.test(candidate)) {
          studentName = candidate
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        }
      }
    }
  }

  const isNonStudentFolder = matchesAdminKeyword && !cnic;

  // 3. Determine Status & Confidence
  if (isNonStudentFolder) {
    identificationStatus = 'UNIDENTIFIED';
    confidence = 'LOW';
    reason = 'Folder matched administrative or template folder keywords.';
  } else if (studentName && cnic) {
    identificationStatus = 'IDENTIFIED';
    confidence = 'HIGH';
  } else if (studentName && !cnic) {
    identificationStatus = 'PARTIALLY IDENTIFIED';
    confidence = 'MEDIUM';
    reason = 'Student name detected, but CNIC could not be located in folder name or files.';
  } else if (!studentName && cnic) {
    identificationStatus = 'AMBIGUOUS';
    confidence = 'MEDIUM';
    reason = 'CNIC detected, but no clear student name could be resolved.';
  } else {
    identificationStatus = 'UNIDENTIFIED';
    confidence = 'LOW';
    reason = 'Neither student name nor CNIC could be resolved from folder structure.';
  }

  const unidentifiedFiles = files.filter(
    f => f.category === 'Unknown' || f.confidence === 'LOW'
  );

  return {
    id: folderId || `folder_${Math.random().toString(36).slice(2, 9)}`,
    folderName,
    folderId,
    driveUrl: folderDriveUrl,
    studentName: studentName || 'Unknown Student',
    cnic: cnic || '',
    identificationStatus,
    confidence,
    files,
    unidentifiedFiles,
    reason,
  };
}
