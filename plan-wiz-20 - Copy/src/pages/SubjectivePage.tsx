import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom"; // Removed useParams
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, RefreshCw, UploadCloud, CheckCircle, AlertTriangle, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from "@/lib/utils";

// --- Interfaces ---
// Removed plan-related interfaces
interface GeneratedQuestion {
  question: string;
  marks: number;
  type?: 'faq' | 'equation' | 'concept';
}
interface EvaluationResult {
  question: string;
  answer: string;
  feedback: string;
  rating: number;
  justification: string;
}

// --- PDF Worker Setup ---
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker;

// --- Duolingo Style Button Component ---
const DuoButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'green' | 'blue' | 'red' | 'gray' | 'orange'; icon?: React.ElementType; size?: 'default' | 'small' }> = ({ className, variant = 'blue', size = 'default', children, icon: Icon, ...props }) => {
    const baseStyle = "w-full flex items-center justify-center gap-2 rounded-2xl font-extrabold uppercase border-b-[5px] transition-all duration-150 ease-out transform active:translate-y-[2px] active:border-b-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105";
    const sizeStyles = {
        default: "py-3 px-4 text-base",
        small: "py-2 px-3 text-sm border-b-[4px] active:border-b-[2px]",
    };
    const variantStyles = {
        green: "bg-[#58cc02] border-[#58a700] text-white focus-visible:ring-[#58cc02]",
        blue: "bg-[#1cb0f6] border-[#1899d6] text-white focus-visible:ring-[#1cb0f6]",
        red: "bg-[#ff4b4b] border-[#ea2b2b] text-white focus-visible:ring-[#ff4b4b]",
        gray: "bg-[#e5e5e5] border-[#b2b2b2] text-[#777777] hover:bg-[#f2f2f2] focus-visible:ring-[#b2b2b2]",
        orange: "bg-orange-500 border-orange-700 text-white focus-visible:ring-orange-500"
    };
    return (
        <button className={cn(baseStyle, sizeStyles[size], variantStyles[variant], className)} {...props}>
            {Icon && <Icon className="h-5 w-5" />}
            <span>{children}</span>
        </button>
    );
};


