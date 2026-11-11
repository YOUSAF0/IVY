import * as XLSX from 'xlsx';
import { ScanSession, StudentFolder } from '../types/verification';
import { maskCnic } from './studentIdentification';

export interface ExcelExportOptions {
  maskCnicValues?: boolean;
  activeCategories?: string[];
}

export function generateVerificationExcel(
  session: ScanSession,
  options: ExcelExportOptions = {}
): Blob {
  const wb = XLSX.utils.book_new();
  const mask = options.maskCnicValues ?? false;

  // Combine identified and valid students for verification report
  const validStudents = session.students.filter(
    s => s.identificationStatus !== 'UNIDENTIFIED'
  );

  const categories = options.activeCategories && options.activeCategories.length > 0
    ? options.activeCategories
    : session.categories;

  // --------------------------------------------------------------------------
  // SHEET 1: Verification Report (Student x Document Matrix)
  // --------------------------------------------------------------------------
  const matrixHeaders = ['Sr no', 'Student Name', 'CNIC', ...categories];

  const matrixRows = validStudents.map((student, idx) => {
    const row: Record<string, string | number | boolean> = {
      'Sr no': idx + 1,
      'Student Name': student.studentName,
      CNIC: mask ? maskCnic(student.cnic) : student.cnic || '',
    };

    // For every category, check if student has at least 1 document matching
    for (const cat of categories) {
      const hasDoc = student.files.some(
        f => f.category.toLowerCase() === cat.toLowerCase()
      );
      // Per prompt instructions: Use TRUE for available, blank for unavailable
      row[cat] = hasDoc ? 'TRUE' : '';
    }

    return row;
  });

  const wsMatrix = XLSX.utils.json_to_sheet(matrixRows, {
    header: matrixHeaders,
  });

  // Calculate column widths
  const colWidths = [
    { wch: 8 },  // Sr no
    { wch: 28 }, // Student Name
    { wch: 20 }, // CNIC
    ...categories.map(cat => ({ wch: Math.max(cat.length + 3, 14) })),
  ];
  wsMatrix['!cols'] = colWidths;

  // Freeze top row and first 3 columns (Sr no, Student Name, CNIC)
  wsMatrix['!views'] = [{
    state: 'frozen',
    xSplit: 3,
    ySplit: 1,
    topLeftCell: 'D2',
    activeCell: 'A1',
  }];

  // AutoFilter across all headers
  if (matrixRows.length > 0) {
    const lastColIndex = matrixHeaders.length - 1;
    const lastColLetter = XLSX.utils.encode_col(lastColIndex);
    wsMatrix['!autofilter'] = {
      ref: `A1:${lastColLetter}${matrixRows.length + 1}`,
    };
  }

  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Verification Report');

  // --------------------------------------------------------------------------
  // SHEET 2: Summary (Availability Statistics)
  // --------------------------------------------------------------------------
  const totalFolders = session.students.length + session.unidentifiedFolders.length;
  const identifiedCount = session.students.filter(s => s.identificationStatus === 'IDENTIFIED').length;
  const partiallyCount = session.students.filter(s => s.identificationStatus === 'PARTIALLY IDENTIFIED').length;
  const ambiguousCount = session.students.filter(s => s.identificationStatus === 'AMBIGUOUS').length;
  const unidentifiedCount = session.unidentifiedFolders.length + session.students.filter(s => s.identificationStatus === 'UNIDENTIFIED').length;

  const summaryData: (string | number)[][] = [
    ['STUDENT DOCUMENT VERIFICATION SYSTEM - SCAN SUMMARY'],
    ['Generated On', new Date().toLocaleString()],
    ['Target Folder', session.folderName],
    ['Drive URL / Source', session.driveUrl],
    [],
    ['METRIC', 'COUNT', 'PERCENTAGE OF TOTAL'],
    ['Total Student Folders Scanned', totalFolders, '100%'],
    ['Fully Identified Students', identifiedCount, `${totalFolders ? ((identifiedCount / totalFolders) * 100).toFixed(1) : 0}%`],
    ['Partially Identified Students', partiallyCount, `${totalFolders ? ((partiallyCount / totalFolders) * 100).toFixed(1) : 0}%`],
    ['Ambiguous Student Folders', ambiguousCount, `${totalFolders ? ((ambiguousCount / totalFolders) * 100).toFixed(1) : 0}%`],
    ['Unidentified Folders', unidentifiedCount, `${totalFolders ? ((unidentifiedCount / totalFolders) * 100).toFixed(1) : 0}%`],
    ['Total Documents Discovered', session.totalFilesCount, '—'],
    [],
    ['DOCUMENT CATEGORY AVAILABILITY STATISTICS'],
    ['Category Name', 'Student Count With Document', 'Availability Rate (%)'],
  ];

  for (const cat of categories) {
    const studentsWithDoc = validStudents.filter(s =>
      s.files.some(f => f.category.toLowerCase() === cat.toLowerCase())
    ).length;
    const rate = validStudents.length > 0
      ? ((studentsWithDoc / validStudents.length) * 100).toFixed(1) + '%'
      : '0%';
    summaryData.push([cat, studentsWithDoc, rate]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 28 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --------------------------------------------------------------------------
  // SHEET 3: Document Details (Traceability of every file)
  // --------------------------------------------------------------------------
  const docDetailsHeaders = [
    'Student Name',
    'CNIC',
    'Document Category',
    'File Name',
    'Google Drive File ID',
    'Google Drive URL',
    'MIME Type',
    'File Extension',
    'Detection Method',
    'Confidence',
  ];

  const docDetailsRows: Record<string, string | number>[] = [];

  for (const student of session.students) {
    for (const f of student.files) {
      docDetailsRows.push({
        'Student Name': student.studentName,
        CNIC: mask ? maskCnic(student.cnic) : student.cnic || '—',
        'Document Category': f.category,
        'File Name': f.fileName,
        'Google Drive File ID': f.driveFileId,
        'Google Drive URL': f.driveUrl,
        'MIME Type': f.mimeType,
        'File Extension': f.fileExtension,
        'Detection Method': f.detectionMethod,
        Confidence: f.confidence,
      });
    }
  }

  const wsDocDetails = XLSX.utils.json_to_sheet(docDetailsRows, {
    header: docDetailsHeaders,
  });
  wsDocDetails['!cols'] = [
    { wch: 26 },
    { wch: 20 },
    { wch: 24 },
    { wch: 32 },
    { wch: 24 },
    { wch: 36 },
    { wch: 20 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
  ];
  if (docDetailsRows.length > 0) {
    wsDocDetails['!autofilter'] = {
      ref: `A1:J${docDetailsRows.length + 1}`,
    };
  }
  XLSX.utils.book_append_sheet(wb, wsDocDetails, 'Document Details');

  // --------------------------------------------------------------------------
  // SHEET 4: Unidentified Files (Low-confidence or ambiguous files)
  // --------------------------------------------------------------------------
  const unidentifiedFilesHeaders = [
    'Student Name',
    'CNIC',
    'File Name',
    'File Type',
    'Google Drive URL',
    'Possible Category',
    'Confidence',
    'Reason',
  ];

  const unidentifiedFilesRows: Record<string, string | number>[] = [];

  for (const student of session.students) {
    for (const uf of student.unidentifiedFiles) {
      unidentifiedFilesRows.push({
        'Student Name': student.studentName,
        CNIC: mask ? maskCnic(student.cnic) : student.cnic || '—',
        'File Name': uf.fileName,
        'File Type': uf.mimeType || uf.fileExtension,
        'Google Drive URL': uf.driveUrl,
        'Possible Category': uf.possibleCategories?.join(', ') || 'Unknown',
        Confidence: uf.confidence,
        Reason: uf.reason || 'Manual review required',
      });
    }
  }

  const wsUnidentifiedFiles = XLSX.utils.json_to_sheet(unidentifiedFilesRows, {
    header: unidentifiedFilesHeaders,
  });
  wsUnidentifiedFiles['!cols'] = [
    { wch: 26 },
    { wch: 20 },
    { wch: 32 },
    { wch: 20 },
    { wch: 36 },
    { wch: 24 },
    { wch: 14 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsUnidentifiedFiles, 'Unidentified Files');

  // --------------------------------------------------------------------------
  // SHEET 5: Unidentified Folders
  // --------------------------------------------------------------------------
  const unidentifiedFoldersHeaders = [
    'Folder Name',
    'Folder ID',
    'Drive URL',
    'Possible Student Name',
    'Possible CNIC',
    'Identification Status',
    'Reason',
  ];

  const allUnidentifiedFolders = [
    ...session.unidentifiedFolders,
    ...session.students.filter(s => s.identificationStatus === 'UNIDENTIFIED'),
  ];

  const unidentifiedFoldersRows = allUnidentifiedFolders.map(uf => ({
    'Folder Name': uf.folderName,
    'Folder ID': uf.folderId,
    'Drive URL': uf.driveUrl,
    'Possible Student Name': uf.studentName !== 'Unknown Student' ? uf.studentName : '—',
    'Possible CNIC': uf.cnic || '—',
    'Identification Status': uf.identificationStatus,
    Reason: uf.reason || 'Could not resolve student credentials from folder name or contents',
  }));

  const wsUnidentifiedFolders = XLSX.utils.json_to_sheet(unidentifiedFoldersRows, {
    header: unidentifiedFoldersHeaders,
  });
  wsUnidentifiedFolders['!cols'] = [
    { wch: 30 },
    { wch: 24 },
    { wch: 36 },
    { wch: 24 },
    { wch: 20 },
    { wch: 22 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsUnidentifiedFolders, 'Unidentified Folders');

  // Generate buffer
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function exportMatrixToCsv(session: ScanSession, categories: string[], mask: boolean): Blob {
  const headers = ['Sr no', 'Student Name', 'CNIC', ...categories];
  const validStudents = session.students.filter(s => s.identificationStatus !== 'UNIDENTIFIED');

  const rows = validStudents.map((s, idx) => {
    const cnicVal = mask ? maskCnic(s.cnic) : s.cnic || '';
    const docVals = categories.map(cat => {
      const has = s.files.some(f => f.category.toLowerCase() === cat.toLowerCase());
      return has ? 'TRUE' : '';
    });
    return [idx + 1, `"${s.studentName.replace(/"/g, '""')}"`, `"${cnicVal}"`, ...docVals].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}
