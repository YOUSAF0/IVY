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
  // CNIC - check front, back, smart card, national id
  {
    normalizedName: 'CNIC',
    isCore: true,
    patterns: [
      /\b(cnic|nic|national[-_\s]?id|identity[-_\s]?card|b[-_\s]?form|form[-_\s]?b|smart[-_\s]?card)\b/i,
      /\bcnic[-_\s]?(front|back|copy|scan)?\b/i,
      /\b\d{5}[-_]?\d{7}[-_]?\d{1}\b/i,
    ],
    negativePatterns: [/\bpassport\b/i],
    priority: 100,
  },
  // Picture / Photo - applicant photo, passport size photo
  {
    normalizedName: 'Pic',
    isCore: true,
    patterns: [
      /\b(pic|picture|photo|photograph|applicant[-_\s]?pic|applicant[-_\s]?photo|passport[-_\s]?photo|passport[-_\s]?size[-_\s]?photo|profile[-_\s]?pic|headshot|avatar)\b/i,
      /^img[-_\s]?\d+/i,
    ],
    negativePatterns: [/\bcnic\b/i, /\bcard\b/i, /\bcertificate\b/i, /\bdegree\b/i],
    priority: 95,
  },
  // O Level
  {
    normalizedName: 'O Level',
    isCore: true,
    patterns: [
      /\b(o[-_\s]?level|gce[-_\s]?o[-_\s]?level|ordinary[-_\s]?level|cie[-_\s]?o[-_\s]?level|igcse)\b/i,
    ],
    negativePatterns: [/\ba[-_\s]?level\b/i, /\bas[-_\s]?level\b/i],
    priority: 90,
  },
  // A Level
  {
    normalizedName: 'A Level',
    isCore: true,
    patterns: [
      /\b(a[-_\s]?level|gce[-_\s]?a[-_\s]?level|advanced[-_\s]?level|cie[-_\s]?a[-_\s]?level|as[-_\s]?level)\b/i,
    ],
    negativePatterns: [/\bo[-_\s]?level\b/i],
    priority: 90,
  },
  // Personal Statement
  {
    normalizedName: 'Personal Statement',
    isCore: true,
    patterns: [
      /\b(personal[-_\s]?statement|statement[-_\s]?of[-_\s]?purpose|sop|motivation[-_\s]?letter|letter[-_\s]?of[-_\s]?intent)\b/i,
    ],
    priority: 90,
  },
  // English Proficiency Letter
  {
    normalizedName: 'Eng Proficiency Letter',
    isCore: true,
    patterns: [
      /\b(eng(lish)?[-_\s]?proficien(cy|t)?[-_\s]?(letter|cert(ificate)?)?|medium[-_\s]?of[-_\s]?instruction|epl)\b/i,
    ],
    negativePatterns: [/\bielts\b/i, /\btoefl\b/i],
    priority: 85,
  },
  // HSSC (Intermediate / FSc / FA / ICS)
  {
    normalizedName: 'HSSC',
    isCore: true,
    patterns: [
      /\b(hssc|intermediate|inter|fsc|f\.sc|fa|f\.a|ics|i\.c\.s|icom|i\.com|12th[-_\s]?(grade|class)|higher[-_\s]?secondary)\b/i,
    ],
    negativePatterns: [/\bssc\b/i, /\bmatric\b/i, /\b10th\b/i],
    priority: 85,
  },
  // SSC (Matriculation / Matric / 10th)
  {
    normalizedName: 'SSC',
    isCore: true,
    patterns: [
      /\b(ssc|matric(ulation)?|10th[-_\s]?(grade|class)|secondary[-_\s]?school[-_\s]?cert(ificate)?)\b/i,
    ],
    negativePatterns: [/\bhssc\b/i, /\bintermediate\b/i, /\b12th\b/i],
    priority: 85,
  },
  // BTEC
  {
    normalizedName: 'BTEC',
    isCore: true,
    patterns: [/\b(btec|btec[-_\s]?(national|extended|diploma|hnd)?)\b/i],
    priority: 85,
  },
  // Consent Form
  {
    normalizedName: 'Consent Form',
    isCore: true,
    patterns: [
      /\b(consent[-_\s]?form|parent[-_\s]?consent|guardian[-_\s]?consent|undertaking|affidavit)\b/i,
    ],
    priority: 80,
  },
  // Passport
  {
    normalizedName: 'Passport',
    isCore: true,
    patterns: [
      /\b(passport|passport[-_\s]?(copy|front|first[-_\s]?page|scan|bio))\b/i,
    ],
    negativePatterns: [/\bphoto\b/i, /\bpic\b/i],
    priority: 90,
  },
  // BA Hon
  {
    normalizedName: 'BA Hon',
    isCore: true,
    patterns: [
      /\b(ba[-_\s]?hon(ours?|s)?|bachelor[-_\s]?of[-_\s]?arts[-_\s]?hon(ours?|s)?|ba\s*\(hon(s)?\))\b/i,
    ],
    priority: 85,
  },
  // Degree Completion Certificate
  {
    normalizedName: 'Degree Completion Certificate',
    isCore: true,
    patterns: [
      /\b(degree[-_\s]?completion[-_\s]?(certificate|cert)?|dcc|provisional[-_\s]?degree[-_\s]?(cert(ificate)?)?|degree[-_\s]?completion)\b/i,
    ],
    priority: 85,
  },
  // HND Business
  {
    normalizedName: 'HND Business',
    isCore: true,
    patterns: [
      /\b(hnd[-_\s]?business|higher[-_\s]?national[-_\s]?diploma[-_\s]?in[-_\s]?business)\b/i,
    ],
    priority: 85,
  },
  // BS Mass Communication
  {
    normalizedName: 'BS Mass Communication',
    isCore: true,
    patterns: [
      /\b(bs[-_\s]?mass[-_\s]?comm(unication)?|bachelor[-_\s]?of[-_\s]?science[-_\s]?mass[-_\s]?comm(unication)?)\b/i,
    ],
    priority: 85,
  },
  // BA Business Management
  {
    normalizedName: 'BA Business Management',
    isCore: true,
    patterns: [
      /\b(ba[-_\s]?business[-_\s]?manag(e|ement)|bba|bachelor[-_\s]?in[-_\s]?business[-_\s]?management)\b/i,
    ],
    priority: 80,
  },
  // BS Computer Science
  {
    normalizedName: 'BS Computer Science',
    isCore: true,
    patterns: [
      /\b(bs[-_\s]?computer[-_\s]?science|bscs|bs[-_\s]?cs|bachelor[-_\s]?of[-_\s]?science[-_\s]?computer[-_\s]?science)\b/i,
    ],
    priority: 85,
  },
  // MPhil Clinical & Surgery
  {
    normalizedName: 'MPhil Clinical & Surgery',
    isCore: true,
    patterns: [
      /\b(mphil[-_\s]?clinical[-_\s]?(&|and)?[-_\s]?surgery|m\.?phil[-_\s]?clinical[-_\s]?surgery)\b/i,
    ],
    priority: 85,
  },
  // Dynamic categories recognized commonly in student documents
  {
    normalizedName: 'IELTS Certificate',
    isCore: false,
    patterns: [/\b(ielts|ielts[-_\s]?trf|ielts[-_\s]?cert(ificate)?)\b/i],
    priority: 80,
  },
  {
    normalizedName: 'Work Experience Letter',
    isCore: false,
    patterns: [/\b(work[-_\s]?exp(erience)?[-_\s]?(letter|cert(ificate)?)?|experience[-_\s]?letter|employment[-_\s]?letter)\b/i],
    priority: 75,
  },
  {
    normalizedName: 'Recommendation Letter',
    isCore: false,
    patterns: [/\b(recommendation[-_\s]?(letter|form)?|reference[-_\s]?letter|lor)\b/i],
    priority: 75,
  },
  {
    normalizedName: 'Character Certificate',
    isCore: false,
    patterns: [/\b(character[-_\s]?(cert(ificate)?|conduct))\b/i],
    priority: 75,
  },
  {
    normalizedName: 'Official Transcript',
    isCore: false,
    patterns: [/\b(official[-_\s]?transcript|transcript[-_\s]?of[-_\s]?records|academic[-_\s]?transcript|mark[-_\s]?sheet)\b/i],
    priority: 70,
  },
  {
    normalizedName: 'Resume / CV',
    isCore: false,
    patterns: [/\b(resume|cv|curriculum[-_\s]?vitae)\b/i],
    priority: 75,
  },
];

