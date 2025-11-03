import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askAiTutorService } from "@/services";
import React, { useState, useCallback } from 'react';

// Simple loading spinner
const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// Basic Markdown-like renderer for the dark theme
const MarkdownRenderer = ({ content }) => {
  if (!content) return null;

  return content.split('\n').map((line, index) => {
    let formattedLine = line;

    // Handle bolding
    formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Handle list items
    if (formattedLine.trim().startsWith('* ')) {
      return <li key={index} dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }} className="ml-5 list-disc text-gray-300" />;
    }
    
    // Handle paragraphs
    if (formattedLine.trim()) {
      return <p key={index} dangerouslySetInnerHTML={{ __html: formattedLine }} className="mb-2 text-gray-200" />;
    }
    
    return <br key={index} />;
  });
};

const AiTutorComponent = ({ courseId, lectureId }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setAnswer('');

    if (!question.trim()) {
      setError('Please enter a question!');
      return;
    }

    if (!courseId || !lectureId) {
      setError('Please select a lecture first to get context.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = { question, courseId, lectureId };
      const response = await askAiTutorService(payload);

      if (response.success) {
        setAnswer(response.answer);
      } else {
        setError(response.message || 'Failed to get answer.');
      }

    } catch (err) {
      console.error('Submission Error:', err);
      setError('Connection or processing error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [question, courseId, lectureId]);

  return (
    <div className="p-4 text-white h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4">AI Tutor</h2>
      <p className="text-sm text-gray-400 mb-4">
        Ask questions about the current lecture.
      </p>

      {/* Answer Display */}
      <ScrollArea className="flex-1 mb-4 p-4 bg-[#2a2b2e] rounded-lg border border-gray-700 min-h-[250px]">
        {isLoading && !answer && (
          <div className="flex justify-center items-center h-full text-gray-400">
            <LoadingSpinner />
            <p>Thinking...</p>
          </div>
        )}
        {answer ? (
          <MarkdownRenderer content={answer} />
        ) : (
          !isLoading && (
            <p className="text-gray-500 text-center pt-10">
              Your generated answer will appear here.
            </p>
          )
        )}
         {error && (
          <div className="p-4 bg-red-900 border border-red-700 text-white rounded-lg">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="E.g., What is this lecture about?"
          className="w-full p-3 bg-[#2a2b2e] border border-gray-700 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
        <Button
          type="submit"
          className="w-full flex items-center justify-center p-4 bg-green-500 text-white text-lg font-bold rounded-lg shadow-md hover:bg-green-600 transition duration-200 disabled:bg-gray-500"
          disabled={isLoading || !courseId || !lectureId}
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              Generating...
            </>
          ) : (
            <>
              🚀 Get Answer
            </>
          )}
        </Button>
        {!lectureId && (
            <p className="text-xs text-center text-yellow-500">Please play a lecture to activate the AI Tutor.</p>
        )}
      </form>
    </div>
  );
};

export default AiTutorComponent;
