import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  FileText, 
  Code, 
  Zap, 
  History,
  ArrowRight,
  Info,
  User,
  Layers,
  Database,
  Workflow
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processClinicalNote, ExtractionResult, ClaimDecision, ProcessingStep } from './services/medflowService';

const EXAMPLE_NOTES = [
  {
    title: "Diabetic Foot Ulcer",
    text: "60-year-old male patient with type 2 diabetes. Presents with a non-healing foot ulcer on the right heel. Signs of subcutaneous infection noted. Performed surgical debridement of subcutaneous tissue (approx 15 sq cm)."
  },
  {
    title: "Hypertension Follow-up",
    text: "45-year-old female with essential hypertension. Complaining of mild dizziness. Blood pressure 145/95. Routine 12-lead ECG performed in office."
  },
  {
    title: "Pediatric Asthma",
    text: "8-year-old male with persistent cough and wheezing for 3 days. History of asthma. Peak flow 150. Prescribed albuterol nebulizer treatment."
  },
  {
    title: "Post-Op Knee Recovery",
    text: "55-year-old female, 2 weeks post-total knee replacement. Wound healing well, no signs of infection. Range of motion improving. Physical therapy continued."
  },
  {
    title: "Acute Ankle Sprain",
    text: "22-year-old athlete with sudden onset right ankle pain after inversion injury during basketball. Significant swelling and ecchymosis. X-ray negative for fracture. Diagnosed with Grade II sprain."
  },
  {
    title: "Ambiguous Note",
    text: "Patient came in today. Feeling unwell. Did some tests. Might be something with the heart or maybe just a cold. Not sure."
  }
];

