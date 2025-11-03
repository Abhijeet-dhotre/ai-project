import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Removed useParams
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// TypeScript declaration for the Vapi SDK loaded from the CDN
declare global {
  interface Window {
    Vapi: any;
  }
}

type ScreenID = 'setup' | 'subject' | 'call';

const AITutorPage: React.FC = () => {
  const navigate = useNavigate();
  // const { planId } = useParams(); // Removed

  // --- State Management ---
  const [vapi, setVapi] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<ScreenID>('setup');
  const [apiKey, setApiKey] = useState('');
  const [subject, setSubject] = useState('');
  
  // State for call UI
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [callTitle, setCallTitle] = useState('...');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  
  // Orb animation state
  const [isOrbActive, setIsOrbActive] = useState(false); // Idle (connected)
  const [isOrbSpeaking, setIsOrbSpeaking] = useState(false); // Speaking

  // Error state
  const [errors, setErrors] = useState({ setup: '', subject: '', call: '' });

  // --- Helper Functions ---
  
  const showError = (screen: ScreenID, message: string) => {
    setErrors({ setup: '', subject: '', call: '', [screen]: message });
  };
  
  const showScreen = (screenId: ScreenID) => {
    clearErrors();
    setCurrentScreen(screenId);
  };
  
  const clearErrors = () => {
    setErrors({ setup: '', subject: '', call: '' });
  };

  // --- Vapi SDK Loading ---
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/balacodeio/Vapi-Web-UMD@latest/dist/latest/vapi-web-bundle.js';
    script.async = true;
    script.onload = () => {
      console.log('Vapi SDK loaded.');
    };
    script.onerror = () => {
      showError('setup', 'Vapi SDK failed to load. Please refresh.');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // --- Vapi Event Listeners ---
  useEffect(() => {
    if (!vapi) return;

    const onCallStart = () => {
      setCallStatus('Connected');
      setIsOrbActive(true); // Orb becomes idle/active
      setIsOrbSpeaking(false);
    };

    const onCallEnd = () => {
      showScreen('subject');
      setIsOrbActive(false);
      setIsOrbSpeaking(false);
      toast.info('Class has ended.');
    };

    const onSpeechStart = (event: { role: string }) => {
      if (event.role === 'user') {
        setIsUserSpeaking(true);
      } else if (event.role === 'assistant') {
        setIsAssistantSpeaking(true);
        setIsOrbSpeaking(true); // Orb starts speaking animation
      }
    };

    const onSpeechEnd = (event: { role: string }) => {
      if (event.role === 'user') {
        setIsUserSpeaking(false);
      } else if (event.role === 'assistant') {
        setIsAssistantSpeaking(false);
        setIsOrbSpeaking(false); // Orb returns to idle
      }
    };

    const onError = (error: any) => {
      console.error('Vapi Error Details:', error);
      let errorMessage = 'An unknown error occurred.';
      if (typeof error === 'string') errorMessage = error;
      else if (error && typeof error === 'object' && error.message) errorMessage = error.message;
      else if (error && typeof error === 'object' && error.error) {
        if (typeof error.error === 'string') errorMessage = error.error;
        else if (error.error.message) errorMessage = error.error.message;
      }
      
      showError('call', errorMessage);
      showScreen('subject');
      setIsOrbActive(false);
      setIsOrbSpeaking(false);
    };

    vapi.on('call-start', onCallStart);
    vapi.on('call-end', onCallEnd);
    vapi.on('speech-start', onSpeechStart);
    vapi.on('speech-end', onSpeechEnd);
    vapi.on('error', onError);

    // Cleanup listeners
    return () => {
      vapi.off('call-start', onCallStart);
      vapi.off('call-end', onCallEnd);
      vapi.off('speech-start', onSpeechStart);
      vapi.off('speech-end', onSpeechEnd);
      vapi.off('error', onError);
    };
  }, [vapi]);

  // --- Event Handlers ---
  
  const handleSaveKey = useCallback(() => {
    const key = apiKey.trim();
    if (!key) {
      showError('setup', 'Please enter a valid Vapi Public Key.');
      return;
    }

    try {
      if (typeof window.Vapi === 'undefined') {
        showError('setup', 'Vapi SDK is still loading. Please wait a moment.');
        return;
      }
      
      const vapiInstance = new window.Vapi(key);
      setVapi(vapiInstance); // This will trigger the useEffect to set up listeners
      showScreen('subject');
    
    } catch (e: any) {
      showError('setup', e.message || 'Failed to initialize Vapi.');
      console.error(e);
    }
  }, [apiKey]);

  const handleStartCall = useCallback(() => {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      showError('subject', 'Please enter a subject.');
      return;
    }

    // Reset call screen state
    setCallTitle(`${trimmedSubject} Class`);
    setCallStatus('Connecting...');
    showScreen('call');

    const systemPrompt = `
      You are a world-class AI educator specializing in ${trimmedSubject}. 
      Your name is "Professor AI". You are patient, encouraging, and an expert 
      at breaking down complex topics into simple, understandable explanations. 
      Your goal is to help the user learn and understand ${trimmedSubject}.
      Be interactive, ask questions, and guide the user.
    `;
    
    const firstMessage = `Hello! I am Professor AI, your personal tutor for ${trimmedSubject}. What topic within ${trimmedSubject} are you curious about today?`;

    const assistantConfig = {
      model: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }]
      },
      voice: {
        provider: '11labs', 
        voiceId: 'DHeSUVQvhhYeIxNUbtj3' // Example voice, you can change this
      },
      firstMessage: firstMessage
    };
    
    try {
      vapi.start(assistantConfig);
    } catch (e: any) {
      showError('call', e.message || 'Failed to start call.');
      console.error(e);
      showScreen('subject');
    }
  }, [subject, vapi]);

  const handleStopCall = useCallback(() => {
    vapi?.stop();
    setIsOrbActive(false);
    setIsOrbSpeaking(false);
  }, [vapi]);

  // --- Orb Dynamic Styling ---
  const orbWrapperClasses = cn(
    'relative w-48 h-48 transition-all duration-500',
    isOrbActive ? 'opacity-100' : 'opacity-0',
    !isOrbActive && !isOrbSpeaking && 'opacity-0', // Initial state
    isOrbActive && !isOrbSpeaking && 'opacity-40', // Idle state
    isOrbActive && isOrbSpeaking && 'opacity-100'  // Speaking state
  );
  
  const ringClasses = cn('absolute inset-0 rounded-full border-4 border-transparent scale-100 transition-all duration-1000');
  const ring1Classes = cn(ringClasses, isOrbSpeaking ? 'opacity-60 scale-100' : 'opacity-0 scale-100', 'animate-ringPulse');
  const ring2Classes = cn(ringClasses, isOrbSpeaking ? 'opacity-60 scale-100' : 'opacity-0 scale-100', 'animate-ringPulse delay-400');
  const innerGlowClasses = cn(
    'absolute inset-4 rounded-full bg-white/30 transition-all duration-500',
    isOrbSpeaking ? 'opacity-100 scale-100 animate-innerPulse' : 'opacity-0 scale-0'
  );


  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-100 dark:bg-slate-900">
      
      {/* Back to Dashboard Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(`/dashboard`)} // ✨ CHANGED
        className="absolute top-6 left-6 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard {/* ✨ CHANGED */}
      </Button>

      {/* Main App Container */}
      <div className="w-full max-w-lg">
        <div className="relative w-full h-[70vh] min-h-[500px] max-h-[700px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 dark:border-slate-700/50 overflow-hidden flex flex-col">

          {/* Screen 1: API Key Setup */}
          <section
            className={cn(
              'screen w-full h-full p-6 md:p-10 flex flex-col justify-center space-y-6 transition-all duration-500 ease-in-out',
              currentScreen !== 'setup' && 'absolute opacity-0 scale-95 hidden'
            )}
          >
            <header className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">AI Teacher Studio</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">Create your personal AI tutor.</p>
            </header>
            
            <div className="space-y-4">
              <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter Your Vapi <strong className="text-blue-500">Public</strong> Key
              </label>
              <input 
                type="password" 
                id="api-key-input" 
                placeholder="pk_..." 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              />
              
              <div className="text-xs text-gray-600 dark:text-gray-400 text-left space-y-1 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                <p className="font-semibold text-gray-700 dark:text-gray-200">How to get your Public Key:</p>
                <ol className="list-decimal list-inside ml-2">
                  <li>Log in to your Vapi dashboard.</li>
                  <li>Go to the "Developers" &gt; "API Keys" section.</li>
                  <li>Copy your <strong className="text-gray-700 dark:text-gray-200">Public Key</strong> (it starts with `pk_...`).</li>
                </ol>
              </div>
              
              <button 
                id="save-key-button" 
                onClick={handleSaveKey}
                className="w-full text-white font-semibold py-3 px-4 rounded-lg shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transform hover:scale-105 active:scale-95 transition-all"
              >
                Save Key & Initialize
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Your key is stored in-memory for this session only.</p>
            </div>
            {errors.setup && <p className="text-red-500 text-center text-sm">{errors.setup}</p>}
          </section>

          {/* Screen 2: Teacher Creation */}
          <section 
            className={cn(
              'screen w-full h-full p-6 md:p-10 flex flex-col justify-center space-y-8 transition-all duration-500 ease-in-out',
              currentScreen !== 'subject' && 'absolute opacity-0 scale-95 hidden'
            )}
          >
            <header className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Your Teacher</h1>
              <p className="text-md text-gray-600 dark:text-gray-300 mt-2">What subject do you want to master?</p>
            </header>
            
            <div>
              <input 
                type="text" 
                id="subject-input" 
                placeholder="e.g., 'Quantum Physics'" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-center text-xl px-4 py-4 bg-transparent dark:bg-slate-900/50 border-b-2 border-gray-300 dark:border-slate-700 focus:border-blue-500 focus:ring-0 focus:outline-none transition-all"
              />
            </div>
            
            <button 
              id="start-call-button" 
              onClick={handleStartCall}
              className="w-full text-white font-semibold py-3 px-4 rounded-lg shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all"
            >
              Start Class
            </button>
            {errors.subject && <p className="text-red-500 text-center text-sm">{errors.subject}</p>}
          </section>

          {/* Screen 3: In-Call Interaction */}
          <section 
            className={cn(
              'screen w-full h-full flex flex-col transition-all duration-500 ease-in-out',
              currentScreen !== 'call' && 'absolute opacity-0 scale-95 hidden'
            )}
          >
            {/* Header */}
            <header className="w-full p-4 border-b border-gray-200 dark:border-slate-700 text-center flex-shrink-0">
              <h2 id="call-title" className="text-xl font-semibold text-gray-900 dark:text-white">{callTitle}</h2>
              <p 
                id="call-status" 
                className={cn(
                  'text-sm',
                  callStatus === 'Connected' ? 'text-green-500' : 'text-blue-500'
                )}
              >
                {callStatus}
              </p>
            </header>
          
            {/* AI ORB */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
              <div id="orb-wrapper" className={orbWrapperClasses}>
                {/* Expanding sound-wave rings */}
                <div id="ring-1" className={ring1Classes} style={{ borderColor: 'rgba(255,255,255,0.4)' }}></div>
                <div id="ring-2" className={ring2Classes} style={{ borderColor: 'rgba(255,255,255,0.4)', animationDelay: '0.4s' }}></div>
                {/* Glass orb */}
                <div id="ai-orb" className="relative w-full h-full rounded-full overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6] via-[#A855F7] to-[#F43F5E] opacity-90"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-transparent to-white/10"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex space-x-3">
                      <div className="w-5 h-9 bg-white rounded-full"></div>
                      <div className="w-5 h-9 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div id="inner-glow" className={innerGlowClasses}></div>
                </div>
              </div>
            </div>
          
            {/* Footer */}
            <footer className="w-full p-4 flex-shrink-0 border-t border-gray-200 dark:border-slate-700 space-y-3">
              <div className="flex justify-between items-center h-6">
                <div 
                  id="assistant-speaking-indicator" 
                  className={cn('flex items-center space-x-1.5 transition-opacity', !isAssistantSpeaking && 'opacity-0')}
                >
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulseQuiet" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulseQuiet" style={{ animationDelay: '.2s' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulseQuiet" style={{ animationDelay: '.4s' }}></div>
                </div>
                <div 
                  id="user-speaking-indicator" 
                  className={cn('flex items-center space-x-1.5 transition-opacity', !isUserSpeaking && 'opacity-0')}
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulseQuiet" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulseQuiet" style={{ animationDelay: '.2s' }}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulseQuiet" style={{ animationDelay: '.4s' }}></div>
                </div>
              </div>
              <button 
                id="stop-call-button" 
                onClick={handleStopCall}
                className="w-full text-white font-semibold py-3 px-4 rounded-lg shadow-lg bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transform hover:scale-105 active:scale-95 transition-all"
              >
                End Class
              </button>
              {errors.call && <p className="text-red-500 text-center text-sm">{errors.call}</p>}
            </footer>
          </section>
        
        </div>
      </div>
    </div>
  );
};

export default AITutorPage;