from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import ollama
import json

app = FastAPI(title="MedFlow AI Backend")

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
    age: int
    gender: str
    history: List[str]

class Clinical(BaseModel):
    diagnosis: str
    symptoms: List[str]
    procedures: List[str]

class ExtractionResult(BaseModel):
    patient: Patient
    clinical: Clinical
    confidence: float

class NoteInput(BaseModel):
    note: str

# --- Logic ---
def map_to_codes(extraction: ExtractionResult):
    assigned_icd = []
    assigned_cpt = []
    audit = []
    
    diag = extraction.clinical.diagnosis.lower()
    procs = [p.lower() for p in extraction.clinical.procedures]
    
    if "diabetes" in diag:
        if "ulcer" in diag or any("ulcer" in s.lower() for s in extraction.clinical.symptoms):
            assigned_icd.append("E11.621")
            audit.append("Mapped 'Diabetes + Ulcer' to E11.621 via strict lookup.")
        else:
            assigned_icd.append("E11.9")
            audit.append("Mapped 'Diabetes' to E11.9.")
            
    if any("debridement" in p for p in procs):
        assigned_cpt.append("11042")
        audit.append("Mapped 'Debridement' to CPT 11042.")
    else:
        assigned_cpt.append("99213")
        audit.append("Defaulted to E/M 99213.")
        
    return assigned_icd, assigned_cpt, audit

@app.post("/analyze")
async def analyze_note(input: NoteInput):
    # 1. Extraction using Ollama (Llama3 or Mistral)
    prompt = f"""
    Extract clinical data from this note into JSON.
    Fields: patient (age, gender, history[]), clinical (diagnosis, symptoms[], procedures[]), confidence (0-1).
    Note: "{input.note}"
    Return ONLY valid JSON.
    """
    
    try:
        response = ollama.chat(model='llama3.1', messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        # Parse JSON from response
        raw_content = response['message']['content']
        # Simple cleanup in case of markdown blocks
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0]
        
        data = json.loads(raw_content)
        extraction = ExtractionResult(**data)
        
        # 2. Deterministic Mapping & Decision
        icd, cpt, audit = map_to_codes(extraction)
        
        # 3. Decision Logic
        status = "APPROVE"
        reason = "Rules satisfied."
        
        if extraction.confidence < 0.7:
            status = "ESCALATE"
            reason = "Low AI confidence."
        
        return {
            "extraction": extraction,
            "decision": {
                "status": status,
                "reason": reason,
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