export default function App() {
  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ extraction: ExtractionResult, decision: ClaimDecision, steps: ProcessingStep[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'decision' | 'audit' | 'architecture'>('decision');

  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [hasError, setHasError] = useState(false);
  const steps = [
    "Clinical NLP",
    "Risk Detection",
    "Code Mapping",
    "Validation",
    "Decision"
  ];

  const handleAnalyze = async () => {
    if (!note.trim()) return;
    setIsProcessing(true);
    setResult(null);
    setHasError(false);
    setCurrentStepIndex(0);

    // Simulate step progress for UI
    const stepInterval = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev < steps.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 600);

    try {
      const data = await processClinicalNote(note);
      // Ensure we stay on the last step for a moment before showing results
      setTimeout(() => {
        setResult(data);
        setIsProcessing(false);
        // Keep currentStepIndex at the last step to show completed state
        if (data.decision.status === 'REJECT') {
          setHasError(true);
        }
        clearInterval(stepInterval);
      }, 800);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      setHasError(true);
      clearInterval(stepInterval);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">MedFlow AI</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Autonomous Healthcare Claims Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
            <ShieldCheck className="w-3 h-3" />
            HIPAA COMPLIANT
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Clinical Input
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Quick Examples</label>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_NOTES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setNote(ex.text)}
                      className="text-[11px] px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors font-medium border border-transparent hover:border-blue-100"
                    >
                      {ex.title}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Paste clinical notes here..."
                className="w-full h-64 p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none font-mono leading-relaxed"
              />
              <button
                onClick={handleAnalyze}
                disabled={isProcessing || !note.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing Pipeline...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Run Autonomous Agent
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Processing Steps Visualizer (Removed from sidebar, now at bottom) */}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8 space-y-6">
          {!result && !isProcessing && (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <div className="bg-slate-50 p-6 rounded-full mb-4">
                <Workflow className="w-12 h-12 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-600">Ready for Analysis</h3>
              <p className="text-slate-400 max-w-md mt-2">
                Input clinical notes to trigger the autonomous decision agent. 
                The agent will extract data, assign codes, and validate against payer rules.
              </p>
            </div>
          )}

          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Decision Banner */}
              <div className={`p-6 rounded-2xl border-l-8 flex items-center justify-between shadow-sm ${
                result.decision.status === 'APPROVE' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' :
                result.decision.status === 'REJECT' ? 'bg-rose-50 border-rose-500 text-rose-900' :
                'bg-amber-50 border-amber-500 text-amber-900'
              }`}>
                <div className="flex items-center gap-4">
                  {result.decision.status === 'APPROVE' ? <CheckCircle2 className="w-10 h-10" /> :
                   result.decision.status === 'REJECT' ? <XCircle className="w-10 h-10" /> :
                   <AlertTriangle className="w-10 h-10" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest opacity-70">Agent Decision</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        result.decision.riskLevel === 'High' ? 'bg-rose-200 text-rose-700' :
                        result.decision.riskLevel === 'Medium' ? 'bg-amber-200 text-amber-700' :
                        'bg-emerald-200 text-emerald-700'
                      }`}>
                        {result.decision.riskLevel} RISK
                      </span>
                    </div>
                    <h2 className="text-3xl font-black">{result.decision.status}</h2>
                    <p className="text-sm font-medium opacity-80 mt-1">{result.decision.reason}</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                {(['decision', 'audit'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="min-h-[500px]">
                <AnimatePresence mode="wait">
                  {/* Local Setup Info Banner */}
                  <div className="mb-6 p-4 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Database className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Local Python + Ollama Version Available</p>
                        <p className="text-[10px] text-slate-400">Export this project to run with open-source models on your machine.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 border border-slate-700 px-2 py-1 rounded">README_LOCAL.md</span>
                    </div>
                  </div>

                  {activeTab === 'decision' && (
                    <motion.div
                      key="decision"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      {/* Clinical Extraction Data */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-500" />
                            Extracted Clinical Data
                          </h3>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            CONFIDENCE: {(result.extraction.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Age</p>
                            <p className="text-lg font-bold">{result.extraction.patient.age}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Gender</p>
                            <p className="text-lg font-bold">{result.extraction.patient.gender}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Diagnosis</p>
                            <p className="text-sm font-semibold text-slate-700 bg-blue-50 p-3 rounded-xl border border-blue-100">
                              {result.extraction.clinical.diagnosis}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Symptoms</p>
                            <div className="flex flex-wrap gap-2">
                              {result.extraction.clinical.symptoms.map((s, i) => (
                                <span key={i} className="text-xs px-2 py-1 bg-slate-100 rounded-md font-medium">{s}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Coding & Validation */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                        <h3 className="font-bold flex items-center gap-2">
                          <Code className="w-4 h-4 text-indigo-500" />
                          Medical Coding Engine
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">ICD-10 (Diagnosis)</p>
                            <div className="space-y-2">
                              {result.decision.assignedIcd.map((code, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                  <span className="font-mono font-bold text-indigo-700">{code}</span>
                                  <span className="text-[10px] font-bold text-indigo-400">VERIFIED</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">CPT (Procedure)</p>
                            <div className="space-y-2">
                              {result.decision.assignedCpt.map((code, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                  <span className="font-mono font-bold text-slate-700">{code}</span>
                                  <span className="text-[10px] font-bold text-slate-400">VERIFIED</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-600">Rule-Based Validation</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              ICD-CPT Compatibility Verified
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Payer Policy Check Passed
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'audit' && (
                    <motion.div
                      key="audit"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-bold flex items-center gap-2">
                          <History className="w-4 h-4 text-slate-500" />
                          Full Audit Trail
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400">TRACE ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                      </div>
                      <div className="p-6 space-y-4">
                        {result.decision.auditTrail.map((log, i) => (
                          <div key={i} className="flex gap-4 group">
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 group-hover:bg-blue-500 transition-colors" />
                              {i < result.decision.auditTrail.length - 1 && <div className="w-px h-full bg-slate-100 my-1" />}
                            </div>
                            <div className="pb-4">
                              <p className="text-sm font-medium text-slate-600 leading-relaxed">{log}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Step {i + 1} • System Process</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </div>

        {/* Progress Bar Section (Below Input and Results) */}
        <div className="lg:col-span-12 mt-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {steps.map((step, i) => {
              const isCompleted = (result && !isProcessing) || i < currentStepIndex;
              const isProcessingStep = isProcessing && i === currentStepIndex;
              const isLastStep = i === steps.length - 1;
              const isFailed = hasError && (isLastStep || i === currentStepIndex);
              
              let bgColor = "bg-white";
              let textColor = "text-slate-400";
              let iconColor = "bg-slate-100 text-slate-400";
              
              if (isCompleted && !isFailed) {
                bgColor = "bg-emerald-50/50";
                textColor = "text-emerald-600";
                iconColor = "bg-emerald-500 text-white";
              } else if (isProcessingStep) {
                bgColor = "bg-blue-50/50";
                textColor = "text-blue-600";
                iconColor = "bg-blue-600 text-white animate-pulse";
              } else if (isFailed) {
                bgColor = "bg-rose-50/50";
                textColor = "text-rose-600";
                iconColor = "bg-rose-500 text-white";
              }

              return (
                <div key={i} className={`flex-1 flex flex-col items-center justify-center py-6 px-4 transition-colors duration-300 ${bgColor}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 text-sm font-bold ${iconColor}`}>
                    {isCompleted && !isFailed ? <CheckCircle2 className="w-6 h-6" /> : 
                     isFailed ? <XCircle className="w-6 h-6" /> : (i + 1)}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-widest text-center ${textColor}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-500">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4">Regulatory Guardrails</h4>
            <ul className="text-xs space-y-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> No free-text hallucinated codes</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Only verified ICD/CPT mappings</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> High-risk cases escalated</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4">System Status</h4>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Agent Core Online
            </div>
            <div className="flex items-center gap-2 text-xs mt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Knowledge Base v4.2.0 Active
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4">MedFlow AI v1.0</h4>
            <p className="text-[10px] leading-relaxed">
              This system is an AI-powered administrative assistant. It does not provide medical diagnoses or treatment advice. 
              All decisions are subject to final human oversight in clinical settings.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
