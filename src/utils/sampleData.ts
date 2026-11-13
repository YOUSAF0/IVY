import { ScanSession, StudentFolder, ScannedFile } from '../types/verification';
import { CORE_CATEGORIES, classifyDocumentFile } from './classification';
import { identifyStudentFromFolder } from './studentIdentification';

interface RawFolderInput {
  folderName: string;
  folderId: string;
  files: {
    name: string;
    mimeType?: string;
    size?: number;
  }[];
}

const SAMPLE_RAW_FOLDERS: RawFolderInput[] = [
  {
    folderName: 'Muhammad Abdullah - 33102-3014734-3',
    folderId: 'f_abdullah_01',
    files: [
      { name: 'O_Level_Certificate.pdf', mimeType: 'application/pdf', size: 1420000 },
      { name: 'A_Level_Certificate.pdf', mimeType: 'application/pdf', size: 1380000 },
      { name: 'CNIC.pdf', mimeType: 'application/pdf', size: 850000 },
      { name: 'applicant_photo.jpg', mimeType: 'image/jpeg', size: 450000 },
      { name: 'Personal_Statement.pdf', mimeType: 'application/pdf', size: 620000 },
      { name: 'Consent_Form.pdf', mimeType: 'application/pdf', size: 310000 },
    ],
  },
  {
    folderName: 'Muhammad Huzaifa Bilal - 33102-6411602-7',
    folderId: 'f_huzaifa_02',
    files: [
      { name: 'Personal Statement.pdf', mimeType: 'application/pdf', size: 540000 },
      { name: 'CNIC Front.jpg', mimeType: 'image/jpeg', size: 780000 },
      { name: 'CNIC Back.jpg', mimeType: 'image/jpeg', size: 790000 },
      { name: 'Picture.jpg', mimeType: 'image/jpeg', size: 380000 },
      { name: 'HSSC_Certificate.pdf', mimeType: 'application/pdf', size: 1200000 },
      { name: 'SSC_Certificate.pdf', mimeType: 'application/pdf', size: 1100000 },
      { name: 'English_Proficiency_Letter.pdf', mimeType: 'application/pdf', size: 410000 },
    ],
  },
  {
    folderName: '003_Natasha_Gulam_Murtaza',
    folderId: 'f_natasha_03',
    files: [
      { name: 'Natasha_33102-5819201-2_CNIC.pdf', mimeType: 'application/pdf', size: 910000 },
      { name: 'Passport_Photo.jpg', mimeType: 'image/jpeg', size: 420000 },
      { name: 'SSC_Matric_Result.pdf', mimeType: 'application/pdf', size: 1340000 },
      { name: 'BTEC_Extended_Diploma.pdf', mimeType: 'application/pdf', size: 1680000 },
      { name: 'Passport_Scan.pdf', mimeType: 'application/pdf', size: 1250000 },
    ],
  },
  {
    folderName: 'Ali Raza - 35201-1829103-1',
    folderId: 'f_ali_04',
    files: [
      { name: 'O-Level Result.pdf', mimeType: 'application/pdf', size: 1390000 },
      { name: 'A-Level Result.pdf', mimeType: 'application/pdf', size: 1450000 },
      { name: 'Identity_Card_Copy.pdf', mimeType: 'application/pdf', size: 690000 },
      { name: 'IMG_4821.jpg', mimeType: 'image/jpeg', size: 520000 },
      { name: 'BS Computer Science Degree.pdf', mimeType: 'application/pdf', size: 1890000 },
      { name: 'English Proficiency.pdf', mimeType: 'application/pdf', size: 390000 },
      { name: 'Personal_Statement.pdf', mimeType: 'application/pdf', size: 480000 },
    ],
  },
  {
    folderName: 'Zainab Fatima (37405-9182371-4)',
    folderId: 'f_zainab_05',
    files: [
      { name: 'CNIC.pdf', mimeType: 'application/pdf', size: 810000 },
      { name: 'Pic.jpg', mimeType: 'image/jpeg', size: 310000 },
      { name: 'Intermediate FSc Pre-Medical.pdf', mimeType: 'application/pdf', size: 1540000 },
      { name: 'Matric Certificate.pdf', mimeType: 'application/pdf', size: 1290000 },
      { name: 'Personal Statement SOP.pdf', mimeType: 'application/pdf', size: 630000 },
      { name: 'Consent_Form_Signed.pdf', mimeType: 'application/pdf', size: 440000 },
    ],
  },
  {
    folderName: 'Hira Tariq - 35202-6655443-1',
    folderId: 'f_hira_06',
    files: [
      { name: 'CNIC_Smart_Card.pdf', mimeType: 'application/pdf', size: 950000 },
      { name: 'Applicant_Photo.jpg', mimeType: 'image/jpeg', size: 390000 },
      { name: 'BA Hon Degree Certificate.pdf', mimeType: 'application/pdf', size: 1720000 },
      { name: 'Degree Completion Certificate.pdf', mimeType: 'application/pdf', size: 1450000 },
      { name: 'English_Proficiency_Letter.pdf', mimeType: 'application/pdf', size: 420000 },
      { name: 'Passport Copy.pdf', mimeType: 'application/pdf', size: 1120000 },
    ],
  },
  {
    folderName: 'Dr. Daniyal Khan - 17301-4433221-9',
    folderId: 'f_daniyal_07',
    files: [
      { name: 'CNIC.pdf', mimeType: 'application/pdf', size: 870000 },
      { name: 'photo_white_bg.jpg', mimeType: 'image/jpeg', size: 410000 },
      { name: 'MPhil Clinical & Surgery Degree.pdf', mimeType: 'application/pdf', size: 2100000 },
      { name: 'Degree Completion Certificate.pdf', mimeType: 'application/pdf', size: 1350000 },
      { name: 'Personal_Statement.pdf', mimeType: 'application/pdf', size: 700000 },
      { name: 'Work Experience Letter.pdf', mimeType: 'application/pdf', size: 820000 }, // Discovered dynamic category!
    ],
  },
  {
    folderName: 'Mariam Siddiqui - 42101-1122334-7',
    folderId: 'f_mariam_08',
    files: [
      { name: 'National_ID_Card.jpg', mimeType: 'image/jpeg', size: 720000 },
      { name: 'Picture.jpg', mimeType: 'image/jpeg', size: 340000 },
      { name: 'BS Mass Communication Degree.pdf', mimeType: 'application/pdf', size: 1840000 },
      { name: 'Personal Statement.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 240000 },
      { name: 'Consent Form.pdf', mimeType: 'application/pdf', size: 310000 },
    ],
  },
  {
    folderName: 'Saad Ur Rehman - 36302-8877665-2',
    folderId: 'f_saad_09',
    files: [
      { name: 'CNIC.pdf', mimeType: 'application/pdf', size: 820000 },
      { name: 'Headshot.jpg', mimeType: 'image/jpeg', size: 430000 },
      { name: 'HND Business Diploma.pdf', mimeType: 'application/pdf', size: 1650000 },
      { name: 'English Proficiency Letter.pdf', mimeType: 'application/pdf', size: 390000 },
      { name: 'document_final_2.pdf', mimeType: 'application/pdf', size: 680000 }, // Ambiguous file!
    ],
  },
  {
    folderName: 'Farhan Akhtar - 33102-5544332-8',
    folderId: 'f_farhan_10',
    files: [
      { name: 'CNIC_Scan.pdf', mimeType: 'application/pdf', size: 890000 },
      { name: 'Profile_Photo.jpg', mimeType: 'image/jpeg', size: 360000 },
      { name: 'BA Business Management.pdf', mimeType: 'application/pdf', size: 1780000 },
      { name: 'Degree Completion Certificate.pdf', mimeType: 'application/pdf', size: 1280000 },
      { name: 'Consent_Form.pdf', mimeType: 'application/pdf', size: 290000 },
    ],
  },
  {
    folderName: 'Khadija Imran - 37405-2233445-6',
    folderId: 'f_khadija_11',
    files: [
      { name: 'CNIC.pdf', mimeType: 'application/pdf', size: 800000 },
      { name: 'Passport.pdf', mimeType: 'application/pdf', size: 1410000 },
      { name: 'Pic.jpg', mimeType: 'image/jpeg', size: 320000 },
      { name: 'O Level Certificate.pdf', mimeType: 'application/pdf', size: 1350000 },
      { name: 'A Level Certificate.pdf', mimeType: 'application/pdf', size: 1420000 },
      { name: 'IELTS Certificate.pdf', mimeType: 'application/pdf', size: 950000 }, // Discovered category!
    ],
  },
  {
    folderName: 'Fatima Zahra', // Missing CNIC in folder name
    folderId: 'f_fatima_12',
    files: [
      { name: 'Personal_Statement.pdf', mimeType: 'application/pdf', size: 590000 },
      { name: 'Applicant_Photo.jpg', mimeType: 'image/jpeg', size: 380000 },
      { name: 'Matric_Result.pdf', mimeType: 'application/pdf', size: 1190000 },
      { name: 'Intermediate_FA.pdf', mimeType: 'application/pdf', size: 1320000 },
      { name: 'scan_unlabeled_09.pdf', mimeType: 'application/pdf', size: 770000 }, // Ambiguous
    ],
  },
  {
    folderName: 'Bilal Ahmed - 38403-1928374-5',
    folderId: 'f_bilal_13',
    files: [
      { name: 'CNIC.pdf', mimeType: 'application/pdf', size: 880000 },
      { name: 'pic.jpg', mimeType: 'image/jpeg', size: 350000 },
      { name: 'O Level.pdf', mimeType: 'application/pdf', size: 1290000 },
      { name: 'A Level.pdf', mimeType: 'application/pdf', size: 1390000 },
      { name: 'BTEC Certificate.pdf', mimeType: 'application/pdf', size: 1610000 },
      { name: 'Personal Statement.pdf', mimeType: 'application/pdf', size: 610000 },
      { name: 'Consent Form.pdf', mimeType: 'application/pdf', size: 330000 },
    ],
  },
  {
    folderName: 'Ayesha Noor - 61101-7281920-6',
    folderId: 'f_ayesha_14',
    files: [
      { name: 'CNIC Front & Back.pdf', mimeType: 'application/pdf', size: 940000 },
      { name: 'Pic.jpg', mimeType: 'image/jpeg', size: 390000 },
      { name: 'HSSC Inter.pdf', mimeType: 'application/pdf', size: 1280000 },
      { name: 'SSC Matric.pdf', mimeType: 'application/pdf', size: 1150000 },
      { name: 'English Proficiency Certificate.pdf', mimeType: 'application/pdf', size: 430000 },
      { name: 'Passport.pdf', mimeType: 'application/pdf', size: 1310000 },
      { name: 'Recommendation Letter.pdf', mimeType: 'application/pdf', size: 520000 }, // Discovered category!
    ],
  },
  {
    folderName: 'Omer Farooq - 35201-9900112-4',
    folderId: 'f_omer_15',
    files: [
      { name: 'CNIC.pdf', mimeType: 'application/pdf', size: 830000 },
      { name: 'Picture.jpg', mimeType: 'image/jpeg', size: 370000 },
      { name: 'BS Computer Science Degree.pdf', mimeType: 'application/pdf', size: 1950000 },
      { name: 'Degree Completion Certificate.pdf', mimeType: 'application/pdf', size: 1290000 },
      { name: 'Work Experience Letter.pdf', mimeType: 'application/pdf', size: 790000 },
      { name: 'IELTS Certificate.pdf', mimeType: 'application/pdf', size: 890000 },
    ],
  },
  // Ambiguous folder (has CNIC inside, but folder name is generic)
  {
    folderName: 'Scan_Batch_04',
    folderId: 'f_scan_16',
    files: [
      { name: 'Taimur_Khan_33102-1199887-2_CNIC.pdf', mimeType: 'application/pdf', size: 880000 },
      { name: 'photo.jpg', mimeType: 'image/jpeg', size: 360000 },
      { name: 'Personal_Statement.pdf', mimeType: 'application/pdf', size: 580000 },
    ],
  },
  // Unidentified non-student folder 1
  {
    folderName: 'Archive_Admissions_Templates_2026',
    folderId: 'f_arch_17',
    files: [
      { name: 'Admissions_Guidelines_2026.pdf', mimeType: 'application/pdf', size: 2100000 },
      { name: 'Blank_Consent_Form_Template.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 450000 },
    ],
  },
  // Unidentified non-student folder 2
  {
    folderName: 'New Folder (3)',
    folderId: 'f_new_18',
    files: [
      { name: 'notes.txt', mimeType: 'text/plain', size: 1200 },
      { name: 'receipt_payment.jpg', mimeType: 'image/jpeg', size: 490000 },
    ],
  },
];

export function buildSampleSession(
  folderName: string = 'Admissions 2026',
  folderId: string = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs'
): ScanSession {
  const driveUrl = `https://drive.google.com/drive/folders/${folderId}`;
  const students: StudentFolder[] = [];
  const unidentifiedFolders: StudentFolder[] = [];
  const discoveredCategoriesSet = new Set<string>(CORE_CATEGORIES);
  let totalFiles = 0;

  for (const raw of SAMPLE_RAW_FOLDERS) {
    const childFiles: ScannedFile[] = raw.files.map((rf, fIdx) => {
      totalFiles++;
      const ext = rf.name.split('.').pop() || '';
      const classification = classifyDocumentFile(rf.name, rf.mimeType);

      if (classification.category !== 'Unknown' && classification.confidence !== 'LOW') {
        discoveredCategoriesSet.add(classification.category);
      }

      return {
        id: `file_${raw.folderId}_${fIdx}`,
        fileName: rf.name,
        fileExtension: ext,
        mimeType: rf.mimeType || 'application/octet-stream',
        fileSize: rf.size || 500000,
        driveFileId: `drive_f_${raw.folderId}_${fIdx}`,
        driveUrl: `https://drive.google.com/file/d/drive_f_${raw.folderId}_${fIdx}/view`,
        category: classification.category,
        confidence: classification.confidence,
        detectionMethod: classification.detectionMethod,
        modifiedTime: new Date(Date.now() - (fIdx + 1) * 3600000 * 24).toISOString(),
        possibleCategories: classification.possibleCategories,
        reason: classification.reason,
      };
    });

    const student = identifyStudentFromFolder(
      raw.folderName,
      raw.folderId,
      `https://drive.google.com/drive/folders/${raw.folderId}`,
      childFiles
    );

    const programCategory = raw.files.some(f => /computer|cs/i.test(f.name))
      ? 'Computer Science'
      : raw.files.some(f => /surgery|clinical|medical/i.test(f.name))
      ? 'Medical & Surgery'
      : raw.files.some(f => /business|bba|hnd/i.test(f.name))
      ? 'Business Administration'
      : 'Undergraduate General';

    student.parentFolder = programCategory;
    student.belongsTo = programCategory;

    if (student.identificationStatus === 'UNIDENTIFIED') {
      unidentifiedFolders.push(student);
    } else {
      students.push(student);
    }
  }

  // Master categories list: Core categories first, then discovered dynamic categories sorted
  const dynamicCategories = Array.from(discoveredCategoriesSet).filter(
    c => !CORE_CATEGORIES.includes(c)
  ).sort();

  const finalCategories = [...CORE_CATEGORIES, ...dynamicCategories];

  return {
    id: `scan_${Date.now()}`,
    folderName,
    folderId,
    driveUrl,
    scanDate: new Date().toISOString(),
    status: 'completed',
    sourceType: 'sample_dataset',
    students,
    unidentifiedFolders,
    categories: finalCategories,
    totalFilesCount: totalFiles,
  };
}