const SubjectivePage = () => {
    // const { planId } = useParams(); // Removed
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State ---
    // const [plan, setPlan] = useState<ExamPlan | null>(null); // Removed
    const [subjectiveMarks, setSubjectiveMarks] = useState<number>(5); // Keep default
    const [isLoading, setIsLoading] = useState(false);
    const [loaderText, setLoaderText] = useState("Loading...");
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [currentSection, setCurrentSection] = useState<'upload' | 'test' | 'results'>('upload');
    const [subjectMaterial, setSubjectMaterial] = useState('');
    const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([]);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [askedQuestionsHistory, setAskedQuestionsHistory] = useState<string[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    // --- API Config ---
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    // --- Load Plan (Removed) ---
    // useEffect(() => { ... }, [planId, navigate]); // Removed

    // --- Helpers ---
    async function getTextFromPdf(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = async (e) => { if (!e.target?.result) { return reject(new Error("Failed to read file.")); } try { const data = new Uint8Array(e.target.result as ArrayBuffer); const pdf = await pdfjsLib.getDocument({ data }).promise; let fullText = ''; for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const textContent = await page.getTextContent(); fullText += textContent.items.map(item => (item as any).str).join(' ') + '\n'; } resolve(fullText); } catch (error) { console.error("Error parsing PDF:", error); reject(new Error("Could not read the PDF.")); } }; reader.onerror = () => reject(new Error("Failed to read the file.")); reader.readAsArrayBuffer(file); }); }
    function cleanJsonResponse(text: string): string { const firstBracket = text.indexOf('{'); const lastBracket = text.lastIndexOf('}'); if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) { return text.substring(firstBracket, lastBracket + 1); } const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/); if (jsonMatch && jsonMatch[1]) { return jsonMatch[1].trim(); } return text.trim(); }
    async function callGemini(prompt: string, systemInstruction: string): Promise<string> { const payload = { contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] }, generationConfig: { responseMimeType: "application/json" } }; try { const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) { let errorBody; try { errorBody = await response.json(); } catch (e) { errorBody = { error: { message: `HTTP Error: ${response.status} ${response.statusText}` } }; } console.error("API Error Response:", errorBody); throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody.error?.message || 'Unknown error'}`); } const result = await response.json(); console.log("API Raw Response:", result); const candidate = result.candidates?.[0]; const text = candidate?.content?.parts?.[0]?.text; if (text) { return text; } else { console.error("Invalid response structure:", result); if (candidate && typeof candidate === 'string') return candidate; if (result && typeof result === 'string') return result; throw new Error("Invalid response structure from API."); } } catch (error) { console.error("Gemini API call failed:", error); throw error; } }
    function showLoader(text: string) { setLoaderText(text); setIsLoading(true); }
    function hideLoader() { setIsLoading(false); }
    function showError(message: string) { setErrorMessage(message || "An unknown error occurred."); setShowErrorModal(true); toast.error(message || "An unknown error occurred."); }
    function hideError() { setShowErrorModal(false); }
    function switchSection(section: 'upload' | 'test' | 'results') { setCurrentSection(section); window.scrollTo(0, 0); }
    function getRatingStyle(rating: number): { bg: string; border: string; text: string; icon: React.ElementType } {
        if (rating >= 8) return { bg: 'bg-green-100', border: 'border-[#78c800]', text: 'text-[#58a700]', icon: CheckCircle };
        if (rating >= 5) return { bg: 'bg-yellow-100', border: 'border-[#ffc800]', text: 'text-[#ce8200]', icon: AlertTriangle };
        return { bg: 'bg-red-100', border: 'border-[#ff4b4b]', text: 'text-[#ea2b2b]', icon: AlertTriangle };
    }

    // --- Main Logic ---
    async function generateQuestions(isMoreQuestionsRequest = false) {
        let materialToUse = subjectMaterial; if (!isMoreQuestionsRequest) { const pdfFile = fileInputRef.current?.files?.[0]; const textMaterialValue = subjectMaterial.trim(); try { if (pdfFile) { showLoader('Reading PDF...'); materialToUse = await getTextFromPdf(pdfFile); setSubjectMaterial(materialToUse); } else if (textMaterialValue.length > 0) { materialToUse = textMaterialValue; } else { showError("Please provide material."); return; } } catch (pdfError: any) { showError(`Failed to read PDF: ${pdfError.message}`); hideLoader(); return; } setAskedQuestionsHistory([]); } else if (!materialToUse) { showError("No material found."); return; } if (materialToUse.length < 50) { showError("Material too short."); hideLoader(); return; }

        showLoader(isMoreQuestionsRequest ? 'Generating new questions...' : 'Generating key questions...');
        
        // Simplified prompts without plan context
        const systemInstruction = `You are an AI tutor. Your goal is to create practice questions focusing on common points of confusion (FAQs) and important equations/formulas from the provided material.`;
        const historyContext = isMoreQuestionsRequest && askedQuestionsHistory.length > 0 ? `\n\nAVOID questions similar to:\n${askedQuestionsHistory.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n` : '';
        const prompt = `Analyze the study material. Identify FAQs, key equations/formulas, and core concepts.\nStudy Material:\n---\n${materialToUse}\n---\nGenerate exactly 5 distinct subjective questions focusing on these areas. Prioritize FAQs and equations. Ensure questions require critical thinking, suit ${subjectiveMarks} marks, are clear, and differ from previous ones.${historyContext}\nOutput ONLY a valid JSON object: \`\`\`json\n{ "questions": [ { "question": "...", "marks": ${subjectiveMarks}, "type": "faq|equation|concept" }, ... ] }\`\`\` No text outside JSON.`;

        try {
            const responseText = await callGemini(prompt, systemInstruction);
            let cleanedText = responseText.trim(); if (cleanedText.startsWith("```json")) { cleanedText = cleanedText.substring(7); } if (cleanedText.endsWith("```")) { cleanedText = cleanedText.substring(0, cleanedText.length - 3); } cleanedText = cleanJsonResponse(cleanedText);
            const responseJson = JSON.parse(cleanedText);
            if (!responseJson.questions?.length || typeof responseJson.questions[0]?.question !== 'string') { throw new Error("AI returned invalid question format."); }
            if (responseJson.questions.length !== 5) { console.warn(`AI gave ${responseJson.questions.length} questions.`); }
            const newQuestions: GeneratedQuestion[] = []; const newHistoryEntries: string[] = [];
            responseJson.questions.slice(0, 5).forEach((q: any) => { if (q.question) { newQuestions.push({ question: q.question, marks: subjectiveMarks, type: q.type }); newHistoryEntries.push(q.question); } });
            if (newQuestions.length === 0) { throw new Error("No valid questions found."); }
            setAskedQuestionsHistory(prev => [...prev, ...newHistoryEntries]); setGeneratedQuestions(newQuestions); setUserAnswers(new Array(newQuestions.length).fill('')); setCurrentQuestionIndex(0); switchSection('test');
        } catch (error: any) { console.error("Error generating questions:", error); if (error instanceof SyntaxError) { showError(`Invalid AI response format. Check console.`); } else { showError(`Failed to generate questions: ${error.message}.`); } }
        finally { hideLoader(); }
    }

    const handleAnswerChange = (index: number, value: string) => { const newAnswers = [...userAnswers]; newAnswers[index] = value; setUserAnswers(newAnswers); };

    const handleNextQuestion = () => {
        const currentAnswer = userAnswers[currentQuestionIndex]?.trim();
        if (currentQuestionIndex < generatedQuestions.length - 1) {
             if (!currentAnswer) {
                 showError("Please answer the current question before proceeding.");
                 return;
             }
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
             if (!currentAnswer) {
                 showError("Please answer the final question before submitting.");
                 return;
             }
            handleSubmitAnswers();
        }
    };

    async function handleSubmitAnswers() {
        showLoader('Evaluating all answers...'); const answersWithQuestions = generatedQuestions.map((q, index) => ({ question: q.question, marks: q.marks, answer: userAnswers[index] || "" }));
        
        // Simplified prompts without plan context
        const systemInstruction = `You are an expert educator evaluating subjective answers. Provide constructive feedback based STRICTLY on the original study material. Be encouraging but accurate. Your response MUST be valid JSON.`;
        const prompt = ` Please evaluate the student's answers based ONLY on the Original Study Material provided below. Consider each question's specified marks when assessing depth. Original Study Material:\n---\n${subjectMaterial}\n---\nQuestions, Marks, and Student's Answers:\n---\n${JSON.stringify(answersWithQuestions)}\n---\nFor EACH question, provide:\n1. Detailed feedback: Strengths/weaknesses based ONLY on the study material. Suggestions for improvement. **Ensure quotes (") and special characters are JSON escaped (\\").**\n2. Numerical rating (1-10).\n3. Brief justification: One sentence explaining the rating. **Ensure quotes (") and special characters are JSON escaped (\\").**\n\nFormat response STRICTLY as a valid JSON object:\n\`\`\`json\n{"evaluation": [{"question": "...", "answer": "...", "feedback": "...", "rating": number, "justification": "..."}, ...]}\n\`\`\`\n**Crucially important: Ensure ALL string values are valid JSON strings.** Do NOT include text outside the JSON structure. `; 
        
        try { 
            const responseText = await callGemini(prompt, systemInstruction); 
            let cleanedText = responseText.trim(); if (cleanedText.startsWith("```json")) { cleanedText = cleanedText.substring(7); } if (cleanedText.endsWith("```")) { cleanedText = cleanedText.substring(0, cleanedText.length - 3); } cleanedText = cleanJsonResponse(cleanedText); 
            const responseJson = JSON.parse(cleanedText); 
            if (!responseJson.evaluation?.length || typeof responseJson.evaluation[0]?.rating !== 'number') { throw new Error("API returned invalid evaluation format."); } setEvaluationResults(responseJson.evaluation); switchSection('results'); 
        } catch (error: any) { console.error("Error evaluating:", error); if (error instanceof SyntaxError) { showError(`Invalid AI evaluation response. Check console.`); } else { showError(`Failed to evaluate: ${error.message}.`); } } 
        finally { hideLoader(); }
    }

    function startOver() { setSubjectMaterial(''); setGeneratedQuestions([]); setUserAnswers([]); setEvaluationResults([]); setAskedQuestionsHistory([]); if (fileInputRef.current) { fileInputRef.current.value = ""; } setUploadedFileName(null); setCurrentQuestionIndex(0); switchSection('upload'); }
    function handleGenerateMoreQuestions() { if (!subjectMaterial) { showError("Cannot generate more questions without study material."); return; } generateQuestions(true); }

  // --- Render Logic ---
  // Removed !plan check

  const progressValue = generatedQuestions.length > 0 ? ((currentQuestionIndex + 1) / generatedQuestions.length) * 100 : 0;
  const currentQ = generatedQuestions[currentQuestionIndex];

  const fadeInClass = "animate-fadeIn";
  const sectionTransitionClass = "transition-opacity duration-500 ease-in-out";

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#4b4b4b] font-['Nunito',_sans-serif]">
      {/* Header */}
      <header className="border-b border-[#e5e5e5] bg-white sticky top-0 z-10 shadow-sm">
            <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                {/* Updated Button */}
                <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-[#afafaf] hover:text-[#4b4b4b] hover:bg-[#e5e5e5] px-2">
                    <X className="h-6 w-6" />
                </Button>
                 <div className={`flex-grow mx-4 max-w-md transition-opacity duration-300 ${currentSection === 'test' ? 'opacity-100' : 'opacity-0'}`}>
                    {currentSection === 'test' && (
                        <>
                            <Progress value={progressValue} className="h-3 bg-[#e5e5e5] rounded-full overflow-hidden [&>div]:bg-[#58cc02] transition-transform duration-300 ease-linear" style={{ transformOrigin: 'left' }}/>
                             <p className="text-xs text-center text-[#afafaf] mt-1 font-bold">
                                 {currentQuestionIndex + 1} / {generatedQuestions.length}
                             </p>
                        </>
                    )}
                </div>
                 <div className="w-[40px]">
                 </div>
            </div>
        </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* --- Step 1: Upload Section --- */}
        <section id="upload-section" className={cn(sectionTransitionClass, currentSection !== 'upload' ? 'opacity-0 hidden' : 'opacity-100')}>
            {/* ... (rest of the upload section is the same) ... */}
            <Card className={cn("bg-white p-6 md:p-8 rounded-2xl border-2 border-[#e5e5e5] shadow-lg", fadeInClass)}>
                <CardHeader className="p-0 mb-6 text-center">
                    <FileText className="h-16 w-16 text-orange-500 mx-auto mb-3"/>
                    <h2 className="text-3xl font-extrabold mb-1 text-[#4b4b4b]">Subjective Practice</h2>
                    <p className="text-[#777777] text-base">Upload PDF or paste notes to get exam-style questions.</p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="mb-5">
                        <label htmlFor="pdf-upload" className="block text-sm font-bold text-[#4b4b4b] mb-2">Upload Study PDF</label>
                        <div className="relative">
                            <Input ref={fileInputRef} id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; setUploadedFileName(file?.name ?? null); if (file) setSubjectMaterial(''); }} />
                            <label htmlFor="pdf-upload" className="flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-dashed border-[#d3d3d3] rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                <UploadCloud className="h-8 w-8 text-[#afafaf] mb-2"/>
                                <p className="text-sm font-semibold text-[#777777] text-center">
                                    {uploadedFileName ? <span className="text-[#58a700]">Selected: {uploadedFileName}</span> : 'Click to browse or drag & drop'}
                                </p>
                                <p className="text-xs text-[#afafaf]">PDF only</p>
                            </label>
                         </div>
                    </div>
                    <div className="relative flex items-center justify-center my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e5e5e5]"></div></div><div className="relative bg-white px-4 text-sm font-bold text-[#afafaf]">OR</div></div>
                    <Textarea id="subject-material" value={subjectMaterial} onChange={(e) => { setSubjectMaterial(e.target.value); if (fileInputRef.current) fileInputRef.current.value = ""; setUploadedFileName(null); }} className="w-full h-40 p-4 border-2 border-[#d3d3d3] rounded-xl focus:ring-2 focus:ring-[#58cc02] focus:border-[#58cc02] transition-all text-base mb-6 disabled:bg-gray-100/50 disabled:cursor-not-allowed" placeholder="Paste your subject material here..." disabled={!!uploadedFileName} />
                    <DuoButton variant="blue" onClick={() => generateQuestions(false)} disabled={isLoading || (!uploadedFileName && !subjectMaterial.trim())}>Generate Key Questions</DuoButton>
                </CardContent>
            </Card>
        </section>

        {/* --- Step 2: Test Section (Single Question View) --- */}
        <section id="test-section" className={cn(sectionTransitionClass, currentSection !== 'test' ? 'opacity-0 hidden' : 'opacity-100')}>
            {/* ... (rest of the test section is the same) ... */}
            {currentQ && (
                 <div className={cn("bg-white p-6 md:p-8 rounded-2xl border-2 border-[#e5e5e5] shadow-lg", fadeInClass)}>
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-[#afafaf] uppercase tracking-wide">Question {currentQuestionIndex + 1}</h3>
                            <span className="text-sm font-bold text-[#afafaf] bg-[#e5e5e5] px-3 py-1 rounded-lg">{currentQ.marks} Marks</span>
                        </div>
                        <p className="text-lg text-[#4b4b4b] leading-relaxed font-semibold">{currentQ.question}</p>
                         {currentQ.type && <span className="text-xs font-semibold uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full mt-2 inline-block">{currentQ.type}</span>}
                    </div>
                    <div className="p-0">
                        <Textarea
                            id={`answer-${currentQuestionIndex}`}
                            value={userAnswers[currentQuestionIndex] || ''}
                            onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
                            className="w-full h-52 p-4 border-2 border-[#d3d3d3] rounded-xl focus:ring-2 focus:ring-[#58cc02] focus:border-[#58cc02] transition-all text-base mb-6 bg-gray-50/50"
                            placeholder="Type your detailed answer here..."
                        />
                         <DuoButton
                             variant="green"
                             onClick={handleNextQuestion}
                             disabled={isLoading || !userAnswers[currentQuestionIndex]?.trim()}
                         >
                             {currentQuestionIndex === generatedQuestions.length - 1 ? 'Check Answers' : 'Continue'}
                         </DuoButton>
                    </div>
                </div>
            )}
        </section>

        {/* --- Step 3: Results Section --- */}
         <section id="results-section" className={cn(sectionTransitionClass, currentSection !== 'results' ? 'opacity-0 hidden' : 'opacity-100')}>
            {/* ... (rest of the results section is the same) ... */}
            <Card className={cn("bg-white p-6 md:p-8 rounded-2xl border-2 border-[#e5e5e5] shadow-lg", fadeInClass)}>
                <CardHeader className="p-0 mb-6 text-center">
                    <CheckCircle className="h-16 w-16 text-[#58cc02] mx-auto mb-3"/>
                    <h2 className="text-3xl font-extrabold mb-1 text-[#4b4b4b]">Evaluation Complete!</h2>
                    <p className="text-[#777777] text-base">Great job! Review the feedback below.</p>
                </CardHeader>
                <CardContent className="p-0">
                    <div id="evaluation-container" className="space-y-6 mb-8">
                        {evaluationResults.map((item, index) => {
                            const style = getRatingStyle(item.rating);
                            const Icon = style.icon;
                            return (
                                <div key={index} className={cn("p-4 rounded-xl border-2", style.border, style.bg, "transition-shadow duration-300 hover:shadow-md")}>
                                     <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-grow">
                                            <p className="font-bold text-[#4b4b4b] text-base mb-1">Q{index + 1}: <span className="font-normal text-[#777777] text-sm">{item.question}</span></p>
                                        </div>
                                        <div className={cn("flex-shrink-0 text-center w-[70px] px-2 py-1 rounded-lg border", style.border, style.bg)}>
                                             <Icon className={cn("h-4 w-4 mx-auto mb-0.5", style.text)} />
                                             <span className={cn("text-lg font-extrabold", style.text)}>{item.rating}<span className="text-xs">/10</span></span>
                                        </div>
                                    </div>
                                    <div className="mb-2 bg-white/60 p-3 rounded-lg border border-[#e5e5e5]">
                                        <h4 className="font-bold text-[#4b4b4b] text-xs uppercase tracking-wider mb-1">Your Answer:</h4>
                                        <p className="text-[#777777] whitespace-pre-wrap text-sm">{item.answer || <span className="italic opacity-70">No answer provided.</span>}</p>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                                        <h4 className="font-bold text-green-800 text-xs uppercase tracking-wider mb-1">AI Feedback:</h4>
                                        <p className="text-green-900 whitespace-pre-wrap text-sm">{item.feedback}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 mt-8">
                         <DuoButton variant="blue" onClick={handleGenerateMoreQuestions} disabled={isLoading} icon={RefreshCw}> Generate More Questions </DuoButton>
                         <DuoButton variant="gray" onClick={startOver} disabled={isLoading}> Start New Material </DuoButton>
                    </div>
                </CardContent>
            </Card>
        </section>

        {/* --- Loading Spinner --- */}
        {isLoading && (
             <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 transition-opacity duration-300 ease-in-out">
                <div className="w-16 h-16 border-4 border-t-4 border-t-[#58cc02] border-[#e5e5e5] rounded-full animate-spin"></div>
                <p className="text-[#777777] text-lg font-bold mt-4 animate-pulse">{loaderText}</p>
             </div>
         )}
        {/* --- Error Modal --- */}
         {showErrorModal && (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className={cn("bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-sm w-full text-center transform scale-95 transition-transform duration-300 ease-out", fadeInClass, "scale-100")}>
                    <AlertTriangle className="h-12 w-12 text-[#ff4b4b] mx-auto mb-4"/>
                    <h3 className="text-xl font-extrabold text-[#ea2b2b] mb-3">Something went wrong!</h3>
                    <p className="text-[#777777] text-base mb-6">{errorMessage}</p>
                    <DuoButton variant="red" onClick={hideError}> Got it </DuoButton>
                </div>
             </div>
         )}
      </main>

       {/* Footer */}
        <footer className="mt-12 text-center py-6 border-t border-[#e5e5e5]">
            <p className="text-sm text-[#afafaf] font-semibold">AI Study Planner ✨</p>
        </footer>
    </div>
  );
};

export default SubjectivePage;
