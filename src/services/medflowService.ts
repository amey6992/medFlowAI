import { GoogleGenAI, Type } from "@google/genai";
import { ICD10_DATABASE, CPT_DATABASE, COMPATIBILITY_RULES, PAYER_POLICIES } from "../data/medicalKnowledge";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// SET TO TRUE FOR LOCAL DEVELOPMENT WITH OLLAMA
const USE_LOCAL_BACKEND = false; 
const LOCAL_BACKEND_URL = "http://localhost:8000/analyze";

export interface ExtractionResult {
  patient: {
    age: number;
    gender: string;
    history: string[];
  };
  clinical: {
    diagnosis: string;
    symptoms: string[];
    procedures: string[];
  };
  confidence: number;
}

export interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  details?: string;
  output?: any;
}

export interface ClaimDecision {
  status: 'APPROVE' | 'REJECT' | 'ESCALATE';
  reason: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  assignedIcd: string[];
  assignedCpt: string[];
  auditTrail: string[];
}

export async function processClinicalNote(note: string, payer: string = "Medicare"): Promise<{ extraction: ExtractionResult, decision: ClaimDecision, steps: ProcessingStep[] }> {
  if (USE_LOCAL_BACKEND) {
    return processWithLocalBackend(note, payer);
  }

  const steps: ProcessingStep[] = [];
  
  // 1. Clinical Extraction
  steps.push({ id: 'extract', name: 'Clinical Extraction', status: 'processing' });
  const extraction = await extractClinicalData(note);
  steps[0].status = 'completed';
  steps[0].output = extraction;

  // 2. Risk Detection
  steps.push({ id: 'risk', name: 'Risk Detection', status: 'processing' });
  const risk = detectRisks(extraction);
  steps[1].status = 'completed';
  steps[1].output = risk;

  // 3. Medical Coding (Strict Mapping)
  steps.push({ id: 'coding', name: 'Medical Coding', status: 'processing' });
  const codes = mapToCodes(extraction);
  steps[2].status = 'completed';
  steps[2].output = codes;

  // 4. Rule Validation
  steps.push({ id: 'validate', name: 'Rule Validation', status: 'processing' });
  const validation = validateClaim(extraction, codes, payer);
  steps[3].status = 'completed';
  steps[3].output = validation;

  // 5. Final Decision
  steps.push({ id: 'decision', name: 'Decision Engine', status: 'processing' });
  const decision = makeDecision(extraction, risk, codes, validation);
  steps[4].status = 'completed';
  steps[4].output = decision;

  return { extraction, decision, steps };
}

async function processWithLocalBackend(note: string, payer: string): Promise<any> {
  const response = await fetch(LOCAL_BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  });
  
  if (!response.ok) {
    throw new Error("Local backend error. Ensure server.py is running.");
  }
  
  const data = await response.json();
  
  // Reconstruct steps for UI consistency
  const steps: ProcessingStep[] = [
    { id: 'extract', name: 'Clinical Extraction (Ollama)', status: 'completed', output: data.extraction },
    { id: 'risk', name: 'Risk Detection', status: 'completed', output: { level: data.decision.riskLevel } },
    { id: 'coding', name: 'Medical Coding', status: 'completed', output: { assignedIcd: data.decision.assignedIcd, assignedCpt: data.decision.assignedCpt } },
    { id: 'validate', name: 'Rule Validation', status: 'completed', output: { errors: [], warnings: [] } },
    { id: 'decision', name: 'Decision Engine', status: 'completed', output: data.decision }
  ];

  return { extraction: data.extraction, decision: data.decision, steps };
}

async function extractClinicalData(note: string): Promise<ExtractionResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract clinical data from the following note. 
    Return JSON format. 
    Note: "${note}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          patient: {
            type: Type.OBJECT,
            properties: {
              age: { type: Type.NUMBER },
              gender: { type: Type.STRING },
              history: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["age", "gender"]
          },
          clinical: {
            type: Type.OBJECT,
            properties: {
              diagnosis: { type: Type.STRING },
              symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
              procedures: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["diagnosis"]
          },
          confidence: { type: Type.NUMBER, description: "Confidence score from 0 to 1" }
        },
        required: ["patient", "clinical", "confidence"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as ExtractionResult;
}

function detectRisks(extraction: ExtractionResult) {
  const risks: string[] = [];
  let level: 'Low' | 'Medium' | 'High' = 'Low';

  const diag = extraction.clinical.diagnosis.toLowerCase();
  const history = extraction.patient.history.map(h => h.toLowerCase());
  const symptoms = extraction.clinical.symptoms.map(s => s.toLowerCase());

  if (diag.includes('diabetes') || history.some(h => h.includes('diabetes'))) {
    if (diag.includes('infection') || symptoms.some(s => s.includes('infection') || s.includes('ulcer'))) {
      risks.push("High: Diabetic complication risk (Infection/Ulcer detected)");
      level = 'High';
    } else {
      risks.push("Medium: Chronic condition management (Diabetes)");
      level = 'Medium';
    }
  }

  if (diag.includes('chest pain') || symptoms.some(s => s.includes('chest pain'))) {
    risks.push("High: Potential cardiac event");
    level = 'High';
  }

  if (diag.includes('addison') || diag.includes('adrenal') || symptoms.some(s => s.includes('hyperpigmentation'))) {
    risks.push("High: Complex endocrine condition (Addison's/Adrenal Insufficiency)");
    level = 'High';
  }

  return { level, triggers: risks };
}

