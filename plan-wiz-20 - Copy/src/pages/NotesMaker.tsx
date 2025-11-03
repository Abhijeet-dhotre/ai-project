import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { BookOpen, Lightbulb, Pencil, ArrowLeft, Clipboard, Check } from 'lucide-react';

// --- UTILITY FUNCTIONS ---
// ... (fileToBase64, LoadingSpinner, MarkdownRenderer functions remain the same) ...
const fileToBase64 = (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        resolve(dataUrl.split(',')[1]); 
      } else {
        reject(new Error("FileReader result was not a string."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inList = false;
  let currentListItems: JSX.Element[] = [];
  
  const renderText = (text: string) => {
      let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
      html = html.replace(/`(.*?)`/g, '<code>$1</code>');
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.match(/^(\*|\-|\d+\.)\s/)) {
          if (!inList) { inList = true; }
          const itemText = trimmedLine.substring(trimmedLine.indexOf(' ') + 1);
          currentListItems.push(<li key={`li-${index}`}>{renderText(itemText)}</li>);
      } else {
          if (inList) {
              elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-5 mb-3 space-y-2">{currentListItems}</ul>);
              currentListItems = [];
              inList = false;
          }
          if (trimmedLine.startsWith('###')) {
              elements.push(<h3 key={`h3-${index}`} className="text-xl font-bold mt-4 mb-2">{renderText(trimmedLine.substring(3).trim())}</h3>);
          } else if (trimmedLine.startsWith('##')) {
              elements.push(<h2 key={`h2-${index}`} className="text-2xl font-bold mt-5 mb-3">{renderText(trimmedLine.substring(2).trim())}</h2>);
          } else if (trimmedLine.startsWith('#')) {
              elements.push(<h1 key={`h1-${index}`} className="text-3xl font-bold mt-6 mb-4">{renderText(trimmedLine.substring(1).trim())}</h1>);
          } else if (trimmedLine) {
              elements.push(<p key={`p-${index}`} className="mb-3">{renderText(trimmedLine)}</p>);
          } else {
              elements.push(<br key={`br-${index}`} />);
          }
      }
  });
  if (inList) {
      elements.push(<ul key={`ul-end`} className="list-disc pl-5 mb-3 space-y-2">{currentListItems}</ul>);
  }
  return (
    <div className="text-sm sm:text-base leading-relaxed break-words">
      {elements}
    </div>
  );
};


// --- CORE LOGIC COMPONENT (GENERIC API CALL) ---
// ... (useGeminiApi hook remains the same) ...
const useGeminiApi = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const callApi = useCallback(async (prompt: string, fileData: { mimeType: string; base64Data: string } | null = null) => {
    let parts: any[] = [];
    parts.push({ text: prompt });
    
    if (fileData) {
      parts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.base64Data
        }
      });
    }

    const payload = {
      contents: [{
        role: "user",
        parts: parts
      }],
    };

    const maxRetries = 3;
    let response: Response | undefined;
    for (let i = 0; i < maxRetries; i++) {
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) break;
      } catch (e) {
        if (i === maxRetries - 1) throw e;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }

    if (!response) {
      throw new Error("API request failed after retries.");
    }

    const result = await response.json();

    if (response.ok && result.candidates && result.candidates.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      const errorDetail = result.error?.message || 'An unknown API error occurred.';
      throw new Error(`Failed to get response: ${errorDetail}`);
    }
  }, [apiUrl]);

  return callApi;
};


// --- NOTES MAKER COMPONENT ---
const NOTE_TYPES = [
    { value: 'Summary', label: 'Summary Notes', description: 'A brief, high-level overview of the PDF content.' },
    { value: 'Detailed', label: 'Detailed Notes', description: 'Comprehensive notes covering all major points.' },
    { value: 'Exam-Focused', label: 'Exam-Focused Notes', description: 'Key concepts, definitions, and potential exam questions.' },
    { value: 'Flashcards', label: 'Flashcards / Q&A', description: 'Structured Question-and-Answer pairs for study.' },
];

