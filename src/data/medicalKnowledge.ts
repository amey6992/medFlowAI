export interface ICD10Code {
  code: string;
  description: string;
  category: string;
}

export interface CPTCode {
  code: string;
  description: string;
  category: string;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  check: (data: any) => { valid: boolean; message?: string };
}

export const ICD10_DATABASE: Record<string, ICD10Code> = {
  "E11.9": { code: "E11.9", description: "Type 2 diabetes mellitus without complications", category: "Endocrine" },
  "E11.621": { code: "E11.621", description: "Type 2 diabetes mellitus with foot ulcer", category: "Endocrine" },
  "I10": { code: "I10", description: "Essential (primary) hypertension", category: "Circulatory" },
  "J45.909": { code: "J45.909", description: "Unspecified asthma, uncomplicated", category: "Respiratory" },
  "M54.50": { code: "M54.50", description: "Low back pain, unspecified", category: "Musculoskeletal" },
  "L03.115": { code: "L03.115", description: "Cellulitis of right lower limb", category: "Skin" },
  "I25.10": { code: "I25.10", description: "ASHD of native coronary artery without angina pectoris", category: "Circulatory" }
};

export const CPT_DATABASE: Record<string, CPTCode> = {
  "11042": { code: "11042", description: "Debridement, subcutaneous tissue; first 20 sq cm or less", category: "Surgery" },
  "99213": { code: "99213", description: "Office visit for the evaluation and management of an established patient (Low-Mid)", category: "E/M" },
  "99214": { code: "99214", description: "Office visit for the evaluation and management of an established patient (Moderate-High)", category: "E/M" },
  "93000": { code: "93000", description: "Electrocardiogram, routine ECG with at least 12 leads", category: "Medicine" },
  "27096": { code: "27096", description: "Injection procedure for sacroiliac joint, anesthetic/steroid", category: "Surgery" }
};

// Compatibility Matrix: Which ICD codes are valid for which CPT codes
export const COMPATIBILITY_RULES: Record<string, string[]> = {
  "11042": ["E11.621", "L03.115", "E11.9"], // Debridement valid for diabetic ulcers/cellulitis
  "93000": ["I10", "I25.10"], // ECG valid for hypertension/heart disease
  "27096": ["M54.50"], // SI joint injection for back pain
  "99213": ["E11.9", "I10", "J45.909", "M54.50"],
  "99214": ["E11.621", "I25.10", "L03.115"]
};

export const PAYER_POLICIES = [
  {
    id: "MEDICARE_LCD_001",
    name: "Medicare LCD: Wound Care",
    payer: "Medicare",
    requiredIcd: ["E11.621", "L03.115"],
    targetCpt: "11042",
    message: "Medicare requires specific documentation of ulcer or cellulitis for debridement coverage."
  },
  {
    id: "BCBS_AUTH_002",
    name: "BCBS Prior Auth: Cardiac Imaging",
    payer: "BCBS",
    targetCpt: "93306", // Echocardiogram (not in db yet but for rule example)
    requiresPriorAuth: true
  }
];