function mapToCodes(extraction: ExtractionResult) {
  const assignedIcd: string[] = [];
  const assignedCpt: string[] = [];
  const audit: string[] = [];

  const diag = extraction.clinical.diagnosis.toLowerCase();
  const procs = extraction.clinical.procedures.map(p => p.toLowerCase());
  const symptoms = extraction.clinical.symptoms.map(s => s.toLowerCase());

  // ICD-10 Mapping
  if (diag.includes('diabetes')) {
    if (diag.includes('ulcer') || symptoms.some(s => s.includes('ulcer'))) {
      assignedIcd.push("E11.621");
      audit.push("Mapped 'Diabetes + Ulcer' to E11.621.");
    } else {
      assignedIcd.push("E11.9");
      audit.push("Mapped 'Diabetes' to E11.9.");
    }
  } else if (diag.includes('hypertension')) {
    assignedIcd.push("I10");
    audit.push("Mapped 'Hypertension' to I10.");
  } else if (diag.includes('asthma')) {
    assignedIcd.push("J45.909");
    audit.push("Mapped 'Asthma' to J45.909.");
  } else if (diag.includes('knee replacement') || diag.includes('post-op')) {
    assignedIcd.push("Z47.1");
    audit.push("Mapped 'Post-op Joint Aftercare' to Z47.1.");
  } else if (diag.includes('sprain') || diag.includes('ankle')) {
    assignedIcd.push("S93.401A");
    audit.push("Mapped 'Ankle Sprain' to S93.401A.");
  } else if (diag.includes('addison') || diag.includes('adrenal') || symptoms.some(s => s.includes('hyperpigmentation'))) {
    assignedIcd.push("E27.1");
    audit.push("Mapped 'Addison's Disease' or 'Adrenal Insufficiency' to E27.1.");
  } else {
    assignedIcd.push("R69"); // Illness, unspecified
    audit.push("Defaulted to R69 (Unspecified illness) due to ambiguous diagnosis.");
  }

  // CPT Mapping
  if (procs.some(p => p.includes('debridement'))) {
    assignedCpt.push("11042");
    audit.push("Mapped 'Debridement' to CPT 11042.");
  } else if (procs.some(p => p.includes('ecg') || p.includes('electrocardiogram'))) {
    assignedCpt.push("93000");
    audit.push("Mapped 'ECG' to CPT 93000.");
  } else if (procs.some(p => p.includes('nebulizer') || p.includes('inhalation'))) {
    assignedCpt.push("94640");
    audit.push("Mapped 'Nebulizer Treatment' to CPT 94640.");
  } else if (procs.some(p => p.includes('physical therapy') || p.includes('exercise'))) {
    assignedCpt.push("97110");
    audit.push("Mapped 'Therapeutic Exercise' to CPT 97110.");
  } else {
    assignedCpt.push("99213"); // Default E/M
    audit.push("Assigned standard Office Visit code 99213.");
  }

  return { assignedIcd, assignedCpt, audit };
}

function validateClaim(extraction: ExtractionResult, codes: any, payer: string) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Compatibility Check
  codes.assignedCpt.forEach((cpt: string) => {
    const validIcds = COMPATIBILITY_RULES[cpt] || [];
    const hasValidIcd = codes.assignedIcd.some((icd: string) => validIcds.includes(icd));
    if (!hasValidIcd && validIcds.length > 0) {
      errors.push(`CPT ${cpt} is not typically compatible with assigned ICD codes.`);
    }
  });

  // 2. Payer Specific Rules
  const policy = PAYER_POLICIES.find(p => p.payer === payer && codes.assignedCpt.includes(p.targetCpt));
  if (policy) {
    const hasRequired = policy.requiredIcd?.some(icd => codes.assignedIcd.includes(icd));
    if (!hasRequired) {
      errors.push(`Payer Policy Violation (${policy.id}): ${policy.message}`);
    }
  }

  // 3. Age/Gender constraints (Example)
  if (extraction.patient.age < 18 && codes.assignedCpt.includes("99214")) {
    warnings.push("Pediatric patient with high-complexity E/M code; verify documentation.");
  }

  return { errors, warnings };
}

function makeDecision(extraction: ExtractionResult, risk: any, codes: any, validation: any): ClaimDecision {
  let status: 'APPROVE' | 'REJECT' | 'ESCALATE' = 'APPROVE';
  let reason = "All clinical and administrative rules satisfied.";

  if (extraction.confidence < 0.7) {
    status = 'ESCALATE';
    reason = `Low extraction confidence (${(extraction.confidence * 100).toFixed(1)}%). Needs human review.`;
  } else if (validation.errors.length > 0) {
    status = 'REJECT';
    reason = validation.errors.join(" ");
  } else if (risk.level === 'High' || validation.warnings.length > 0) {
    status = 'ESCALATE';
    reason = risk.level === 'High' 
      ? `High clinical risk detected: ${risk.triggers.join(", ")}` 
      : "Administrative warnings present.";
  }

  return {
    status,
    reason,
    riskLevel: risk.level,
    assignedIcd: codes.assignedIcd,
    assignedCpt: codes.assignedCpt,
    auditTrail: [
      ...codes.audit,
      ...validation.errors.map((e: string) => `Error: ${e}`),
      ...validation.warnings.map((w: string) => `Warning: ${w}`),
      `Final Decision: ${status} - ${reason}`
    ]
  };
}