const NotesMaker = () => {
  const navigate = useNavigate(); // Added navigate
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [noteType, setNoteType] = useState(NOTE_TYPES[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const callGeminiApi = useGeminiApi();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size exceeds 5MB limit.");
        setFile(null);
      } else {
        if (!selectedFile.type.match(/^(application\/pdf|image\/(png|jpeg|jpg))$/)) {
             setError("Unsupported file type. Please upload a PDF, PNG, or JPG image.");
             setFile(null);
        } else {
            setFile(selectedFile);
            setError(null);
        }
      }
    }
  }, []);
  
  const handleCopy = useCallback(() => {
    // ... (copy logic remains the same) ...
    if (notes) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = notes;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text (execCommand): ', err);
        setError('Failed to copy notes. Please try manual copy.');
      }
    }
  }, [notes]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotes('');

    if (!topic.trim()) {
      setError('Please specify the topic for the notes.');
      return;
    }
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        setError("File size exceeds 5MB limit. Please select a smaller file.");
        return;
    }

    setIsLoading(true);

    try {
      let fileData: { base64Data: string; mimeType: string } | null = null;
      
      const base64Data = await fileToBase64(file);
      if (!base64Data) throw new Error("Failed to read file data.");

      fileData = { base64Data, mimeType: file.type };
      const materialText = `[Attached Document/Image: ${file.name}]`;

      const noteTypeDetails = NOTE_TYPES.find(n => n.value === noteType);
      const outputFormatInstruction = noteTypeDetails ? noteTypeDetails.label : 'Structured Notes';
      
      let prompt = '';
      
      switch (noteType) {
        case 'Summary':
            prompt = `You are an expert academic note-taker. Your task is to process the provided material/document and topic to create a **concise, high-level summary** of the material that directly addresses the topic. Use clear, well-structured Markdown format.`;
            break;
        case 'Detailed':
            prompt = `You are an expert academic note-taker. Your task is to process the provided material/document and topic to create **comprehensive, detailed notes**. Cover all major points, definitions, and supporting evidence found in the document related to the topic. Use structured sections using '##' or '###' headings and detailed bullet points (*).`;
            break;
        case 'Exam-Focused':
            prompt = `You are an expert academic note-taker. Your task is to process the provided material/document and topic to create **exam-focused notes**. These notes must highlight key concepts, critical definitions, important formulas, and structure the content around potential exam questions. Use clean, highly structured Markdown.`;
            break;
        case 'Flashcards':
            prompt = `You are an expert academic note-taker. Your task is to process the provided material/document and topic to create **structured Question-and-Answer pairs** for study. Generate at least 5 Q&A pairs. Each answer should be concise and directly derived from the material. Format the output clearly using Markdown: \n**Q**: [Question]\n**A**: [Answer]\nfor each pair.`;
            break;
        default:
            prompt = `You are an expert academic note-taker. Your task is to process the provided material/document and topic to create clear, highly structured, and concise study notes optimized for exam preparation. Use clean, well-structured **Markdown** format.`;
      }

      prompt += `\n\n**Your notes MUST be formatted for easy reading**:
        1. A bold, concise title for the notes.
        2. Structured sections using '##' or '###' headings.
        3. Use bullet points (*) or numbered lists for lists.
        4. If the question cannot be answered from the material, state: **Not in Material**: This information is not covered in the provided study material.
        
        **Study Material/Source**:
        ${materialText}

        **Target Topic**: ${topic}

        **Generated Notes** (in ${outputFormatInstruction} format):
      `;

      const generatedText = await callGeminiApi(prompt, fileData);
      setNotes(generatedText);

    } catch (err: any) {
      console.error('Submission Error:', err);
      setError(err.message || 'An error occurred during note generation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [topic, file, noteType, callGeminiApi]);

  const MaterialInput = (
    <div className="space-y-2">
      <label htmlFor="notes-file-upload" className="font-medium text-gray-700">
        Upload Document (PDF, PNG, JPG supported)
      </label>
      <input
        type="file"
        id="notes-file-upload"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="w-full p-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg cursor-pointer focus:outline-none"
        disabled={isLoading}
      />
      <p className="text-sm text-gray-500 mt-1">
        {file ? `File selected: ${file.name}` : 'Max file size: 5MB. Only PDF/Image files supported.'}
      </p>
    </div>
  );
  
  const NoteTypeSelector = (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700 text-lg">Select Your Note Type</h3>
      <div className="grid gap-2">
        {NOTE_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setNoteType(type.value)}
            type="button"
            className={`
              p-4 text-left border-2 rounded-lg transition-all duration-200
              ${noteType === type.value 
                ? 'bg-yellow-50 border-yellow-500 shadow-md ring-2 ring-yellow-300' 
                : 'bg-white border-gray-200 hover:border-yellow-300'
              }
              disabled:opacity-60 disabled:cursor-not-allowed
            `}
            disabled={isLoading}
          >
            <p className="font-bold text-gray-800">{type.label}</p>
            <p className="text-sm text-gray-500">{type.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-8 flex items-start justify-center font-inter">
      <div className="w-full max-w-4xl">
        
        <header className="border-b bg-white/70 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            {/* Updated button */}
            <button 
                onClick={() => navigate("/dashboard")} // Changed
                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                title="Back to Dashboard" // Changed
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-8 border-2 border-yellow-100">
            {/* ... (Rest of the component remains the same) ... */}
            <div className="p-0 mb-6">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center mb-4 shadow-lg">
                    <Pencil className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-3xl font-extrabold text-gray-800">Notes Maker</h1>
                <p className="text-gray-500 mt-1">
                    Convert complex material from a file into clear, highly structured study notes.
                </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2 text-yellow-600"/> 1. Configure Notes
                    </h2>

                    <div className="space-y-2">
                        <label htmlFor="topic" className="font-medium text-gray-700">
                            Notes Topic: 
                        </label>
                        <input
                            type="text"
                            id="topic"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="What concept should the notes be about?"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 transition duration-150 ease-in-out"
                            disabled={isLoading}
                            required
                        />
                    </div>
                    
                    {NoteTypeSelector}

                    {MaterialInput}
                    
                    <button
                        type="submit"
                        className="w-full flex items-center justify-center p-4 bg-yellow-600 text-white text-lg font-bold rounded-lg shadow-xl hover:bg-yellow-700 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <LoadingSpinner />
                                Generating Notes...
                            </>
                        ) : (
                            <>
                                <BookOpen className="w-5 h-5 mr-2" />
                                Generate Exam Notes
                            </>
                        )}
                    </button>
                </form>

                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center">
                        <BookOpen className="w-5 h-5 mr-2 text-yellow-600"/> 2. Generated Notes
                    </h2>

                    {error && (
                        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                            <p className="font-semibold">Error:</p>
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="min-h-[400px] p-4 sm:p-6 bg-yellow-50/50 border border-yellow-200 rounded-lg shadow-inner overflow-y-auto relative">
                        {isLoading && !notes && (
                            <div className="text-center text-yellow-500 pt-10">
                                <LoadingSpinner />
                                <p className="mt-2">Structuring your material into study notes...</p>
                            </div>
                        )}

                        {notes ? (
                            <>
                                <button
                                    onClick={handleCopy}
                                    title="Copy Notes"
                                    className="absolute top-2 right-2 p-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition duration-150 shadow-md"
                                >
                                    {copied ? <Check className="w-5 h-5 text-green-500" /> : <Clipboard className="w-5 h-5" />}
                                </button>
                                <div className="text-gray-800 leading-relaxed pt-4">
                                    <MarkdownRenderer content={notes} />
                                </div>
                            </>
                        ) : (
                            !isLoading && (
                                <p className="text-gray-400 text-center pt-10">
                                    Your concise exam notes will appear here once generated.
                                </p>
                            )
                        )}
                    </div>
                </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default NotesMaker;
