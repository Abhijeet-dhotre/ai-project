import React, { useState, useCallback, useMemo } from 'react';

// Utility function to convert a File object to a Base64 string
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // FIX: Explicitly cast reader.result to string to satisfy TypeScript, 
      // as readAsDataURL always results in a string.
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

// Simple loading spinner SVG
const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// --- Main QnA Component ---
const QnAComponent = () => {
  const [studyMaterial, setStudyMaterial] = useState('');
  const [question, setQuestion] = useState('');
  const [formatType, setFormatType] = useState('bullet points');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [materialType, setMaterialType] = useState('text'); // 'text' or 'file'
  const [file, setFile] = useState(null);

  // Constants for API call
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setAnswer('');

    if (!question.trim()) {
      setError('Please enter a question!');
      return;
    }

    if (materialType === 'text' && !studyMaterial.trim()) {
      setError('Please provide study material text.');
      return;
    }

    if (materialType === 'file' && !file) {
      setError('Please select a file to upload.');
      return;
    }

    setIsLoading(true);

    try {
      let base64Data = null;
      let mimeType = null;
      let materialText = studyMaterial;

      // 1. Prepare File (if materialType is 'file')
      if (materialType === 'file' && file) {
        base64Data = await fileToBase64(file);
        mimeType = file.type;
        // When a file is uploaded, the prompt will reference the attached document/image.
        materialText = `[Attached Document/Image: ${file.name}]`;
      }

      // 2. Construct the prompt
      const prompt = `
        Based SOLELY on the following study material/document, answer the question accurately in **${formatType}** format using clean, well-structured Markdown.

        - Use **Bold** for headings or key terms.
        - Use bullet points (*) or numbered lists for lists.
        - If the question cannot be answered from the material, state: **Not in Material**: This information is not covered in the provided study material/document.

        **Study Material/Source**:
        ${materialText}

        **Question**: ${question}

        **Answer** (in ${formatType} format):
      `;

      // 3. Build the payload parts
      // NOTE: Initializing as an empty array and then pushing helps resolve 
      // static analysis errors regarding union types (text or inlineData).
      let parts = [];
      parts.push({ text: prompt });
      
      if (materialType === 'file' && base64Data && mimeType) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }

      const payload = {
        contents: [{
          role: "user",
          parts: parts
        }],
      };

      // 4. API Call with retry mechanism
      const maxRetries = 3;
      let response;
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
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000)); // Exponential backoff
        }
      }

      const result = await response.json();

      if (response.ok && result.candidates && result.candidates.length > 0) {
        const generatedText = result.candidates[0].content.parts[0].text;
        setAnswer(generatedText);
      } else {
        const errorDetail = result.error?.message || 'An unknown API error occurred.';
        setError(`Failed to get answer: ${errorDetail}`);
      }

    } catch (err) {
      console.error('Submission Error:', err);
      setError('Connection or processing error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [studyMaterial, question, formatType, materialType, file, apiUrl]);

  // Handle file selection
  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file size (max 5MB for most documents/images)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size exceeds 5MB limit.");
        setFile(null);
      } else {
        setFile(selectedFile);
        setError(null);
      }
    }
  }, []);

  // Conditional rendering for the input fields
  const MaterialInput = useMemo(() => {
    if (materialType === 'text') {
      return (
        <div className="space-y-2">
          <label htmlFor="study-material" className="font-medium text-gray-700">
            Enter your study material text:
          </label>
          <textarea
            id="study-material"
            value={studyMaterial}
            onChange={(e) => setStudyMaterial(e.target.value)}
            placeholder="Paste your notes, article snippets, or text content here..."
            className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out resize-y"
          />
        </div>
      );
    } else {
      return (
        <div className="space-y-2">
          <label htmlFor="file-upload" className="font-medium text-gray-700">
            Upload Document (PDF, PNG, JPG supported):
          </label>
          <input
            type="file"
            id="file-upload"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="w-full p-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg cursor-pointer focus:outline-none"
          />
          <p className="text-sm text-gray-500 mt-1">
            {file ? `File selected: ${file.name}` : 'Max file size: 5MB'}
          </p>
        </div>
      );
    }
  }, [materialType, studyMaterial, file, handleFileChange]);

  // Simple Markdown to JSX renderer (only handles basic formatting for display)
  const MarkdownRenderer = ({ content }) => {
    if (!content) return null;

    // Very basic markdown processing for display clarity
    const formattedContent = content
      .split('\n')
      .map((line, index) => {
        // Handle bolding
        let html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Handle list items (simple bullet points)
        if (html.trim().startsWith('* ')) {
          return <li key={index} dangerouslySetInnerHTML={{ __html: html.substring(2).trim() }} className="ml-5 list-disc" />;
        }
        
        // Handle paragraph
        if (html.trim()) {
          return <p key={index} dangerouslySetInnerHTML={{ __html: html }} className="mb-2" />;
        }
        return <br key={index} />;
      });

    // Check if the output is mostly list items and wrap them
    const isList = formattedContent.some(el => el && el.type === 'li');

    return (
      <div className="prose max-w-none text-gray-800">
        {isList ? <ul>{formattedContent}</ul> : formattedContent}
      </div>
    );
  };

  // --- JSX Rendering ---
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 flex items-start justify-center font-inter">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 sm:p-8 bg-blue-600 text-white text-center rounded-t-xl">
          <h1 className="text-3xl font-extrabold mb-2">🧠 AI Study QnA Assistant</h1>
          <p className="text-blue-200">Get intelligent answers from your material using Gemini.</p>
        </div>

        <div className="p-4 sm:p-8 grid md:grid-cols-2 gap-8">
          
          {/* Input Form Column */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">1. Provide Material</h2>

            {/* Material Type Selector */}
            <div className="flex space-x-4 p-1 bg-gray-50 rounded-lg border">
              <button
                type="button"
                onClick={() => setMaterialType('text')}
                className={`flex-1 py-2 rounded-lg font-medium transition duration-200 ${
                  materialType === 'text'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-white'
                }`}
              >
                📝 Text Input
              </button>
              <button
                type="button"
                onClick={() => setMaterialType('file')}
                className={`flex-1 py-2 rounded-lg font-medium transition duration-200 ${
                  materialType === 'file'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-white'
                }`}
              >
                📄 File Upload
              </button>
            </div>
            
            {MaterialInput}

            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">2. Ask Question</h2>

            {/* Question Input */}
            <div className="space-y-2">
              <label htmlFor="question" className="font-medium text-gray-700">
                Your Question:
              </label>
              <input
                type="text"
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="E.g., What are the key features of the photosynthesis process?"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                disabled={isLoading}
              />
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <label htmlFor="format-type" className="font-medium text-gray-700">
                Answer Format:
              </label>
              <select
                id="format-type"
                value={formatType}
                onChange={(e) => setFormatType(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                disabled={isLoading}
              >
                <option value="bullet points">• Bullet Points</option>
                <option value="detailed explanation">📖 Detailed Explanation</option>
                <option value="short notes">📋 Short Notes</option>
                <option value="summary">📝 Summary</option>
                <option value="key points">⭐ Key Points</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center p-4 bg-green-500 text-white text-lg font-bold rounded-lg shadow-md hover:bg-green-600 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  Generating Answer...
                </>
              ) : (
                <>
                  🚀 Get Answer
                </>
              )}
            </button>
          </form>

          {/* Answer Display Column */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">3. AI Response</h2>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
              </div>
            )}

            {/* Answer Box */}
            <div className="min-h-[250px] p-4 sm:p-6 bg-gray-50 border border-gray-200 rounded-lg shadow-inner overflow-y-auto">
              {isLoading && !answer && (
                <div className="text-center text-blue-500 pt-10">
                  <LoadingSpinner />
                  <p className="mt-2">Analyzing material and thinking...</p>
                </div>
              )}

              {answer ? (
                <div className="text-gray-800 leading-relaxed">
                  <MarkdownRenderer content={answer} />
                </div>
              ) : (
                !isLoading && (
                  <p className="text-gray-400 text-center pt-10">
                    Your generated answer will appear here.
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QnAComponent;
