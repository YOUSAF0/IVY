export type StudentIdentificationStatus =
  | 'IDENTIFIED'
  | 'PARTIALLY IDENTIFIED'
  | 'AMBIGUOUS'
  | 'UNIDENTIFIED';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type DetectionMethod =
  | 'Filename Pattern'
  | 'Filename + MIME'
  | 'AI/Image Classification'
  | 'AI/OCR Classification'
  | 'Admin Manual Review';

export interface ScannedFile {
  id: string;
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
  driveFileId: string;
  driveUrl: string;
  category: string;
  confidence: ConfidenceLevel;
  detectionMethod: DetectionMethod;
  modifiedTime: string;
  possibleCategories?: string[];
  reason?: string;
  thumbnailUrl?: string;
  isAmbiguous?: boolean;
}

export interface StudentFolder {
  id: string;
  folderName: string;
  folderId: string;
  driveUrl: string;
  studentName: string;
  cnic: string;
  identificationStatus: StudentIdentificationStatus;
  confidence: ConfidenceLevel;
  files: ScannedFile[];
  unidentifiedFiles: ScannedFile[];
  reason?: string;
}

export interface DocumentCategory {
  name: string;
  isCore: boolean;
  aliases: string[];
  description?: string;
}

export interface ScanSession {
  id: string;
  folderName: string;
  folderId: string;
  driveUrl: string;
  scanDate: string;
  status: 'scanning' | 'completed' | 'failed';
  sourceType: 'google_drive_link' | 'local_folder' | 'sample_dataset';
  students: StudentFolder[];
  unidentifiedFolders: StudentFolder[];
  categories: string[];
  totalFilesCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}
