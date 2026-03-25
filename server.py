from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import ollama
import json
import re

app = FastAPI(title="MedFlow AI Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Deterministic Knowledge Base (Same as TS version) ---
ICD10_DATABASE = {
    "E11.9": {"code": "E11.9", "description": "Type 2 diabetes mellitus without complications"},
    "E11.621": {"code": "E11.621", "description": "Type 2 diabetes mellitus with foot ulcer"},
    "I10": {"code": "I10", "description": "Essential (primary) hypertension"},
}

CPT_DATABASE = {
    "11042": {"code": "11042", "description": "Debridement, subcutaneous tissue"},
    "93000": {"code": "93000", "description": "Electrocardiogram, routine ECG"},
    "99213": {"code": "99213", "description": "Office visit (Low-Mid)"},
}

COMPATIBILITY_RULES = {
    "11042": ["E11.621", "E11.9"],
    "93000": ["I10"],
}

# --- Models ---
class Patient(BaseModel):
    age: Any
    gender: Any
    history: List[Any]

class Clinical(BaseModel):
    diagnosis: Any
    symptoms: List[Any]
    procedures: List[Any]
    suggested_icd: Optional[List[str]] = []
    suggested_cpt: Optional[List[str]] = []

class SanityCheck(BaseModel):
    is_possible: Any
    reasoning: Any
    reason: Any

class ExtractionResult(BaseModel):
    patient: Patient
    clinical: Clinical
    sanity_check: SanityCheck
    confidence: float

class NoteInput(BaseModel):
    note: str

# --- Helper to flatten LLM outputs ---
def flatten(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return ", ".join([flatten(v) for v in value])
    if isinstance(value, dict):
        return " ".join([f"{k}: {flatten(v)}" for k, v in value.items()])
    return str(value)

def clean_json_string(raw_content):
    """Extracts JSON from a string that might contain markdown or extra text."""
    # Try to find JSON block
    json_match = re.search(r'\{.*\}', raw_content, re.DOTALL)
    if json_match:
        return json_match.group(0)
    return raw_content

def repair_json(content):
    """Attempts to fix common LLM JSON formatting errors."""
    try:
        # 1. Basic cleanup
        content = content.strip()
        
        # 2. Handle single quotes used as double quotes for keys/values
        # This is tricky because single quotes can be inside values.
        # We only replace single quotes that look like they are surrounding keys or values.
        # Replace 'key': with "key":
        content = re.sub(r"\'(\w+)\'\s*:", r'"\1":', content)
        # Replace : 'value' with : "value"
        content = re.sub(r":\s*\'(.*?)\'(\s*[,\}])", r': "\1"\2', content)
        
        # 3. Handle unquoted keys
        content = re.sub(r"([{,]\s*)(\w+)(\s*:)", r'\1"\2"\3', content)
        
        # 4. Remove trailing commas
        content = re.sub(r',\s*([\]\}])', r'\1', content)
        
        # 5. Remove control characters and newlines inside the JSON structure
        # (but keep them if they are escaped)
        content = content.replace('\n', ' ').replace('\r', ' ')
        
        return content
    except Exception:
        return content

def fallback_extraction(note, raw_ai_output=""):
    """Last resort: Use regex to extract basic info if JSON parsing fails."""
    print("Executing fallback extraction logic...")
    
    # Try to find age
    age_match = re.search(r'(\d{1,3})\s*(?:year|yo|age)', note, re.IGNORECASE)
    age = int(age_match.group(1)) if age_match else 0
    
    # Try to find gender
    gender = "unknown"
    if re.search(r'\bmale\b|\bman\b|\bgentleman\b', note, re.IGNORECASE):
        gender = "male"
    elif re.search(r'\bfemale\b|\bwoman\b|\blady\b', note, re.IGNORECASE):
        gender = "female"
        
    # Try to find diagnosis in the AI output if possible, otherwise from note
    diag = "Unknown"
    diag_match = re.search(r'diagnosis["\s:]+([^",\]\}]+)', raw_ai_output, re.IGNORECASE)
    if diag_match:
        diag = diag_match.group(1).strip()
    else:
        # Simple heuristic from note
        if "diabetes" in note.lower(): diag = "Diabetes"
        elif "hypertension" in note.lower(): diag = "Hypertension"
        elif "laceration" in note.lower(): diag = "Laceration"
        
    return {
        "patient": {"age": age, "gender": gender, "history": []},
        "clinical": {
            "diagnosis": diag,
            "symptoms": ["Extracted via fallback"],
            "procedures": [],
            "suggested_icd": [],
            "suggested_cpt": []
        },
        "sanity_check": {
            "is_possible": True,
            "reasoning": "Fallback extraction used due to JSON parsing issues.",
            "reason": "Scenario is medically sound (fallback)."
        },
        "confidence": 0.3 # Low confidence for fallback
    }

# --- Logic ---
def validate_clinical_consistency(extraction: ExtractionResult):
    """Checks for impossible clinical scenarios (e.g., Male + Pregnancy)."""
    diag = flatten(extraction.clinical.diagnosis).lower()
    gender = extraction.patient.gender.lower()
    
    # Gender-specific keywords
    FEMALE_ONLY = ["pregnancy", "pregnant", "obstetric", "ovarian", "uterine", "cervical", "menstrual", "ectopic"]
    MALE_ONLY = ["prostate", "testicular", "scrotal", "penile", "prostatic"]
    
    if gender == "male" or gender == "m":
        for word in FEMALE_ONLY:
            if word in diag:
                return False, f"Clinical inconsistency: Male patient with {word}-related diagnosis."
    
    if gender == "female" or gender == "f":
        for word in MALE_ONLY:
            if word in diag:
                return False, f"Clinical inconsistency: Female patient with {word}-related diagnosis."
                
    return True, ""

def map_to_codes(extraction: ExtractionResult):
    assigned_icd = []
    assigned_cpt = []
    audit = []
    
    # 1. Start with AI Suggestions (The "Scalable" part)
    if extraction.clinical.suggested_icd:
        assigned_icd.extend([flatten(i) for i in extraction.clinical.suggested_icd])
        audit.append(f"AI suggested ICD-10: {', '.join(assigned_icd)}")
        
    if extraction.clinical.suggested_cpt:
        assigned_cpt.extend([flatten(c) for c in extraction.clinical.suggested_cpt])
        audit.append(f"AI suggested CPT: {', '.join(assigned_cpt)}")

    # 2. Apply Deterministic "Golden Rules" (Overrides AI if matched)
    diag = flatten(extraction.clinical.diagnosis).lower()
    history = [flatten(h).lower() for h in extraction.patient.history]
    symptoms = [flatten(s).lower() for s in extraction.clinical.symptoms]
    
    risk_level = "Low"
    if "diabetes" in diag or any("diabetes" in h for h in history):
        risk_level = "Medium"
        if "ulcer" in diag or any("ulcer" in s for s in symptoms):
            # Override with specific high-risk code
            if "E11.621" not in assigned_icd:
                assigned_icd.append("E11.621")
                audit.append("Rule Match: Overrode with E11.621 (Diabetes + Ulcer).")
            risk_level = "High"
        elif "E11.9" not in assigned_icd:
            assigned_icd.append("E11.9")
            audit.append("Rule Match: Added E11.9 (Diabetes).")
            
    return assigned_icd, assigned_cpt, audit, risk_level

@app.post("/analyze")
async def analyze_note(input: NoteInput):
    print(f"--- Received analysis request ---")
    
    # Early detection/cleanup
    cleaned_note = input.note.strip()
    if not cleaned_note or len(cleaned_note) < 10:
        return {
            "extraction": {
                "patient": {"age": 0, "gender": "unknown", "history": []},
                "clinical": {"diagnosis": "Insufficient data", "symptoms": [], "procedures": []},
                "sanity_check": {"is_possible": False, "reason": "Note too short."},
                "confidence": 0.0
            },
            "decision": {
                "status": "ESCALATE",
                "reason": "Note too short for reliable analysis.",
                "riskLevel": "Low",
                "assignedIcd": [],
                "assignedCpt": [],
                "auditTrail": ["Early detection: Note length insufficient."]
            }
        }

    print(f"Note length: {len(cleaned_note)} characters")
    
    # 1. Extraction using Ollama (Llama3.1)
    prompt = f"""
    You are a Senior Medical Auditor and Fraud Detection Specialist.
    Your goal is to extract data AND identify clinical impossibilities or fraudulent claims.
    
    TASK:
    1. Extract the clinical data.
    2. Map the diagnosis to the most specific ICD-10-CM code(s).
    3. Map the procedures to the most appropriate CPT code(s).
    4. Perform a "Clinical Alignment Audit". 
       - Is the procedure (e.g. Angioplasty) medically indicated for the diagnosis (e.g. Headache)?
       - Is the age/gender appropriate for the condition?
       - Are the symptoms consistent with the diagnosis?
    
    BE HIGHLY SKEPTICAL. If a minor symptom leads to a major invasive procedure without clear justification, flag it as impossible.

    JSON STRUCTURE:
    {{
      "patient": {{
        "age": number,
        "gender": "male" | "female" | "unknown",
        "history": ["string"]
      }},
      "clinical": {{
        "diagnosis": "string",
        "symptoms": ["string"],
        "procedures": ["string"],
        "suggested_icd": ["ICD-10 codes"],
        "suggested_cpt": ["CPT codes"]
      }},
      "sanity_check": {{
        "reasoning": "Step-by-step medical reasoning about the alignment of diagnosis, symptoms, and procedures.",
        "is_possible": boolean,
        "reason": "Final summary of the inconsistency or 'Scenario is medically sound'."
      }},
      "confidence": number (0.0 to 1.0)
    }}

    CLINICAL NOTE:
    "{cleaned_note}"
    
    Return ONLY valid JSON.
    """
    
    try:
        print("Calling Ollama (Llama 3.1)...")
        response = ollama.chat(model='llama3.1', messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        raw_content = response['message']['content']
        print(f"Raw Output (first 200): {raw_content[:200]}...")
        
        # Robust JSON extraction and repair
        json_content = clean_json_string(raw_content)
        
        data = None
        try:
            data = json.loads(json_content)
        except json.JSONDecodeError:
            print("Initial JSON parse failed. Attempting repair...")
            repaired_content = repair_json(json_content)
            try:
                data = json.loads(repaired_content)
                print("JSON repair successful.")
            except json.JSONDecodeError as je:
                print(f"Repair failed: {str(je)}")
                # Final fallback: Regex extraction
                data = fallback_extraction(cleaned_note, raw_content)
                print("Used fallback regex extraction.")

        # Ensure all required fields exist in data to prevent Pydantic errors
        if not data:
            data = fallback_extraction(cleaned_note, "No data extracted")
            
        if "patient" not in data: data["patient"] = {"age": 0, "gender": "unknown", "history": []}
        if "clinical" not in data: data["clinical"] = {"diagnosis": "Unknown", "symptoms": [], "procedures": []}
        if "sanity_check" not in data: data["sanity_check"] = {"is_possible": True, "reasoning": "N/A", "reason": "N/A"}
        if "confidence" not in data: data["confidence"] = 0.5

        extraction = ExtractionResult(**data)
        
        # 2. Deterministic Mapping & Decision
        icd, cpt, audit, risk_level = map_to_codes(extraction)
        
        # 3. Scalable Decision Logic
        # Priority 1: Missing Data
        is_missing_data = not extraction.clinical.diagnosis or flatten(extraction.clinical.diagnosis).lower() in ["unknown", "insufficient data", "none"]
        
        # Priority 2: Rule Violation (AI Sanity Check)
        is_possible = extraction.sanity_check.is_possible
        if isinstance(is_possible, str):
            is_possible = is_possible.lower() == "true"
            
        # Decision Tree
        if is_missing_data:
            status = "REJECT"
            reason = "Missing critical clinical data for extraction."
        elif not is_possible:
            status = "REJECT"
            reason = f"Clinical Rule Violation: {flatten(extraction.sanity_check.reason)}"
        elif extraction.confidence < 0.7:
            status = "ESCALATE"
            reason = "Low AI confidence score."
        elif risk_level == "High":
            status = "ESCALATE"
            reason = "High clinical risk detected (requires human audit)."
        else:
            status = "APPROVE"
            reason = "Automated clinical rules satisfied."
        
        return {
            "extraction": extraction,
            "decision": {
                "status": status,
                "reason": reason,
                "riskLevel": risk_level,
                "assignedIcd": icd,
                "assignedCpt": cpt,
                "auditTrail": audit
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
