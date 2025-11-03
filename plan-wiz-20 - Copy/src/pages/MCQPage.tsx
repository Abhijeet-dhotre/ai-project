import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Removed useParams
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, UploadCloud, Lightbulb, Trophy } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface MCQ {
  question: string;
  options: string[];
  correctAnswer: string;
}

type ScreenState = 'upload' | 'count' | 'loading' | 'quiz' | 'results';

const MCQPage: React.FC = () => {
  // const { planId } = useParams(); // Removed
  const navigate = useNavigate();

  // --- State Variables ---
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('upload');
  const [extractedText, setExtractedText] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [quizState, setQuizState] = useState<'answering' | 'feedback'>('answering');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState<boolean>(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [showCorrectAnswerFeedback, setShowCorrectAnswerFeedback] = useState<boolean>(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'correct' | 'incorrect' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- API Configuration ---
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const genModel = "gemini-2.5-flash-preview-05-20";

  useEffect(() => {
    // Reset state on load (was previously tied to planId)
    handleStartOver();
  }, []); // Runs once on mount


  // --- Handlers ---
  // ... (handlePdfUpload, handleTopicSubmit, handleQuestionCountSubmit, fetchWithBackoff, executeMCQGeneration, startQuiz, handleOptionChange, handleSubmitOrContinue all remain the same) ...
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingPdf(true);
    setErrorMessage(null);
    setExtractedText('');
    setTopic('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let allText = "";
      const maxPagesToProcess = 50;

      for (let i = 1; i <= Math.min(pdf.numPages, maxPagesToProcess); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        if (textContent.items && Array.isArray(textContent.items)) {
          const pageText = textContent.items.map((item: any) => item.str ?? '').join(' ');
          allText += pageText + "\n\n";
        }
      }
      if (pdf.numPages > maxPagesToProcess) {
        console.warn(`PDF has ${pdf.numPages} pages, processing only the first ${maxPagesToProcess}.`);
      }

      if (allText.trim().length < 100) {
        setErrorMessage("PDF has very little text or text couldn't be extracted. Please upload a text-based PDF.");
      } else {
        setExtractedText(allText);
        setCurrentScreen('count');
      }
    } catch (err: any) {
      console.error("Error processing PDF:", err);
      let userMessage = "Could not process the PDF. Ensure it's text-based and not password-protected.";
      if (err.name === 'PasswordException') {
        userMessage = "Could not process the PDF: It is password-protected.";
      } else if (err.message?.includes('Invalid PDF structure')) {
        userMessage = "Could not process the PDF: Invalid PDF structure.";
      } else if (err.message?.includes('missing PDF')) {
        userMessage = "Could not load the PDF file. It might be corrupted or in an unsupported format.";
      }
      setErrorMessage(userMessage);
    } finally {
      setIsProcessingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMessage("Please enter a topic.");
      return;
    }
    setErrorMessage(null);
    setExtractedText('');
    setCurrentScreen('count');
  };

  const handleQuestionCountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      setErrorMessage("API Key is missing. Please configure VITE_GEMINI_API_KEY in your .env file.");
      return;
    }
    if (numQuestions < 1 || numQuestions > 20) {
      setErrorMessage("Please enter a number between 1 and 20.");
      return;
    }
    setCurrentScreen('loading');
    setErrorMessage(null);

    try {
      let payload = {};
      const systemPromptBase = `You are an AI assistant designed to generate Multiple Choice Questions (MCQs) for educational purposes.
Instructions:
1. Generate MCQs based *only* on the provided context (either text or a topic).
2. Create exactly the requested number of questions.
3. Each question MUST have exactly 4 options.
4. One option MUST be the single correct answer.
5. The output MUST be a valid JSON array of objects.
6. Do NOT include any introductory text, closing remarks, code block markdown (\`\`\`json), or any other text outside the JSON array itself.
7. Each object in the array must strictly follow this schema: {"question": "The question text", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": "The exact string of the correct option from the options array"}
8. Ensure questions are clear, concise, and relevant to the provided context/topic.
9. Vary the position of the correct answer among the options.`;


      if (extractedText) {
        const maxTextLength = 30000;
        const truncatedText = extractedText.length > maxTextLength ? extractedText.substring(0, maxTextLength) + "..." : extractedText;
        const userPrompt = `Generate exactly ${numQuestions} MCQs based *only* on the following text:\n\n---\n${truncatedText}\n---`;
        payload = {
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPromptBase }] },
          generationConfig: {
            temperature: 0.6,
            responseMimeType: "application/json"
          }
        };
      } else if (topic) {
        const userPrompt = `Generate exactly ${numQuestions} MCQs based on the topic: "${topic}". Focus on key concepts and facts related to this topic.`;
        payload = {
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPromptBase }] },
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        };
      } else {
        throw new Error("Internal error: No PDF text or topic available.");
      }

      const generatedQuestions = await executeMCQGeneration(payload);

      if (generatedQuestions && generatedQuestions.length > 0) {
        const validQuestions = generatedQuestions.filter(q =>
          q &&
          typeof q.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every(opt => typeof opt === 'string') &&
          typeof q.correctAnswer === 'string' &&
          q.options.includes(q.correctAnswer)
        );
        if (validQuestions.length !== generatedQuestions.length) {
          console.warn(`Some generated questions were invalid and filtered out. Valid: ${validQuestions.length}, Total Received: ${generatedQuestions.length}`);
          if (validQuestions.length === 0) {
            setErrorMessage("The AI generated invalid questions. Please try again or use different input.");
            setCurrentScreen(extractedText ? 'count' : 'upload');
            return;
          }
        }
        setQuestions(validQuestions);
        startQuiz();
      } else {
        setErrorMessage("The AI couldn't generate a quiz from the provided input. It might be too short, unclear, or unsuitable.");
        setCurrentScreen(extractedText ? 'count' : 'upload');
      }
    } catch (err: any) {
      console.error("Error generating MCQs:", err);
      setErrorMessage(`Error generating quiz: ${err.message}. Please check your input and API key/quota, then try again.`);
      setCurrentScreen(extractedText ? 'count' : 'upload');
    }
  };

  const fetchWithBackoff = async (requestFunction: () => Promise<any>, maxRetries = 3) => {
    let attempt = 0;
    let delay = 1000;

    while (attempt < maxRetries) {
      try {
        const result = await requestFunction();
        return result;
      } catch (error: any) {
        const status = error?.status;
        if (status === 429 || (status && status >= 500 && status < 600)) {
          attempt++;
          if (attempt >= maxRetries) {
            throw new Error(`API call failed after ${maxRetries} attempts due to ${status || 'network'} errors.`);
          }
          console.warn(`Attempt ${attempt} failed with status ${status}. Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          delay += Math.random() * 1000;
        } else {
          throw error;
        }
      }
    }
    throw new Error("Exceeded maximum retries.");
  };


  const executeMCQGeneration = async (payload: object): Promise<MCQ[] | null> => {
    const finalApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${genModel}:generateContent?key=${apiKey}`;

    const requestFunction = async () => {
      const response = await fetch(finalApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error Response Body:", errorBody);
        let detail = 'Unknown error';
        try {
          const errorJson = JSON.parse(errorBody);
          detail = errorJson?.error?.message || errorBody;
        } catch { }
        const error = new Error(`API request failed: ${response.status} ${response.statusText} - ${detail}`) as any;
        error.status = response.status;
        throw error;
      }
      return response.json();
    };


    try {
      const result = await fetchWithBackoff(requestFunction);
      console.log("API Result:", JSON.stringify(result, null, 2));

      const candidate = result.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS") {
        console.error("Generation stopped. Reason:", candidate.finishReason, candidate.safetyRatings);
        let reasonText = `Generation stopped: ${candidate.finishReason}.`;
        if (candidate.finishReason === "SAFETY" && candidate.safetyRatings) {
          const blockedCategories = candidate.safetyRatings
            .filter((r: any) => r.blocked)
            .map((r: any) => r.category.replace('HARM_CATEGORY_', ''))
            .join(', ');
          if (blockedCategories) {
            reasonText += ` Blocked categories: ${blockedCategories}. Please revise your input.`;
          } else {
            reasonText += ` Content may violate safety policies.`
          }
        } else if (candidate.finishReason === "RECITATION") {
          reasonText += " The response may contain sensitive content from the source material.";
        } else if (candidate.finishReason === "OTHER") {
          reasonText += " An unknown issue occurred during generation.";
        }
        throw new Error(reasonText);
      }

      const contentPart = candidate?.content?.parts?.[0];

      if (contentPart?.text) {
        let jsonText = contentPart.text;
        jsonText = jsonText.trim();

        try {
          const parsedJson = JSON.parse(jsonText);
          if (!Array.isArray(parsedJson)) {
            throw new Error("API did not return a valid JSON array.");
          }
          return parsedJson as MCQ[];
        } catch (parseError: any) {
          let errorHint = `Failed to parse the quiz data received from the AI: ${parseError.message}.`;
          errorHint += ` Received text starting with: ${jsonText.substring(0, 150)}...`;
          throw new Error(errorHint);
        }

      } else {
        if (result.promptFeedback) {
          const blockReason = result.promptFeedback.blockReason;
          const safetyRatings = result.promptFeedback.safetyRatings;
          let feedbackMessage = `Generation failed based on prompt input. ${blockReason ? `Reason: ${blockReason}.` : 'Reason not specified.'}`;
          if (safetyRatings) {
            const blockedCategories = safetyRatings
              .filter((r: any) => r.blockReason)
              .map((r: any) => r.category.replace('HARM_CATEGORY_', ''))
              .join(', ');
            if (blockedCategories) {
              feedbackMessage += ` Potentially related to categories: ${blockedCategories}.`;
            }
          }
          throw new Error(feedbackMessage + " Please modify your input text or topic.");
        }
        throw new Error("No valid content received from API. The response structure might be unexpected or empty.");
      }
    } catch (error) {
      throw error;
    }
  };


  const startQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setQuizState('answering');
    setFeedbackStatus(null);
    setShowCorrectAnswerFeedback(false);
    setCurrentScreen('quiz');
  };

  const handleOptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (quizState === 'answering') {
      setSelectedAnswer(event.target.value);
    }
  };

  const handleSubmitOrContinue = () => {
    if (quizState === 'answering') {
      if (!selectedAnswer) return;

      const currentQ = questions[currentQuestionIndex];
      const isCorrect = selectedAnswer === currentQ.correctAnswer;

      setQuizState('feedback');

      if (isCorrect) {
        setScore(prev => prev + 1);
        setFeedbackStatus('correct');
        setShowCorrectAnswerFeedback(false);
      } else {
        setFeedbackStatus('incorrect');
        setShowCorrectAnswerFeedback(true);
      }
    } else {
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex);
        setSelectedAnswer(null);
        setQuizState('answering');
        setFeedbackStatus(null);
        setShowCorrectAnswerFeedback(false);
      } else {
        setErrorMessage(null);
        setCurrentScreen('results');
      }
    }
  };


  const handleStartOver = () => {
    setExtractedText('');
    setTopic('');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizState('answering');
    setSelectedAnswer(null);
    setErrorMessage(null);
    setNumQuestions(5);
    setShowCorrectAnswerFeedback(false);
    setFeedbackStatus(null);
    setIsProcessingPdf(false);
    setIsGeneratingMore(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setCurrentScreen('upload');
  };

  // ... (handleGenerateMore, currentShuffledOptions, getOptionInputClassName, getOptionLabelClassName, getButtonText, getButtonClass, getFeedbackTitle, getFeedbackContainerClass, renderCurrentQuestion functions remain the same) ...
    const handleGenerateMore = async () => {
    setIsGeneratingMore(true);
    setErrorMessage(null);

    if (!apiKey) {
      setErrorMessage("API Key is missing. Please configure VITE_GEMINI_API_KEY in your .env file.");
      setIsGeneratingMore(false);
      return;
    }

    const existingQuestionStrings = questions.map(q => q.question);
    if (existingQuestionStrings.length === 0) {
      setErrorMessage("No previous questions found to base new ones on.");
      setIsGeneratingMore(false);
      return;
    }

    try {
      let payload = {};
      const systemPromptBase = `You are an AI assistant designed to generate Multiple Choice Questions (MCQs) for educational purposes.
Instructions:
1. Generate MCQs based *only* on the provided context (either text or a topic).
2. Create exactly the requested number of questions.
3. Each question MUST have exactly 4 options.
4. One option MUST be the single correct answer.
5. The output MUST be a valid JSON array of objects.
6. Do NOT include any introductory text, closing remarks, code block markdown (\`\`\`json), or any other text outside the JSON array itself.
7. Each object in the array must strictly follow this schema: {"question": "The question text", "options": ["Option A", "Option B", "Option C", "Option D"], "correctAnswer": "The exact string of the correct option from the options array"}
8. Ensure questions are clear, concise, and relevant to the provided context/topic.
9. Vary the position of the correct answer among the options.`;

      const avoidanceInstruction = `\n\nIMPORTANT: Generate ${numQuestions} *new* questions that are DIFFERENT from this list of existing questions:\n- ${existingQuestionStrings.join('\n- ')}\n---`;

      if (extractedText) {
        const maxTextLength = 30000;
        const truncatedText = extractedText.length > maxTextLength ? extractedText.substring(0, maxTextLength) + "..." : extractedText;
        const userPrompt = `Generate exactly ${numQuestions} MCQs based *only* on the following text:\n\n---\n${truncatedText}\n---` + avoidanceInstruction;
        payload = {
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPromptBase }] },
          generationConfig: {
            temperature: 0.8,
            responseMimeType: "application/json"
          }
        };
      } else if (topic) {
        const userPrompt = `Generate exactly ${numQuestions} MCQs based on the topic: "${topic}". Focus on key concepts and facts related to this topic.` + avoidanceInstruction;
        payload = {
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPromptBase }] },
          generationConfig: {
            temperature: 0.8,
            responseMimeType: "application/json"
          }
        };
      } else {
        throw new Error("Internal error: No PDF text or topic available to generate new questions.");
      }

      console.log("Requesting new questions with payload:", JSON.stringify(payload, null, 2));
      const generatedQuestions = await executeMCQGeneration(payload);

      if (generatedQuestions && generatedQuestions.length > 0) {
        const validQuestions = generatedQuestions.filter(q =>
          q &&
          typeof q.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every(opt => typeof opt === 'string') &&
          typeof q.correctAnswer === 'string' &&
          q.options.includes(q.correctAnswer)
        );

        if (validQuestions.length === 0) {
          throw new Error("The AI generated invalid questions. Please try again.");
        }

        if (validQuestions.length !== generatedQuestions.length) {
          console.warn(`Some generated questions were invalid and filtered out. Valid: ${validQuestions.length}, Total Received: ${generatedQuestions.length}`);
        }

        setQuestions(validQuestions);
        startQuiz();

      } else {
        throw new Error("The AI couldn't generate a new quiz. The response was empty.");
      }

    } catch (err: any) {
      console.error("Error generating more MCQs:", err);
      setErrorMessage(`Error generating new quiz: ${err.message}. Please try again.`);
      setCurrentScreen('results');
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const currentShuffledOptions = useMemo(() => {
    if (!questions || currentQuestionIndex >= questions.length || !questions[currentQuestionIndex]?.options) return [];
    return [...questions[currentQuestionIndex].options].sort(() => Math.random() - 0.5);
  }, [questions, currentQuestionIndex]);


  const getOptionInputClassName = (option: string): string => {
    if (!questions || currentQuestionIndex >= questions.length) return "hidden peer quiz-option-input";

    const currentQ = questions[currentQuestionIndex];
    const isSelected = selectedAnswer === option;
    const isCorrect = currentQ.correctAnswer === option;
    let classes = "hidden peer quiz-option-input";

    if (quizState === 'feedback') {
      if (isCorrect) {
        classes += ' correct';
      } else if (isSelected && !isCorrect) {
        classes += ' incorrect';
      }
    }
    return classes;
  };

  const getOptionLabelClassName = (): string => {
    return "quiz-option-label";
  };


  const getButtonText = (): string => {
    if (quizState === 'answering') return 'Check';
    if (questions && currentQuestionIndex < questions.length - 1) return 'Continue';
    return 'Finish Quiz';
  };

  const getButtonClass = (): string => {
    let baseClass = "cta-button w-full";
    if (quizState === 'feedback') {
      if (feedbackStatus === 'correct') return `${baseClass} correct`;
      if (feedbackStatus === 'incorrect') return `${baseClass} incorrect`;
    }
    return baseClass;
  };

  const getFeedbackTitle = (): string => {
    if (feedbackStatus === 'correct') return 'Correct!';
    if (feedbackStatus === 'incorrect') return 'Incorrect';
    return '';
  };

  const getFeedbackContainerClass = (): string => {
    let base = "sticky bottom-0 left-0 right-0 border-t z-20 transition-all duration-300";
    if (feedbackStatus === 'correct') return `${base} feedback-correct`;
    if (feedbackStatus === 'incorrect') return `${base} feedback-incorrect`;
    return `${base} feedback-neutral bg-card/80 backdrop-blur-sm`;
  };

  const renderCurrentQuestion = () => {
    if (!questions || questions.length === 0 || currentQuestionIndex >= questions.length) {
      return <p className="text-center text-muted-foreground py-10">Loading question or quiz finished...</p>;
    }
    const q = questions[currentQuestionIndex];
    if (!q || !q.options) {
      return <p className="text-center text-red-500 py-10">Error displaying question.</p>;
    }

    return (
      <div id="question-card">
        <p id="question-text" className="text-2xl md:text-3xl font-bold text-foreground mb-6 md:mb-8 text-left">{q.question}</p>
        <div id="quiz-options" className="space-y-3">
          {currentShuffledOptions.map((option, index) => {
            if (typeof option !== 'string') {
              return null;
            }
            const optionId = `option-${currentQuestionIndex}-${index}`;
            return (
              <div key={optionId}>
                <input
                  type="radio"
                  name={`quiz-option-${currentQuestionIndex}`}
                  id={optionId}
                  value={option}
                  className={getOptionInputClassName(option)}
                  checked={selectedAnswer === option}
                  onChange={handleOptionChange}
                  disabled={quizState === 'feedback'}
                  required
                />
                <label htmlFor={optionId} className={getOptionLabelClassName()}>
                  {option}
                </label>
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Updated Button */}
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-sm px-2">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Dashboard
          </Button>
          {currentScreen === 'quiz' && questions.length > 0 && (
            <div className="text-sm font-medium text-muted-foreground">
              Question {currentQuestionIndex + 1} / {questions.length}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-8 max-w-2xl flex-grow pb-40">
        {/* ... (Rest of the render logic for screens remains the same) ... */}
         <div className={`transition-opacity duration-300 ease-in-out ${currentScreen === 'upload' ? 'opacity-100 block' : 'opacity-0 hidden'}`} id="upload-container">
          <h1 className="text-3xl font-bold text-center text-foreground mb-8">MCQ Generator</h1>
          {errorMessage && <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm">{errorMessage}</div>}
          <Card className="mb-6 shadow-md border">
            <CardHeader><CardTitle className="text-xl flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary" /> Upload a PDF</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">Generate questions from a text-based PDF file.</p>
              <Input
                type="file" id="pdf-upload" accept=".pdf" ref={fileInputRef} onChange={handlePdfUpload} disabled={isProcessingPdf}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {isProcessingPdf && <div className="mt-4 text-sm text-muted-foreground flex items-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div> Processing PDF...</div>}
            </CardContent>
          </Card>
          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t"></div></div><div className="relative flex justify-center"><span className="bg-background px-3 text-sm font-medium text-muted-foreground uppercase">OR</span></div></div>
          <Card className="shadow-md border">
            <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Lightbulb className="h-5 w-5 text-indigo-500" /> Enter a Topic</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">Generate questions about a specific topic.</p>
              <form onSubmit={handleTopicSubmit} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text" id="topic-input" placeholder="e.g., Photosynthesis" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={isProcessingPdf}
                  className="flex-grow p-3 border-input rounded-lg focus-visible:ring-1 focus-visible:ring-ring" required />
                <Button
                  type="submit" id="process-topic-btn" disabled={isProcessingPdf || !topic.trim()}
                  className="w-full sm:w-auto bg-indigo-600 text-white font-bold uppercase tracking-wide px-4 py-2 h-auto rounded-lg shadow-[0_4px_0_0_#4f46e5] hover:bg-indigo-700 active:translate-y-0.5 active:shadow-[0_2px_0_0_#4f46e5] transition-all duration-150 disabled:opacity-50 disabled:shadow-[0_4px_0_0_hsl(var(--border))] disabled:bg-muted disabled:text-muted-foreground disabled:active:translate-y-0"
                >
                  Generate from Topic
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className={`transition-opacity duration-300 ease-in-out ${currentScreen === 'count' ? 'opacity-100 block' : 'opacity-0 hidden'}`} id="question-count-container">
          <Card className="shadow-md border">
            <CardHeader><CardTitle className="text-xl">Number of Questions</CardTitle></CardHeader>
            <CardContent>
              <p id="step-2-message" className="text-muted-foreground mb-6 text-sm">
                {extractedText ? "PDF processed." : `Topic: "${topic}".`} How many MCQs? (1-20)
              </p>
              {errorMessage && <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm">{errorMessage}</div>}
              <form id="question-count-form" onSubmit={handleQuestionCountSubmit}>
                <Input
                  type="number" id="question-count-input" min="1" max="20" value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="w-full p-3 border-input rounded-lg focus-visible:ring-1 focus-visible:ring-ring text-lg mb-6" required />
                <Button type="submit" className="cta-button w-full">
                  Generate Quiz
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className={`transition-opacity duration-300 ease-in-out text-center py-20 ${currentScreen === 'loading' ? 'opacity-100 block' : 'opacity-0 hidden'}`} id="loading-container">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-6 text-lg font-semibold">Generating your quiz...</p>
          <p className="text-muted-foreground/80 mt-2 text-sm">This may take a moment.</p>
        </div>

        <div className={`transition-opacity duration-300 ease-in-out ${currentScreen === 'quiz' ? 'opacity-100 block' : 'opacity-0 hidden'}`} id="quiz-container">
          {questions.length > 0 && currentQuestionIndex < questions.length && (
            <>
              <div className="w-full bg-muted rounded-full h-2.5 mb-6 md:mb-8 overflow-hidden border">
                <div
                  id="progress-bar" className="h-2.5 rounded-full transition-[width] duration-300 ease-in-out"
                  style={{
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                    backgroundColor: 'var(--color-green)'
                  }}>
                </div>
              </div>
              {renderCurrentQuestion()}
            </>
          )}
        </div>

        <div className={`transition-opacity duration-300 ease-in-out text-center py-12 md:py-20 ${currentScreen === 'results' ? 'opacity-100 block' : 'opacity-0 hidden'}`} id="results-container">
          <Card className="max-w-md mx-auto shadow-lg border">
            <CardHeader>
              <CardTitle className="text-3xl md:text-4xl font-extrabold text-center">Quiz Complete!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">

              {errorMessage && (
                <div className="p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm text-left">
                  {errorMessage}
                </div>
              )}

              <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-2" />
              <p className="text-xl text-foreground">Your Score:</p>
              <p id="score-text" className="text-6xl md:text-7xl font-extrabold text-foreground mb-6">
                {score} / {questions.length}
              </p>
              <p className="text-lg font-medium text-muted-foreground">
                {questions.length > 0 && score / questions.length >= 0.8 ? "Excellent work! 🎉" :
                  questions.length > 0 && score / questions.length >= 0.5 ? "Good job! 👍" :
                    "Keep practicing! 💪"
                }
              </p>
              <Button id="start-over-btn" onClick={handleStartOver} className="cta-button w-full mt-6">
                Try Another Quiz
              </Button>

              <Button
                id="generate-more-btn"
                onClick={handleGenerateMore}
                variant="outline"
                className="w-full"
                disabled={isGeneratingMore}
              >
                {isGeneratingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Generating New Quiz...
                  </>
                ) : (
                  "Try New Questions"
                )}
              </Button>

            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      {currentScreen === 'quiz' && (
        <div id="feedback-outer-container" className={getFeedbackContainerClass()}>
          <div className="container mx-auto px-4 max-w-2xl py-4 md:py-5">
            <div id="feedback-content" className={`mb-4 ${quizState === 'feedback' ? 'min-h-[3rem] md:min-h-[3.5rem]' : 'min-h-[1rem]'}`}>
              {quizState === 'feedback' && (
                <div>
                  <h3 id="feedback-title" className={`text-xl md:text-2xl font-bold ${feedbackStatus === 'correct' ? 'text-[var(--color-green)]' : 'text-destructive'}`}>
                    {getFeedbackTitle()}
                  </h3>
                  {showCorrectAnswerFeedback && feedbackStatus === 'incorrect' && (
                    <p id="feedback-correct-answer" className="font-semibold text-foreground/90 mt-1 text-sm md:text-base">
                      Correct: <span className="text-[var(--color-green)] font-bold">{questions[currentQuestionIndex]?.correctAnswer}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
            <Button
              id="submit-answer-btn"
              className={getButtonClass()}
              onClick={handleSubmitOrContinue}
              disabled={quizState === 'answering' && !selectedAnswer}
              variant={feedbackStatus ? (feedbackStatus === 'correct' ? 'default' : 'destructive') : 'default'}
              size="lg"
            >
              {getButtonText()}
            </Button>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorMessage && !(currentScreen === 'upload' || currentScreen === 'count' || currentScreen === 'results') &&
        <div id="error-modal" className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="bg-background p-0 rounded-lg shadow-xl max-w-sm mx-auto border w-full">
            <CardHeader className="text-center p-4 border-b">
              <CardTitle className="text-lg font-semibold text-destructive">An Error Occurred</CardTitle>
            </CardHeader>
            <CardContent className="text-center px-6 py-4">
              <p id="error-message" className="text-sm text-muted-foreground">{errorMessage}</p>
            </CardContent>
            <div className="px-6 pb-4 flex flex-col gap-2">
              <Button
                id="close-error-modal"
                variant="destructive"
                className="w-full"
                onClick={() => setErrorMessage(null)}
              >
                Close
              </Button>
              <Button variant="outline" className="w-full" onClick={handleStartOver}>Start Over</Button>
            </div>
          </Card>
        </div>
      }
      
      {/* CSS Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
          :root {
              --color-green: #58a700;
              --color-green-hover: #509a00;
              --color-green-shadow: #4f9a00;
              --color-green-light-bg: #ddf4bf;
              --color-green-light-border: #77c200;
              --color-red-text: hsl(var(--destructive));
              --color-red-light-bg: hsl(var(--destructive) / 0.1);
              --color-red-light-border: hsl(var(--destructive) / 0.5);
              --shadow-press: 0 2px 0 0 hsl(var(--border));
              --shadow-lifted: 0 4px 0 0 hsl(var(--border));
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --color-green-light-bg: #2a3f16;
              --color-green-light-border: #4a751c;
              --color-red-light-bg: hsl(var(--destructive) / 0.15);
              --color-red-light-border: hsl(var(--destructive) / 0.3);
            }
          }
          #progress-bar { transition: width 0.3s ease-in-out; }
          .quiz-option-label {
              display: block; width: 100%; padding: 0.9rem 1rem;
              border: 2px solid hsl(var(--border));
              background-color: hsl(var(--card));
              border-radius: var(--radius);
              font-weight: 600; color: hsl(var(--foreground)); cursor: pointer;
              transition: all 0.2s ease; 
              box-shadow: var(--shadow-lifted);
              text-align: left;
          }
          .quiz-option-label:hover { background-color: hsl(var(--muted)); }
          .quiz-option-input:checked + .quiz-option-label {
              border-color: hsl(var(--primary));
              background-color: hsl(var(--primary) / 0.08);
              color: hsl(var(--primary)); 
              box-shadow: var(--shadow-press);
              transform: translateY(2px);
          }
           .quiz-option-input:disabled + .quiz-option-label {
              cursor: not-allowed; 
              box-shadow: var(--shadow-lifted);
              transform: translateY(0); 
              background-color: hsl(var(--card));
              border-color: hsl(var(--border));
          }
          .quiz-option-input.correct + .quiz-option-label {
              border-color: var(--color-green-light-border) !important; 
              background-color: var(--color-green-light-bg) !important;
              color: var(--color-green) !important; 
              box-shadow: none !important;
              transform: translateY(4px) !important; 
              opacity: 1 !important;
          }
           .quiz-option-input.incorrect + .quiz-option-label {
              border-color: var(--color-red-light-border) !important; 
              background-color: var(--color-red-light-bg) !important;
              color: var(--color-red-text) !important; 
              box-shadow: none !important;
              transform: translateY(4px) !important; 
              opacity: 1 !important;
           }
           .quiz-option-input.correct:disabled + .quiz-option-label {
              border-color: var(--color-green-light-border) !important; 
              background-color: var(--color-green-light-bg) !important;
              color: var(--color-green) !important; 
              opacity: 1 !important; 
              transform: translateY(0) !important; 
              box-shadow: none !important;
           }
           .quiz-option-input:disabled:not(:checked):not(.correct) + .quiz-option-label {
               opacity: 0.6;
               background-color: hsl(var(--muted) / 0.5);
               box-shadow: none;
               transform: translateY(0);
           }
          .cta-button {
              font-weight: 700 !important; 
              text-transform: uppercase !important;
              letter-spacing: 0.05em;
              box-shadow: 0 4px 0 0 hsl(var(--primary) / 0.6);
              transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease !important;
          }
          .cta-button:active:not(:disabled) { 
            box-shadow: 0 2px 0 0 hsl(var(--primary) / 0.6); 
            transform: translateY(2px); 
          }
          .cta-button.correct {
              background-color: var(--color-green) !important; 
              border-color: var(--color-green) !important;
              box-shadow: 0 4px 0 0 var(--color-green-shadow) !important; 
              color: white !important;
              --tw-ring-color: var(--color-green) !important;
          }
          .cta-button.correct:hover:not(:disabled) { background-color: var(--color-green-hover) !important; }
          .cta-button.correct:active:not(:disabled) { 
            box-shadow: 0 2px 0 0 var(--color-green-shadow) !important; 
            transform: translateY(2px); 
          }
          .cta-button.incorrect {
              background-color: hsl(var(--destructive)) !important; 
              border-color: hsl(var(--destructive)) !important;
              box-shadow: 0 4px 0 0 hsl(var(--destructive) / 0.6) !important; 
              color: hsl(var(--destructive-foreground)) !important;
              --tw-ring-color: hsl(var(--destructive)) !important;
          }
           .cta-button.incorrect:hover:not(:disabled) { background-color: hsl(var(--destructive) / 0.9) !important; }
          .cta-button.incorrect:active:not(:disabled) { 
            box-shadow: 0 2px 0 0 hsl(var(--destructive) / 0.6) !important; 
            transform: translateY(2px); 
          }
          #feedback-outer-container { animation: slideUp 0.3s ease-out forwards; }
          #feedback-outer-container.feedback-correct { 
            background-color: var(--color-green-light-bg); 
            border-top-color: var(--color-green-light-border); 
          }
          #feedback-outer-container.feedback-incorrect { 
            background-color: var(--color-red-light-bg); 
            border-top-color: var(--color-red-light-border); 
          }
          #feedback-outer-container.feedback-neutral { 
            border-top-color: hsl(var(--border)); 
          }
          @keyframes slideUp { 
            from { transform: translateY(100%); opacity: 0; } 
            to { transform: translateY(0); opacity: 1; } 
          }
      `
      }} />

    </div>
  );
};

export default MCQPage;
