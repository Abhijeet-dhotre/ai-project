import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom"; // Removed useParams
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Gamepad2,
  UploadCloud,
  RotateCw,
  FileDown,
  Trash2,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from 'pdfjs-dist';
import jsPDF from "jspdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Flashcard {
  question: string;
  answer: string;
}

interface GeminiApiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
        finishReason?: string;
        safetyRatings?: any[];
    }>;
}

const FlashCardPage = () => {
  // const { planId } = useParams(); // Removed
  const navigate = useNavigate();

  const [notesInput, setNotesInput] = useState("");
  const [currentFlashcards, setCurrentFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'upload'>('text');
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewState, setViewState] = useState<'input' | 'studying'>('input');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  useEffect(() => {
    loadFromLocalStorage();
  }, []); // Removed planId dependency

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  // Changed to a global storage key
  const getStorageKey = () => `ai-flashcards-global`;

  const loadFromLocalStorage = () => {
    const savedCards = localStorage.getItem(getStorageKey());
    if (savedCards) {
      try {
        const parsedCards = JSON.parse(savedCards);
        if (Array.isArray(parsedCards) && parsedCards.length > 0) {
          setCurrentFlashcards(parsedCards);
          setCurrentIndex(0);
          setViewState('studying');
          toast.info(`Loaded ${parsedCards.length} saved flashcards.`);
        } else {
            setViewState('input');
        }
      } catch (error) {
        console.error("Failed to parse flashcards from localStorage:", error);
        localStorage.removeItem(getStorageKey());
        setViewState('input');
      }
    } else {
         setViewState('input');
    }
  };

  const saveToLocalStorage = (cards: Flashcard[]) => {
    localStorage.setItem(getStorageKey(), JSON.stringify(cards));
  }

  // ... (handleTextChange and handleFileUpload methods remain the same) ...
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotesInput(e.target.value);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a valid PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setIsLoadingPdf(true);
    toast.info('Extracting text from PDF...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        setNotesInput(fullText);
        toast.success('Text extracted! Ready to generate flashcards.');
        setActiveTab('text');
      } catch (error: any) {
        console.error('Error parsing PDF:', error);
        toast.error(`PDF Error: ${error.message || 'Failed to extract text.'}`);
      } finally {
        setIsLoadingPdf(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.onerror = () => {
      toast.error('Error reading file.');
      setIsLoadingPdf(false);
    }
    reader.readAsArrayBuffer(file);
  };

   const callGeminiAPI = async (payload: any, retries = 3, delay = 1000): Promise<Flashcard[] | null> => {
       if (!apiKey) {
            throw new Error("API Key is missing. Please configure VITE_GEMINI_API_KEY in your .env file.");
       }
       for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

             const responseBodyText = await response.text();

            if (!response.ok) {
                 console.error("API Error Response:", response.status, responseBodyText);
                 throw new Error(`API error! Status: ${response.status}. ${responseBodyText.substring(0, 100)}`);
            }

             let result: GeminiApiResponse;
             try {
                 result = JSON.parse(responseBodyText);
             } catch (jsonError) {
                 console.error("Failed to parse API JSON response:", jsonError, "\nRaw Response:", responseBodyText);
                 throw new Error("Invalid JSON received from API.");
             }

            const candidate = result.candidates?.[0];
            const textContent = candidate?.content?.parts?.[0]?.text;

            if (textContent) {
                 try {
                     const parsedJson = JSON.parse(textContent);
                     if (Array.isArray(parsedJson.flashcards)) {
                         if (parsedJson.flashcards.every((card: any) => typeof card.question === 'string' && typeof card.answer === 'string')) {
                            return parsedJson.flashcards;
                         } else {
                            throw new Error("Invalid flashcard structure in JSON response.");
                         }
                     } else {
                         throw new Error("Invalid response format: 'flashcards' array not found.");
                     }
                 } catch (parseError) {
                     console.warn("Could not parse API response as JSON, attempting text fallback:", parseError, "\nRaw Text:", textContent);
                     const fallbackCards = parseFlashcardsFromText(textContent);
                     if (fallbackCards.length > 0) {
                         return fallbackCards;
                     }
                     throw new Error("Failed to parse JSON response from API and fallback failed.");
                 }
            } else if (candidate?.finishReason === "SAFETY") {
                 throw new Error("Generation blocked by safety filters. Adjust input or safety settings.");
            } else if (candidate?.finishReason) {
                throw new Error(`Generation stopped: ${candidate.finishReason}. Check API limits or prompt.`);
            }
             else {
                  throw new Error("Invalid or empty response structure from API.");
            }
        } catch (error: any) {
            console.error(`API Call Attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
             toast.warning(`API call failed (Attempt ${i + 1}). Retrying...`);
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
      }
      return null;
    };

    const parseFlashcardsFromText = (text: string): Flashcard[] => {
        const cards: Flashcard[] = [];
        const regex = /^\s*(?:Q:|Question:)\s*([\s\S]+?)\s*(?:A:|Answer:)\s*([\s\S]+?)(?=\s*(?:Q:|Question:|$))/gim;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const question = match[1].trim();
            const answer = match[2].trim();
            if (question && answer) {
                cards.push({ question, answer });
            }
        }
        return cards;
    };


  const handleFlashcardGeneration = async () => {
    // ... (rest of the function is the same, no planId used) ...
    const userInput = notesInput.trim();
    if (!userInput) {
      toast.error('Please enter text, paste notes, or upload a PDF.');
      return;
    }
     if (!apiKey) {
         toast.error("API Key not set. Please add VITE_GEMINI_API_KEY to your .env file.");
         return;
     }

    setIsLoading(true);
    setCurrentFlashcards([]);
    setCurrentIndex(0);
    setViewState('input');
    toast.info('Generating your flashcards with AI... ✨');

     const systemPrompt = "You are an expert learning assistant. Create high-quality flashcards (question/answer pairs) from the provided text. Focus on key concepts, definitions, and facts. Ensure questions are clear and answers are concise and accurate. Format the output strictly as a JSON object containing a single key 'flashcards', which is an array of objects, each with 'question' and 'answer' string properties.";
     const userQuery = `Generate flashcards for the following text:\n\n---\n${userInput}\n---`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
        }
    };

    try {
      const flashcards = await callGeminiAPI(payload);
      if (flashcards && flashcards.length > 0) {
        setCurrentFlashcards(flashcards);
        saveToLocalStorage(flashcards);
        setViewState('studying');
        toast.success(`Generated ${flashcards.length} flashcards! 🎉`);
      } else {
         toast.error('AI could not generate flashcards. Try different text or phrasing.');
         setViewState('input');
      }
    } catch (error: any) {
      console.error("Flashcard generation failed:", error);
      toast.error(`Error: ${error.message || 'Failed to generate flashcards.'}`);
       setViewState('input');
    } finally {
      setIsLoading(false);
    }
  };


   const sanitizeHTML = (str: string): string => {
        if (!str) return '';
        let sanitized = str.replace(/&/g, "&amp;")
                           .replace(/</g, "&lt;")
                           .replace(/>/g, "&gt;")
                           .replace(/"/g, "&quot;")
                           .replace(/'/g, "&#039;");
        return sanitized.replace(/\n/g, '<br>');
    };

   const exportFlashcards = () => {
        // ... (rest of the function is the same, no planId used) ...
        if (currentFlashcards.length === 0) {
            toast.error('No flashcards to export.');
            return;
        }

        try {
            const doc = new jsPDF();
            const margin = 15;
            const cardWidth = doc.internal.pageSize.getWidth() - margin * 2;
            const cardHeight = 55;
            const pageHeight = doc.internal.pageSize.getHeight();
            let y = margin;

            currentFlashcards.forEach((card, index) => {
                if (y + (cardHeight * 2) + 20 > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }

                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text(`Flashcard ${index + 1} - Question`, margin, y);
                doc.setDrawColor(220);
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin, y + 5, cardWidth, cardHeight, 3, 3, 'FD');
                doc.setFontSize(12);
                doc.setTextColor(50);
                const questionLines = doc.splitTextToSize(card.question, cardWidth - 10);
                doc.text(questionLines, margin + 5, y + 15);
                y += cardHeight + 10;

                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text(`Flashcard ${index + 1} - Answer`, margin, y);
                doc.setFillColor(79, 70, 229);
                doc.setDrawColor(79, 70, 229);
                doc.roundedRect(margin, y + 5, cardWidth, cardHeight, 3, 3, 'FD');
                doc.setFontSize(12);
                doc.setTextColor(255);
                const answerLines = doc.splitTextToSize(card.answer, cardWidth - 10);
                doc.text(answerLines, margin + 5, y + 15);
                y += cardHeight + 15;
            });

            doc.save('flashcards.pdf');
            toast.success('Flashcards exported to PDF! 📄');
        } catch (error: any) {
             console.error("PDF Export Error:", error);
             toast.error(`Failed to export PDF: ${error.message}`);
        }
    };

    const clearLocalStorage = () => {
        localStorage.removeItem(getStorageKey());
        setCurrentFlashcards([]);
        setCurrentIndex(0);
        setNotesInput('');
        setViewState('input');
        toast.info('Saved flashcards cleared.');
    };

     // ... (showPrevCard, showNextCard, showInputView functions are the same) ...
     const showPrevCard = () => {
        if (currentIndex > 0) {
             setCurrentIndex(prev => prev - 1);
        }
    };

    const showNextCard = () => {
         if (currentIndex < currentFlashcards.length - 1) {
            setCurrentIndex(prev => prev + 1);
         }
    };

     const showInputView = () => {
        setViewState('input');
     }

   // ... (renderStudyViewContent and renderInputViewContent functions are the same) ...
      const renderStudyViewContent = () => {
        if (currentFlashcards.length === 0) {
            return <p className="text-center text-gray-500">No flashcards available.</p>;
        }
        const cardData = currentFlashcards[currentIndex];
        return (
             <>
                <Card className="shadow-lg border-2 border-indigo-100 mb-6 overflow-hidden min-h-[360px] flex flex-col">
                     <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 text-center">
                         <CardTitle className="text-xl">Flashcard Study</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-grow flex items-center justify-center">
                        <div className="flashcard-container h-80 w-full max-w-lg mx-auto p-4">
                            <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                                <div className="flashcard-face flashcard-front text-center">
                                    <p className="text-xl font-semibold" dangerouslySetInnerHTML={{ __html: sanitizeHTML(cardData?.question || '...') }}></p>
                                </div>
                                <div className="flashcard-face flashcard-back text-center">
                                     <p className="text-lg" dangerouslySetInnerHTML={{ __html: sanitizeHTML(cardData?.answer || '...') }}></p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                     <CardFooter className="flex items-center justify-between p-4 bg-gray-50 border-t">
                            <Button variant="outline" size="icon" onClick={showPrevCard} disabled={currentIndex === 0} className="nav-btn rounded-full shadow hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                                <ArrowLeftIcon className="h-5 w-5" />
                            </Button>
                            <div className="font-semibold text-lg text-gray-700">
                                {currentIndex + 1} / {currentFlashcards.length}
                            </div>
                            <Button variant="outline" size="icon" onClick={showNextCard} disabled={currentIndex === currentFlashcards.length - 1} className="nav-btn rounded-full shadow hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                                <ArrowRight className="h-5 w-5" />
                            </Button>
                     </CardFooter>
                </Card>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                     <Button onClick={showInputView} variant="secondary">
                         <RotateCw className="mr-2 h-4 w-4" /> Create New Set
                     </Button>
                     <Button onClick={exportFlashcards} variant="outline">
                          <FileDown className="mr-2 h-4 w-4" /> Export to PDF
                     </Button>
                     <Button onClick={clearLocalStorage} variant="destructive">
                         <Trash2 className="mr-2 h-4 w-4" /> Clear Saved
                     </Button>
                </div>
            </>
        );
   }

   const renderInputViewContent = () => (
        <>
          <header id="header-section" className="text-center mb-8">
             <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4 mx-auto shadow-lg">
                  <Gamepad2 className="h-8 w-8 text-white" />
             </div>
             <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">AI Flashcard Game</h1>
             <p className="mt-3 text-lg text-gray-600">Generate, study, and export flashcards from your notes.</p>
         </header>

         <Card id="input-section" className="shadow-md mb-8">
             <CardHeader className="border-b p-0">
                 <div className="flex px-4 pt-2">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`px-4 py-3 font-semibold transition-colors duration-200 ${activeTab === 'text' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}`}
                    >
                       Enter Text
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`px-4 py-3 font-semibold transition-colors duration-200 ${activeTab === 'upload' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}`}
                    >
                       Upload PDF
                    </button>
                </div>
             </CardHeader>
             <CardContent className="p-6">
                <div className={activeTab === 'text' ? '' : 'hidden'}>
                    <div className="flex justify-between items-center mb-2">
                        <Label htmlFor="notes-input" className="text-base font-medium text-gray-700">Enter topic or paste notes:</Label>
                        <Button variant="link" size="sm" onClick={() => setNotesInput('')} className="text-indigo-600 px-1 h-auto">Clear</Button>
                    </div>
                    <Textarea
                        id="notes-input"
                        rows={8}
                        value={notesInput}
                        onChange={handleTextChange}
                        placeholder="e.g., 'Key concepts of Photosynthesis' or paste study notes..."
                        className="transition focus:ring-2 focus:ring-indigo-300"
                        disabled={isLoadingPdf}
                    />
                 </div>

                <div className={activeTab === 'upload' ? '' : 'hidden'}>
                     <Label htmlFor="file-upload-input" className="block text-base font-medium text-gray-700 mb-2">Upload notes (PDF only):</Label>
                     <div className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 ${isLoadingPdf ? 'border-gray-300' : 'border-gray-300 hover:border-indigo-400'} border-dashed rounded-md transition group`}>
                         <div className="space-y-1 text-center">
                             {isLoadingPdf ? (
                                 <Loader2 className="mx-auto h-12 w-12 text-indigo-500 animate-spin" />
                             ) : (
                                <UploadCloud className="mx-auto h-12 w-12 text-gray-400 group-hover:text-indigo-500 transition" />
                             )}
                             <div className="flex text-sm text-gray-600 justify-center mt-2">
                                 <Label htmlFor="file-upload-input" className={`relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 ${isLoadingPdf ? 'pointer-events-none opacity-50' : ''}`}>
                                     <span>Choose a file</span>
                                     <input id="file-upload-input" ref={fileInputRef} name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileUpload} disabled={isLoadingPdf}/>
                                 </Label>
                                 <p className="pl-1">or drag and drop</p>
                             </div>
                             <p className="text-xs text-gray-500">PDF up to 10MB</p>
                             {isLoadingPdf && <p className="text-xs text-indigo-600 mt-1">Processing PDF...</p>}
                         </div>
                     </div>
                     <p className="text-sm text-gray-500 mt-2">For other formats, paste text in the 'Enter Text' tab.</p>
                 </div>

                  <Button
                    id="generate-btn"
                    onClick={handleFlashcardGeneration}
                    disabled={notesInput.trim().length === 0 || isLoading || isLoadingPdf || !apiKey}
                    className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                   {isLoading ? (
                       <> <Loader2 className="h-5 w-5 animate-spin" /> Generating... </>
                   ) : (
                       '✨ Generate Flashcards ✨'
                   )}
                </Button>
                {!apiKey && (
                     <p className="text-xs text-red-600 text-center mt-2 font-medium">Warning: VITE_GEMINI_API_KEY environment variable not set.</p>
                 )}
            </CardContent>
         </Card>
         </>
   );


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center">
          {/* Updated Button */}
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mr-4 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
           <h2 className="text-lg font-semibold text-gray-700">Flashcard Game</h2>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
         {viewState === 'input' && !isLoading && renderInputViewContent()}
         {viewState === 'studying' && !isLoading && renderStudyViewContent()}
          {isLoading && (
                 <div id="loader-overlay" className="flex flex-col justify-center items-center my-16 text-center">
                     <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
                      <p className="mt-2 text-indigo-700 font-medium text-lg">Generating flashcards with AI...</p>
                      <p className="text-sm text-gray-500">This might take a moment.</p>
                 </div>
           )}
      </main>

       <style>{`
          .flashcard-container { perspective: 1000px; }
          .flashcard { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55); cursor: pointer; }
          .flashcard.flipped { transform: rotateY(180deg); }
          .flashcard-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5rem; border-radius: 0.75rem; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); overflow-y: auto; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
          .flashcard-front { background-color: white; color: #1f2937; border: 1px solid #e5e7eb; }
          .flashcard-back { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; transform: rotateY(180deg); border: 1px solid transparent; }
          .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: scale(1); background-color: #e5e7eb !important; }
          .nav-btn { transition: transform 0.15s ease-out, background-color 0.15s; }
          .nav-btn:not(:disabled):hover { transform: scale(1.1); background-color: #f3f4f6; }
          .nav-btn:not(:disabled):active { transform: scale(1.05); }
      `}</style>
    </div>
  );
};

export default FlashCardPage;