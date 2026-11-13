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

  const baseCategories = options.activeCategories && options.activeCategories.length > 0
    ? options.activeCategories
    : session.categories;

  // Ensure ANY classified document category actually found in student folders is included in matrix columns
  const catSet = new Set(baseCategories);
  for (const s of validStudents) {
    for (const f of s.files) {
      if (f.category && f.category !== 'Unknown' && !Array.from(catSet).some(c => c.toLowerCase() === f.category.toLowerCase())) {
        catSet.add(f.category);
      }
    }
  }
  const categories = Array.from(catSet);

  // --------------------------------------------------------------------------
  // SHEET 1: Verification Report (Student x Document Matrix + Exact Folder Document List)
  // --------------------------------------------------------------------------
  const matrixHeaders = [
    'Sr no',
    'Student Name',
    'CNIC',
    'Belongs To (Department / Program)',
    'Total Files in Folder',
    'Exact Document List (Categories)',
    'Exact File Names in Folder',
    ...categories,
  ];

  const matrixRows = validStudents.map((student, idx) => {
    const exactCategoriesList = Array.from(
      new Set(
        student.files
          .map(f => f.category)
          .filter(c => c && c !== 'Unknown')
      )
    );
    const exactFileNamesList = student.files.map(f => f.fileName);

    const row: Record<string, string | number | boolean> = {
      'Sr no': idx + 1,
      'Student Name': student.studentName,
      CNIC: mask ? maskCnic(student.cnic) : student.cnic || '',
      'Belongs To (Department / Program)': student.belongsTo || student.parentFolder || session.folderName,
      'Total Files in Folder': student.files.length,
      'Exact Document List (Categories)': exactCategoriesList.length > 0 ? exactCategoriesList.join(', ') : 'No Classified Documents',
      'Exact File Names in Folder': exactFileNamesList.length > 0 ? exactFileNamesList.join(', ') : 'Empty Folder',
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
    { wch: 32 }, // Belongs To (Department / Program)
    { wch: 18 }, // Total Files in Folder
    { wch: 44 }, // Exact Document List (Categories)
    { wch: 52 }, // Exact File Names in Folder
    ...categories.map(cat => ({ wch: Math.max(cat.length + 3, 14) })),
  ];
  wsMatrix['!cols'] = colWidths;

  // Freeze top row and first 4 columns (Sr no, Student Name, CNIC, Belongs To)
  wsMatrix['!views'] = [{
    state: 'frozen',
    xSplit: 4,
    ySplit: 1,
    topLeftCell: 'E2',
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

  // Group students by belongsTo
  const belongsToMap = new Map<string, number>();
  for (const s of validStudents) {
    const key = s.belongsTo || s.parentFolder || session.folderName;
    belongsToMap.set(key, (belongsToMap.get(key) || 0) + 1);
  }

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
    ['STUDENTS BY PROGRAM / SUB-FOLDER (WHERE THEY BELONG)'],
    ['Program / Sub-folder', 'Enrolled Applicants', 'Share of Total (%)'],
  ];

  for (const [prog, count] of belongsToMap.entries()) {
    summaryData.push([
      prog,
      count,
      validStudents.length ? `${((count / validStudents.length) * 100).toFixed(1)}%` : '0%',
    ]);
  }

  summaryData.push([]);
  summaryData.push(['DOCUMENT CATEGORY AVAILABILITY STATISTICS']);
  summaryData.push(['Category Name', 'Student Count With Document', 'Availability Rate (%)']);

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
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 28 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --------------------------------------------------------------------------
  // SHEET 3: Document Details (Traceability of every file)
  // --------------------------------------------------------------------------
  const docDetailsHeaders = [
    'Student Name',
    'CNIC',
    'Belongs To (Program / Department)',
    'Sub-folder / Path',
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
        'Belongs To (Program / Department)': student.belongsTo || student.parentFolder || session.folderName,
        'Sub-folder / Path': student.folderPath || student.folderName,
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
    { wch: 26 }, // Student Name
    { wch: 20 }, // CNIC
    { wch: 30 }, // Belongs To
    { wch: 34 }, // Sub-folder / Path
    { wch: 26 }, // Document Category
    { wch: 34 }, // File Name
    { wch: 24 }, // Drive File ID
    { wch: 36 }, // Drive URL
    { wch: 22 }, // MIME Type
    { wch: 14 }, // File Extension
    { wch: 22 }, // Detection Method
    { wch: 14 }, // Confidence
  ];
  if (docDetailsRows.length > 0) {
    wsDocDetails['!autofilter'] = {
      ref: `A1:L${docDetailsRows.length + 1}`,
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
    'Files in Folder',
    'Exact File Names in Folder',
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
    'Files in Folder': uf.files.length,
    'Exact File Names in Folder': uf.files.length > 0 ? uf.files.map(f => f.fileName).join(', ') : 'Empty Folder',
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
    { wch: 16 },
    { wch: 46 },
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

export function exportMatrixToCsv(session: ScanSession, baseCategories: string[], mask: boolean): Blob {
  const validStudents = session.students.filter(s => s.identificationStatus !== 'UNIDENTIFIED');
  const catSet = new Set(baseCategories);
  for (const s of validStudents) {
    for (const f of s.files) {
      if (f.category && f.category !== 'Unknown' && !Array.from(catSet).some(c => c.toLowerCase() === f.category.toLowerCase())) {
        catSet.add(f.category);
      }
    }
  }
  const categories = Array.from(catSet);

  const headers = [
    'Sr no',
    'Student Name',
    'CNIC',
    'Belongs To (Department / Program)',
    'Total Files in Folder',
    'Exact Document List (Categories)',
    'Exact File Names in Folder',
    ...categories,
  ];

  const rows = validStudents.map((s, idx) => {
    const cnicVal = mask ? maskCnic(s.cnic) : s.cnic || '';
    const belongsToVal = s.belongsTo || s.parentFolder || session.folderName;
    const exactCategoriesList = Array.from(
      new Set(s.files.map(f => f.category).filter(c => c && c !== 'Unknown'))
    ).join(', ');
    const exactFileNamesList = s.files.map(f => f.fileName).join(', ');
    const docVals = categories.map(cat => {
      const has = s.files.some(f => f.category.toLowerCase() === cat.toLowerCase());
      return has ? 'TRUE' : '';
    });
    return [
      idx + 1,
      `"${s.studentName.replace(/"/g, '""')}"`,
      `"${cnicVal}"`,
      `"${belongsToVal.replace(/"/g, '""')}"`,
      s.files.length,
      `"${exactCategoriesList.replace(/"/g, '""')}"`,
      `"${exactFileNamesList.replace(/"/g, '""')}"`,
      ...docVals,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}