/**
 * Normalizes file name into clean, title-cased dynamic category if not matched by standard rules.
 */
export function extractDynamicCategoryFromFilename(rawName: string): string | null {
  // Remove file extension
  const clean = rawName.replace(/\.[a-zA-Z0-9]+$/, '').trim();

  // Remove common prefix tokens like "01_", "Document_", student names if present
  const stripped = clean
    .replace(/^(\d+[-_.\s]*)+/g, '')
    .replace(/[-_]/g, ' ')
    .trim();

  // If matches known degree or certificate patterns
  const degreeMatch = stripped.match(/\b(BS|MS|BA|MA|BSc|MSc|BBA|MBA|BTEC|HND|Diploma|Certificate|Degree|Letter|Affidavit)\s+[A-Za-z\s&]+/i);
  if (degreeMatch) {
    return titleCase(degreeMatch[0].trim());
  }

  // If words contain certificate or letter
  if (/certificate|letter|statement|diploma|card|report/i.test(stripped)) {
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
 * Classifies a single file using filenames, extensions, MIME types, and pattern weights.
 */
export function classifyDocumentFile(
  fileName: string,
  mimeType: string = '',
  customRules: CategoryRule[] = []
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

  const cleanName = fileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();

  // Check against rules
  const matchedRules: { rule: CategoryRule; score: number }[] = [];

  for (const rule of combinedRules) {
    if (rule.negativePatterns?.some(np => np.test(cleanName))) {
      continue;
    }

    for (const pat of rule.patterns) {
      if (pat.test(cleanName)) {
        let score = rule.priority;
        // Boost if image mime type matches Pic
        if (rule.normalizedName === 'Pic' && mimeType.startsWith('image/')) {
          score += 10;
        }
        matchedRules.push({ rule, score });
        break;
      }
    }
  }

  if (matchedRules.length > 0) {
    // Sort highest score first
    matchedRules.sort((a, b) => b.score - a.score);
    const top = matchedRules[0];

    // Check confidence
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
    if (/^(img|dsc|photo|image|scan|p_)\d+/i.test(cleanName)) {
      return {
        category: 'Pic',
        confidence: 'MEDIUM',
        detectionMethod: 'AI/Image Classification',
        reason: 'Image file with generic camera name pattern',
        possibleCategories: ['Pic', 'CNIC'],
      };
    }
  }

  // Attempt dynamic discovery
  const dynamicCat = extractDynamicCategoryFromFilename(fileName);
  if (dynamicCat && dynamicCat.length > 3 && !/^(document|file|untitled|scan|upload)/i.test(dynamicCat)) {
    return {
      category: dynamicCat,
      confidence: 'MEDIUM',
      detectionMethod: 'Filename Pattern',
      possibleCategories: [dynamicCat],
      reason: `Discovered dynamic document category from '${fileName}'`,
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
