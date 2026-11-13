import { ConfidenceLevel, DetectionMethod, ScannedFile } from '../types/verification';

export interface CategoryRule {
  normalizedName: string;
  isCore: boolean;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  priority: number;
}

export const CORE_CATEGORIES = [
  'O Level',
  'A Level',
  'Personal Statement',
  'CNIC',
  'Pic',
  'Eng Proficiency Letter',
  'HSSC',
  'SSC',
  'BTEC',
  'Consent Form',
  'Passport',
  'BA Hon',
  'Degree Completion Certificate',
  'HND Business',
  'BS Mass Communication',
  'BA Business Management',
  'BS Computer Science',
  'MPhil Clinical & Surgery',
];

export const CATEGORY_RULES: CategoryRule[] = [
  // CNIC - check front, back, smart card, national id, b-form
  {
    normalizedName: 'CNIC',
    isCore: true,
    patterns: [
      /\b(cnic|nic|national\s*id|identity\s*card|id\s*card|b\s*form|form\s*b|smart\s*card|nadra)\b/i,
      /\bcnic\s*(front|back|copy|scan|both)?\b/i,
      /(?<!\d)\d{5}[\s_-]?\d{7}[\s_-]?\d{1}(?!\d)/i,
    ],
    negativePatterns: [/\bpassport\b/i, /\bfather\b/i, /\bmother\b/i, /\bguardian\b/i, /\bparent\b/i],
    priority: 100,
  },
  // Father / Guardian CNIC (distinct from applicant's own CNIC)
  {
    normalizedName: 'Father / Guardian CNIC',
    isCore: false,
    patterns: [
      /\b(father|mother|parent|guardian)\s*(cnic|nic|id\s*card|national\s*id)\b/i,
      /\b(cnic|nic)\s*(of\s*)?(father|mother|parent|guardian)\b/i,
    ],
    priority: 98,
  },
  // Picture / Photo - applicant photo, passport size photo
  {
    normalizedName: 'Pic',
    isCore: true,
    patterns: [
      /\b(pic|pics|picture|photo|photograph|applicant\s*pic|applicant\s*photo|student\s*photo|passport\s*photo|passport\s*size\s*photo|pp\s*size|profile\s*pic|headshot|avatar|selfie)\b/i,
      /^img\s*\d+/i,
    ],
    negativePatterns: [/\bcnic\b/i, /\bcard\b/i, /\bcertificate\b/i, /\bdegree\b/i, /\bpassport\s*(copy|front|scan|bio|page)\b/i],
    priority: 95,
  },
  // O Level
  {
    normalizedName: 'O Level',
    isCore: true,
    patterns: [
      /\b(o\s*level|olevel|o\s*levels|olevels|gce\s*o\s*level|ordinary\s*level|cie\s*o\s*level|igcse)\b/i,
    ],
    negativePatterns: [/\ba\s*level\b/i, /\balevel\b/i, /\bas\s*level\b/i],
    priority: 92,
  },
  // A Level
  {
    normalizedName: 'A Level',
    isCore: true,
    patterns: [
      /\b(a\s*level|alevel|a\s*levels|alevels|gce\s*a\s*level|advanced\s*level|cie\s*a\s*level|as\s*level)\b/i,
    ],
    negativePatterns: [/\bo\s*level\b/i, /\bolevel\b/i],
    priority: 92,
  },
  // Personal Statement
  {
    normalizedName: 'Personal Statement',
    isCore: true,
    patterns: [
      /\b(personal\s*statement|statement\s*of\s*purpose|sop|motivation\s*letter|letter\s*of\s*intent|cover\s*letter)\b/i,
    ],
    priority: 90,
  },
  // English Proficiency Letter
  {
    normalizedName: 'Eng Proficiency Letter',
    isCore: true,
    patterns: [
      /\b(eng(lish)?\s*proficien(cy|t)?\s*(letter|cert(ificate)?)?|medium\s*of\s*instruction|moi|epl)\b/i,
    ],
    negativePatterns: [/\bielts\b/i, /\btoefl\b/i, /\bpte\b/i],
    priority: 88,
  },
  // HSSC (Intermediate / FSc / FA / ICS)
  {
    normalizedName: 'HSSC',
    isCore: true,
    patterns: [
      /\b(hssc|intermediate|inter|fsc|f\s*sc|fa|f\s*a|ics|i\s*c\s*s|icom|i\s*com|12th\s*(grade|class)?|higher\s*secondary)\b/i,
    ],
    negativePatterns: [/\bssc\b/i, /\bmatric\b/i, /\b10th\b/i],
    priority: 88,
  },
  // SSC (Matriculation / Matric / 10th)
  {
    normalizedName: 'SSC',
    isCore: true,
    patterns: [
      /\b(ssc|matric(ulation)?|10th\s*(grade|class)?|secondary\s*school\s*(cert(ificate)?)?)\b/i,
    ],
    negativePatterns: [/\bhssc\b/i, /\bintermediate\b/i, /\b12th\b/i],
    priority: 88,
  },
  // BTEC
  {
    normalizedName: 'BTEC',
    isCore: true,
    patterns: [/\b(btec|btec\s*(national|extended|diploma|hnd)?)\b/i],
    priority: 86,
  },
  // Consent Form
  {
    normalizedName: 'Consent Form',
    isCore: true,
    patterns: [
      /\b(consent\s*form|parent\s*consent|guardian\s*consent|undertaking|affidavit|declaration\s*form)\b/i,
    ],
    priority: 85,
  },
  // Passport
  {
    normalizedName: 'Passport',
    isCore: true,
    patterns: [
      /\b(passport|passport\s*(copy|front|first\s*page|scan|bio|page))\b/i,
    ],
    negativePatterns: [/\bphoto\b/i, /\bpic\b/i, /\bsize\b/i],
    priority: 91,
  },
  // BA Hon
  {
    normalizedName: 'BA Hon',
    isCore: true,
    patterns: [
      /\b(ba\s*hon(ours?|s)?|bachelor\s*of\s*arts\s*hon(ours?|s)?)\b/i,
    ],
    priority: 86,
  },
  // Degree Completion Certificate
  {
    normalizedName: 'Degree Completion Certificate',
    isCore: true,
    patterns: [
      /\b(degree\s*completion\s*(certificate|cert)?|dcc|provisional\s*(degree\s*)?(cert(ificate)?)?|completion\s*certificate|hope\s*certificate)\b/i,
    ],
    priority: 86,
  },
  // HND Business
  {
    normalizedName: 'HND Business',
    isCore: true,
    patterns: [
      /\b(hnd\s*business|higher\s*national\s*diploma\s*(in\s*)?business)\b/i,
    ],
    priority: 86,
  },
  // BS Mass Communication
  {
    normalizedName: 'BS Mass Communication',
    isCore: true,
    patterns: [
      /\b(bs\s*mass\s*comm(unication)?|bachelor\s*of\s*science\s*(in\s*)?mass\s*comm(unication)?)\b/i,
    ],
    priority: 86,
  },
  // BA Business Management
  {
    normalizedName: 'BA Business Management',
    isCore: true,
    patterns: [
      /\b(ba\s*business\s*manag(e|ement)|bba|bachelor\s*(in|of)\s*business\s*(management|admin(istration)?))\b/i,
    ],
    priority: 84,
  },
  // BS Computer Science
  {
    normalizedName: 'BS Computer Science',
    isCore: true,
    patterns: [
      /\b(bs\s*computer\s*science|bscs|bs\s*cs|bachelor\s*of\s*science\s*(in\s*)?computer\s*science)\b/i,
    ],
    priority: 86,
  },
  // MPhil Clinical & Surgery
  {
    normalizedName: 'MPhil Clinical & Surgery',
    isCore: true,
    patterns: [
      /\b(mphil\s*clinical\s*(&|and)?\s*surgery|m\s*phil\s*clinical\s*surgery)\b/i,
    ],
    priority: 86,
  },
  // Dynamic categories recognized commonly in student documents
  {
    normalizedName: 'IELTS Certificate',
    isCore: false,
    patterns: [/\b(ielts|ielts\s*trf|ielts\s*cert(ificate)?|ielts\s*score)\b/i],
    priority: 84,
  },
  {
    normalizedName: 'TOEFL / PTE Score',
    isCore: false,
    patterns: [/\b(toefl|pte|duolingo\s*english)\b/i],
    priority: 82,
  },
  {
    normalizedName: 'Equivalence Certificate',
    isCore: false,
    patterns: [/\b(equivalence|ibcc|hec\s*equivalence|equivalency)\b/i],
    priority: 82,
  },
  {
    normalizedName: 'Official Transcript',
    isCore: false,
    patterns: [/\b(official\s*transcript|transcript\s*of\s*records|academic\s*transcript|transcript|mark\s*sheet|marksheet|dmc|detail(ed)?\s*marks\s*cert(ificate)?|result\s*card)\b/i],
    priority: 78,
  },
  {
    normalizedName: 'Domicile Certificate',
    isCore: false,
    patterns: [/\b(domicile|prc)\b/i],
    priority: 82,
  },
  {
    normalizedName: 'Character Certificate',
    isCore: false,
    patterns: [/\b(character\s*(cert(ificate)?|conduct)?|good\s*conduct)\b/i],
    priority: 80,
  },
  {
    normalizedName: 'Migration Certificate',
    isCore: false,
    patterns: [/\b(migration\s*(cert(ificate)?)?|noc|no\s*objection\s*cert(ificate)?|transfer\s*cert(ificate)?)\b/i],
    priority: 80,
  },
  {
    normalizedName: 'Family Registration Certificate (FRC)',
    isCore: false,
    patterns: [/\b(frc|family\s*registration\s*cert(ificate)?)\b/i],
    priority: 82,
  },
  {
    normalizedName: 'Birth Certificate',
    isCore: false,
    patterns: [/\b(birth\s*cert(ificate)?|crc)\b/i],
    priority: 82,
  },
  {
    normalizedName: 'Fee Challan / Receipt',
    isCore: false,
    patterns: [/\b(fee\s*(challan|receipt|voucher|slip|paid)|challan|bank\s*receipt|payment\s*receipt)\b/i],
    priority: 80,
  },
  {
    normalizedName: 'Admission / Application Form',
    isCore: false,
    patterns: [/\b(application\s*form|admission\s*form|enrollment\s*form|registration\s*form)\b/i],
    priority: 78,
  },
  {
    normalizedName: 'Medical Fitness Certificate',
    isCore: false,
    patterns: [/\b(medical\s*(fitness|cert(ificate)?|report|exam)|health\s*cert(ificate)?|vaccination)\b/i],
    priority: 78,
  },
  {
    normalizedName: 'Work Experience Letter',
    isCore: false,
    patterns: [/\b(work\s*exp(erience)?\s*(letter|cert(ificate)?)?|experience\s*letter|employment\s*letter)\b/i],
    priority: 78,
  },
  {
    normalizedName: 'Recommendation Letter',
    isCore: false,
    patterns: [/\b(recommendation\s*(letter|form)?|reference\s*letter|lor)\b/i],
    priority: 78,
  },
  {
    normalizedName: 'Resume / CV',
    isCore: false,
    patterns: [/\b(resume|cv|curriculum\s*vitae)\b/i],
    priority: 78,
  },
];

/**
 * Normalizes a filename or folder hint into space-separated tokens so regex word boundaries (\b)
 * work properly even when files use underscores (_), dots (.), hyphens (-), or camelCase.
 */
export function normalizeForClassification(raw: string): string {
  const withoutExt = raw.replace(/\.[a-zA-Z0-9]{1,6}$/, '').trim();
  // Split camelCase like "PersonalStatement" -> "Personal Statement"
  const splitCamel = withoutExt.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Replace underscores, hyphens, dots, slashes with spaces
  return splitCamel.replace(/[_\-./\\()[\]{}]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes file name into clean, title-cased dynamic category if not matched by standard rules.
 */
export function extractDynamicCategoryFromFilename(rawName: string): string | null {
  // Always extract only the basename if a path was passed
  const baseName = rawName.split('/').pop() || rawName;
  const withoutExt = baseName.replace(/\.[a-zA-Z0-9]{1,6}$/, '').trim();

  // Strip CNICs, leading index numbers, common noise words
  let stripped = withoutExt
    .replace(/\d{5}[-_\s]?\d{7}[-_\s]?\d{1}/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.()[\]{}]+/g, ' ')
    .replace(/^\s*(\d+\s+)+/g, '')
    .replace(/\b(copy|scan|scanned|final|draft|new|updated|verified|attested)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return null;

  // Reject purely generic scanner / camera names with no semantic meaning
  if (/^(img|dsc|photo|image|scan|doc|document|file|untitled|upload|whatsapp image|camscanner|page|pdf|\d+)(\s*\d+)*$/i.test(stripped)) {
    return null;
  }

  // If matches known degree or certificate patterns, prefer the clean phrase
  const degreeMatch = stripped.match(/\b(BS|MS|BA|MA|BSc|MSc|BBA|MBA|BTEC|HND|Diploma|Certificate|Degree|Letter|Affidavit)\s+[A-Za-z\s&]+/i);
  if (degreeMatch) {
    return titleCase(degreeMatch[0].trim());
  }

  // Any clean descriptive filename >= 3 alphabetic chars becomes its own dynamic document category
  if (stripped.replace(/[^a-zA-Z]/g, '').length >= 3) {
    return titleCase(stripped);
  }

  return null;
}

export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Classifies a single file using filenames, extensions, MIME types, optional folder hint, and pattern weights.
 */
export function classifyDocumentFile(
  fileName: string,
  mimeType: string = '',
  customRules: CategoryRule[] = [],
  folderHint: string = ''
): {
  category: string;
  confidence: ConfidenceLevel;
  detectionMethod: DetectionMethod;
  reason?: string;
  possibleCategories?: string[];
} {
  const combinedRules = [...customRules, ...CATEGORY_RULES].sort(
    (a, b) => b.priority - a.priority
  );

  // Extract pure filename (in case a path was passed)
  const pureFileName = fileName.includes('/') ? fileName.split('/').pop() || fileName : fileName;
  const folderFromPath = fileName.includes('/') ? fileName.split('/').slice(0, -1).join(' ') : '';
  const effectiveFolderHint = [folderHint, folderFromPath].filter(Boolean).join(' ').trim();

  const normalizedFileText = normalizeForClassification(pureFileName);
  const normalizedCombinedText = effectiveFolderHint
    ? `${normalizeForClassification(effectiveFolderHint)} ${normalizedFileText}`
    : normalizedFileText;

  // Check rules first against the file's own name, then fallback to folderHint + fileName
  const matchAgainstText = (text: string): { rule: CategoryRule; score: number }[] => {
    const matches: { rule: CategoryRule; score: number }[] = [];
    for (const rule of combinedRules) {
      if (rule.negativePatterns?.some(np => np.test(text))) {
        continue;
      }
      for (const pat of rule.patterns) {
        if (pat.test(text)) {
          let score = rule.priority;
          if (rule.normalizedName === 'Pic' && mimeType.startsWith('image/')) {
            score += 10;
          }
          matches.push({ rule, score });
          break;
        }
      }
    }
    return matches;
  };

  let matchedRules = matchAgainstText(normalizedFileText);
  if (matchedRules.length === 0 && effectiveFolderHint) {
    matchedRules = matchAgainstText(normalizedCombinedText);
  }

  if (matchedRules.length > 0) {
    matchedRules.sort((a, b) => b.score - a.score);
    const top = matchedRules[0];

    if (top.score >= 85) {
      return {
        category: top.rule.normalizedName,
        confidence: 'HIGH',
        detectionMethod: mimeType ? 'Filename + MIME' : 'Filename Pattern',
        possibleCategories: matchedRules.map(m => m.rule.normalizedName),
      };
    } else {
      return {
        category: top.rule.normalizedName,
        confidence: 'MEDIUM',
        detectionMethod: 'Filename Pattern',
        possibleCategories: matchedRules.map(m => m.rule.normalizedName),
      };
    }
  }

  // If image without clear name, check if it looks like a photo
  if (mimeType.startsWith('image/')) {
    if (/^(img|dsc|photo|image|scan|p)\s*\d+/i.test(normalizedFileText) || /^(img|dsc|photo|image)/i.test(normalizedFileText)) {
      return {
        category: 'Pic',
        confidence: 'MEDIUM',
        detectionMethod: 'AI/Image Classification',
        reason: 'Image file with generic camera name pattern',
        possibleCategories: ['Pic', 'CNIC'],
      };
    }
  }

  // Attempt dynamic discovery from filename (or folder hint if filename is generic like scan1.pdf)
  const dynamicCat =
    extractDynamicCategoryFromFilename(pureFileName) ||
    (effectiveFolderHint ? extractDynamicCategoryFromFilename(effectiveFolderHint) : null);

  if (dynamicCat && dynamicCat.length >= 3) {
    return {
      category: dynamicCat,
      confidence: 'MEDIUM',
      detectionMethod: 'Filename Pattern',
      possibleCategories: [dynamicCat],
      reason: `Discovered dynamic document category from '${pureFileName}'`,
    };
  }

  // Unidentified / Low confidence file
  return {
    category: 'Unknown',
    confidence: 'LOW',
    detectionMethod: 'Filename Pattern',
    reason: 'Ambiguous filename without standard academic or ID patterns. Requires manual review.',
    possibleCategories: ['SSC', 'HSSC', 'Consent Form', 'Other'],
  };
}
