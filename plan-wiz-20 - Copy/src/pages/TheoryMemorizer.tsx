import { useState, useRef, useEffect, forwardRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { 
  Loader, Map, Sparkles, Lightbulb, Mic, Play, Pause, 
  Volume2, BookOpen, FileText, Brain, ChevronRight, Download,
  ArrowLeft // Import ArrowLeft
} from 'lucide-react';
import { toast, Toaster as Sonner } from 'sonner';
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva } from "class-variance-authority";

// --- START: Environment Variables (from .env)
const VITE_SUPABASE_URL = "https://uqqsljrhbzibfzlbnhxd.supabase.co";
const VITE_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxcXNsanJoYnppYmZ6bGJuaHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MzAyMTksImV4cCI6MjA3NzEwNjIxOX0.dokef5388oTDv9pYKJJw_MjK8Txd8_jhpnJJ1hrd6OQ";
// --- END: Environment Variables

// --- START: UTILITIES ---
// ... (cn, formatMnemonic, convertMindMapToText, downloadFile functions remain the same) ...
function cn(...inputs: (string | boolean | null | undefined)[]) {
  return twMerge(clsx(inputs));
}
const formatMnemonic = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/gs, '<strong class="font-extrabold text-foreground">$1</strong>')
    .replace(/\*(.*?)\*/gs, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-accent mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-primary border-b border-muted pb-2 mt-8 mb-4">$1</h2>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 mb-2 list-disc list-inside">$1</li>')
    .replace(/\n/g, '<br/>'); 
};
interface MindMapBranch {
    label: string;
    notes?: string;
    subBranches?: string[];
}
interface MindMapData {
    title: string;
    branches: MindMapBranch[];
}
const convertMindMapToText = (data: MindMapData): string => {
  let text = `========================================\n`;
  text += `TITLE: ${data.title.toUpperCase()}\n`;
  text += `========================================\n\n`;
  data.branches.forEach((branch, index) => {
    text += `\n--- MAIN BRANCH (${index + 1}): ${branch.label.toUpperCase()} ---\n`;
    if (branch.notes) {
      text += `Description: ${branch.notes}\n`;
    }
    if (branch.subBranches && branch.subBranches.length > 0) {
      text += `Sub-concepts:\n`;
      branch.subBranches.forEach(sub => {
        text += `  - ${sub}\n`;
      });
    }
    text += '\n';
  });
  return text;
};
const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --- END: UTILITIES

// --- START: Simplified UI Components ---
// ... (Button, Textarea, Slider, ScrollArea, Toaster components remain the same) ...
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20",
        outline: "border border-input bg-background hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-md shadow-secondary/20",
        ghost: "hover:bg-accent/10 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    'data-gradient-class'?: string;
}
const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  const useGradient = variant === 'default' && props['data-gradient-class'];
  return (
    <button 
        className={cn(
          buttonVariants({ variant, size, className }),
          useGradient ? props['data-gradient-class'] : ''
        )} 
        ref={ref} 
        {...props} 
    />
  );
});
Button.displayName = "Button";
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border border-border bg-card p-4 text-base ring-offset-background placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onValueChange'> {
    value: number[];
    onValueChange: (value: number[]) => void;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
}
const Slider = forwardRef<HTMLDivElement, SliderProps>(({ className, value, onValueChange, min, max, step, disabled, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative flex w-full touch-none select-none items-center h-5", className)}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => onValueChange([parseFloat(e.target.value)])}
          disabled={disabled}
          className="w-full h-2 rounded-full bg-muted appearance-none cursor-pointer 
                          [&::-webkit-slider-thumb]:appearance-none 
                          [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 
                          [&::-webkit-slider-thumb]:rounded-full 
                          [&::-webkit-slider-thumb]:bg-primary 
                          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white 
                          [&::-webkit-slider-thumb]:shadow-md transition-shadow"
          {...props}
        />
      </div>
    );
});
Slider.displayName = "Slider";
const ScrollArea: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
  <div className={cn("overflow-auto", className)}>
    {children}
  </div>
);
ScrollArea.displayName = "ScrollArea";
const Toaster: React.FC<any> = (props) => {
  return (
    <Sonner
      theme="light" 
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toaster]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

// --- END: Simplified UI Components

// --- START: STRUCTURAL COMPONENTS

const Header: React.FC<{ onBack: () => void }> = ({ onBack }) => { // Added onBack prop
  return (
    <header className="py-6 print:hidden">
      <div className="flex items-center justify-center gap-4 text-center relative">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack} 
          className="absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        
        {/* Animated Brain Icon for branding */}
        <div className="p-4 rounded-3xl shadow-lg" style={{ background: 'linear-gradient(135deg, hsl(245 75% 58%) 0%, hsl(260 60% 55%) 100%)' }}>
          <Brain className="w-10 h-10 text-white animate-pulse-slow" />
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight" 
            style={{ backgroundImage: 'linear-gradient(90deg, hsl(245 75% 58%), hsl(260 60% 55%), hsl(45 95% 60%))', WebkitBackgroundClip: 'text', color: 'transparent' }}
        >
          StudyMind AI
        </h1>
        <Sparkles className="w-8 h-8 text-accent animate-spin-slow" />
      </div>
      <p className="text-muted-foreground text-xl max-w-xl mx-auto text-center mt-3">
        Transform complexity into clarity with AI-powered study tools.
      </p>
    </header>
  );
};
Header.displayName = "Header";

// ... (InputPanel, BranchCard, MindMapCanvas, MindMapView, MnemonicView, VoiceNotesView components remain the same) ...
interface InputPanelProps {
    inputPrompt: string;
    setInputPrompt: (value: string) => void;
    activeTab: 'mindmap' | 'mnemonic' | 'voice';
    isLoading: boolean;
}
const InputPanel: React.FC<InputPanelProps> = ({ inputPrompt, setInputPrompt, activeTab, isLoading }) => {
  const placeholderMap = {
    mindmap: "Enter a topic, article, or concept to visualize as a mind map. The more detail, the better the structure.\n\nExample: 'The key features of object-oriented programming'",
    mnemonic: "Enter facts, lists, or steps you need to memorize, like a sequence or key dates.\n\nExample: 'Planets in order: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.'",
    voice: "Enter a complex concept you want the AI to teach you from the ground up, in simple, conversational language.\n\nExample: 'The principles of supply and demand'",
  };
  return (
    <div className="bg-card rounded-3xl shadow-strong p-6 md:p-8 space-y-6 lg:sticky lg:top-8 border border-border/70 h-full print:hidden">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Source Content</h2>
      </div>
      <Textarea
        value={inputPrompt}
        onChange={(e) => setInputPrompt(e.target.value)}
        placeholder={placeholderMap[activeTab]}
        disabled={isLoading}
        className="min-h-[400px] resize-none text-base shadow-inner border-2 transition-shadow"
      />
      <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-primary">Pro Tip:</span> Paste large blocks of notes, articles, or complex descriptions for the best, most structured output.
        </p>
      </div>
    </div>
  );
};
InputPanel.displayName = "InputPanel";
interface BranchCardProps {
    branch: MindMapBranch;
    color: 'success' | 'primary';
}
const BranchCard: React.FC<BranchCardProps> = ({ branch, color }) => {
  const colorClasses = {
    success: 'bg-success/5 border-success',
    primary: 'bg-primary/5 border-primary',
  };
  const labelColor = color === 'success' ? 'text-success' : 'text-primary';
  const gradientClass = color === 'success' ? 'gradient-success' : 'gradient-primary';
  return (
    <div className={cn(`p-5 rounded-2xl border-l-4 ${colorClasses[color]} shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01]`, labelColor)}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-medium flex-shrink-0`, gradientClass)}>
          {branch.label.charAt(0)}
        </div>
        <h3 className="text-xl font-bold text-foreground truncate">{branch.label}</h3>
      </div>
      {branch.notes && (
        <p className="text-muted-foreground italic text-sm mb-3 ml-11 border-l pl-3 border-border">{branch.notes}</p>
      )}
      {branch.subBranches && branch.subBranches.length > 0 && (
        <ul className="space-y-1 mt-3 ml-11">
          {branch.subBranches.map((sub, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <ChevronRight className={cn("w-4 h-4 mt-0.5 flex-shrink-0", labelColor)} />
              <span className="leading-snug">{sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
BranchCard.displayName = "BranchCard";
interface MindMapCanvasProps {
    data: MindMapData;
}
const MindMapCanvas: React.FC<MindMapCanvasProps> = ({ data }) => {
  const mindMapRef = useRef<HTMLDivElement>(null);
  const handleDownload = () => {
    if (!data || !data.title || !data.branches) {
        toast.error("Mind map data is incomplete and cannot be downloaded.");
        return;
    }
    const textContent = convertMindMapToText(data);
    const filename = `${data.title.replace(/\s/g, '_').toLowerCase()}_mindmap.txt`;
    downloadFile(textContent, filename, 'text/plain');
    toast.success("Mind map downloaded as a plain Text (.txt) file!");
  };
  const branches = data.branches || [];
  const leftBranches = branches.filter((_, i) => i % 2 === 0);
  const rightBranches = branches.filter((_, i) => i % 2 !== 0);
  return (
    <div className="space-y-10 py-8 px-4 md:px-6 mind-map-canvas-content" ref={mindMapRef}> 
      <div className="text-center">
        <div className="inline-block px-10 py-5 rounded-full shadow-glow print:shadow-none" style={{ background: 'linear-gradient(135deg, hsl(245 75% 58%) 0%, hsl(165 60% 45%) 100%)' }}>
          <h2 className="text-4xl font-black text-white uppercase tracking-wider">{data.title}</h2>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-8">
          {leftBranches.map((branch, index) => (
            <BranchCard key={index} branch={branch} color="success" />
          ))}
        </div>
        <div className="space-y-8">
          {rightBranches.map((branch, index) => (
            <BranchCard key={index} branch={branch} color="primary" />
          ))}
        </div>
      </div>
      <div className="flex justify-center pt-4 print:hidden">
          <Button
            onClick={handleDownload}
            variant="outline"
            size="lg"
            className="border-primary text-primary hover:bg-primary/10 shadow-md"
          >
            <Download className="w-5 h-5 mr-2" />
            Download as Text (.txt)
          </Button>
      </div>
    </div>
  );
};
MindMapCanvas.displayName = "MindMapCanvas";
interface MindMapViewProps {
    inputPrompt: string;
    mindMapData: MindMapData | null;
    setMindMapData: (data: MindMapData | null) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}
const MindMapView: React.FC<MindMapViewProps> = ({
  inputPrompt,
  mindMapData,
  setMindMapData,
  isLoading,
  setIsLoading
}) => {
  const handleGenerate = async () => {
    if (!inputPrompt.trim()) {
      toast.error("Please enter some content to generate a mind map");
      return;
    }
    setIsLoading(true);
    setMindMapData(null);
    const maxRetries = 3;
    let lastError: Error | null = null;
    try {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(`${VITE_SUPABASE_URL}/functions/v1/generate-mindmap`, { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}`, 
                    },
                    body: JSON.stringify({ content: inputPrompt }),
                });
                if (response.ok) {
                    const data = await response.json();
                    setMindMapData(data.mindMap as MindMapData);
                    toast.success(`Mind map "${data.mindMap.title}" created successfully!`);
                    return;
                } else {
                    lastError = new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                lastError = error as Error;
            }
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        console.error('Error generating mind map after multiple retries:', lastError);
        toast.error('Failed to generate mind map. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="p-6 space-y-8 print-area-container">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Map className="w-6 h-6 text-success" />
          Mind Map Visualization
        </h3>
        <Button
          onClick={handleGenerate}
          disabled={isLoading || !inputPrompt.trim()}
          data-gradient-class="gradient-success"
          size="lg"
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Mind Map
            </>
          )}
        </Button>
      </div>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-primary bg-background/50 rounded-xl p-8">
          <Loader className="w-16 h-16 animate-spin mb-4" />
          <p className="text-xl font-medium">AI is structuring your knowledge...</p>
          <p className="text-sm text-muted-foreground mt-2">Creating the mind map from your content. Hang tight!</p>
        </div>
      ) : mindMapData ? (
        <MindMapCanvas data={mindMapData} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-muted-foreground border-2 border-dashed border-border/70 rounded-2xl p-8 text-center">
          <Map className="w-20 h-20 mb-4 opacity-40" />
          <p className="text-xl font-semibold">Your mind map will appear here</p>
          <p className="text-md mt-2">Enter your content in the panel to the left and click the button above to begin.</p>
        </div>
      )}
    </div>
  );
};
MindMapView.displayName = "MindMapView";
interface MnemonicViewProps {
    inputPrompt: string;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}
const MnemonicView: React.FC<MnemonicViewProps> = ({ inputPrompt, isLoading, setIsLoading }) => {
  const [mnemonicResult, setMnemonicResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const handleGenerate = async () => {
    if (!inputPrompt.trim()) {
      toast.error("Please enter facts or concepts to create mnemonics");
      return;
    }
    setIsLoading(true);
    setIsGenerating(true);
    setMnemonicResult('');
    const maxRetries = 3;
    let lastError: Error | null = null;
    try {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(`${VITE_SUPABASE_URL}/functions/v1/generate-mnemonic`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}`,
                    },
                    body: JSON.stringify({ content: inputPrompt }),
                });
                if (response.ok) {
                    const data = await response.json();
                    setMnemonicResult(data.mnemonic);
                    toast.success('Mnemonics created successfully! Time to memorize.');
                    return;
                } else {
                    lastError = new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                lastError = error as Error;
            }
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        console.error('Error generating mnemonic after multiple retries:', lastError);
        toast.error('Failed to generate mnemonics. Please try again.');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };
  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-accent" />
          Mnemonic Creator
        </h3>
        <Button
          onClick={handleGenerate}
          disabled={isLoading || !inputPrompt.trim()}
          data-gradient-class="gradient-accent"
          size="lg"
          className="w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Mnemonics
            </>
          )}
        </Button>
      </div>
      <div className="min-h-[500px] border-2 border-border rounded-2xl p-6 bg-muted/30">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-accent bg-background/50 rounded-xl p-8">
            <Loader className="w-16 h-16 animate-spin mb-4" />
            <p className="text-xl font-medium">Creating catchy memory tricks...</p>
            <p className="text-sm text-muted-foreground mt-2">Using creative associations for better recall.</p>
          </div>
        ) : mnemonicResult ? (
          <ScrollArea className="h-auto max-h-[70vh] p-2">
            <div className="mnemonic-content space-y-6 text-lg leading-relaxed" 
                 dangerouslySetInnerHTML={{ __html: formatMnemonic(mnemonicResult) }} />
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[500px] text-muted-foreground border-2 border-dashed border-border/70 rounded-2xl p-8 text-center">
            <Lightbulb className="w-20 h-20 mb-4 opacity-40" />
            <p className="text-xl font-semibold">Need help remembering something?</p>
            <p className="text-md mt-2">Enter facts or concepts and click "Generate Mnemonics" to instantly create memorable hooks.</p>
          </div>
        )}
      </div>
    </div>
  );
};
MnemonicView.displayName = "MnemonicView";
interface VoiceNotesViewProps {
    inputPrompt: string;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}
const VoiceNotesView: React.FC<VoiceNotesViewProps> = ({ inputPrompt, isLoading, setIsLoading }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number[]>([1]);
  const [teachingScript, setTeachingScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);
  const currentRate = useMemo(() => rate[0], [rate]);
  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };
  const handleGenerate = async () => {
    if (!inputPrompt.trim()) {
      toast.error("Please enter theory or concepts to learn");
      return;
    }
    setIsLoading(true);
    setIsGenerating(true);
    setTeachingScript('');
    handleStop(); 
    const maxRetries = 3;
    let lastError: Error | null = null;
    try {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(`${VITE_SUPABASE_URL}/functions/v1/generate-teaching-script`, { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}`, 
                    },
                    body: JSON.stringify({ content: inputPrompt }),
                });
                if (response.ok) {
                    const data = await response.json();
                    const script = data.teachingScript;
                    setTeachingScript(script.replace(/\\n/g, '\n').trim()); 
                    toast.success('Teaching script generated! Click "Start Listening" to hear it.');
                    return;
                } else {
                    lastError = new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                lastError = error as Error;
            }
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        console.error('Error generating teaching script after multiple retries:', lastError);
        toast.error('Failed to generate teaching script. Please try again.');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };
  const handleSpeak = () => {
    if (!teachingScript.trim()) {
      toast.error("Please generate a teaching script first");
      return;
    }
    if (!window.speechSynthesis) {
      toast.error("Text-to-speech not supported in your browser");
      return;
    }
    if (window.speechSynthesis.speaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(teachingScript);
    utterance.rate = currentRate;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      toast.success('Teaching session started');
    };
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utterance.onerror = (event) => {
      console.error("Speech Synthesis Error:", event.error);
      setIsPlaying(false);
      setIsPaused(false);
      toast.error('Speech synthesis error occurred. Try adjusting the speed.');
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };
  const handlePause = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };
  useEffect(() => {
    if (isPlaying) {
      handleStop();
      const timeoutId = setTimeout(handleSpeak, 100); 
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRate]);
  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Mic className="w-6 h-6 text-primary" />
          AI Teaching & Voice Notes
        </h3>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !inputPrompt.trim()}
          data-gradient-class="gradient-primary"
          size="lg"
          className="w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4 mr-2" />
              Generate Lesson
            </>
          )}
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-8 min-h-[500px]">
        <div className="border-2 border-border rounded-2xl p-6 bg-muted/30 shadow-inner">
          <h4 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2 border-b border-border pb-2">
            <BookOpen className="w-5 h-5 text-primary" />
            AI-Generated Lesson Script
          </h4>
          <ScrollArea className="h-[400px] pr-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full text-primary">
                <Loader className="w-10 h-10 animate-spin mb-4" />
                <p className="text-base font-medium">Creating your personalized lesson...</p>
                <p className="text-sm text-muted-foreground mt-2">Teaching from the basics, just for you.</p>
              </div>
            ) : teachingScript ? (
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{teachingScript}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <BookOpen className="w-16 h-16 mb-4 opacity-40" />
                <p className="text-xl font-semibold">Need a simple explanation?</p>
                <p className="text-md mt-2 text-center">Generate a teaching script to understand any complex topic effortlessly.</p>
              </div>
            )}
          </ScrollArea>
        </div>
        <div className="border-2 border-primary/20 rounded-2xl p-6 bg-primary/5 flex flex-col items-center justify-center space-y-6 shadow-xl">
          <div className="p-8 rounded-full shadow-glow" style={{ background: 'linear-gradient(135deg, hsl(245 75% 58%) 0%, hsl(260 60% 55%) 100%)' }}>
            <Volume2 className="w-16 h-16 text-white" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-foreground">
              {isPlaying ? 'Speaking Lesson...' : isPaused ? 'Paused' : 'Ready to Start Lesson'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isPlaying || isPaused ? `Playback Speed: ${currentRate}x` : 'AI explains concepts in simple terms'}
            </p>
          </div>
          <div className="w-full max-w-sm space-y-3 p-4 bg-card rounded-xl shadow-inner border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Playback Speed</span>
              <span className="font-semibold text-primary">{currentRate}x</span>
            </div>
            <Slider
              value={rate}
              onValueChange={setRate}
              min={0.5}
              max={2}
              step={0.25}
              className="w-full"
              disabled={isGenerating}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5x (Slow)</span>
              <span>1x (Normal)</span>
              <span>2x (Fast)</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {!isPlaying && !isPaused && (
              <Button
                onClick={handleSpeak}
                disabled={!teachingScript.trim() || isGenerating}
                size="lg"
                data-gradient-class="gradient-primary"
                className="shadow-primary/30"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Listening
              </Button>
            )}
            {isPlaying && (
              <Button
                onClick={handlePause}
                size="lg"
                variant="secondary"
                className="shadow-secondary/30"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
            )}
            {isPaused && (
              <Button
                onClick={handleSpeak}
                size="lg"
                data-gradient-class="gradient-primary"
                className="shadow-primary/30"
              >
                <Play className="w-5 h-5 mr-2" />
                Resume
              </Button>
            )}
            {(isPlaying || isPaused) && (
              <Button
                onClick={handleStop}
                size="lg"
                variant="destructive"
                className="shadow-destructive/30"
              >
                Stop
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
VoiceNotesView.displayName = "VoiceNotesView";


// --- START: Main Application Component 
const TheoryMemorizerApp: React.FC = () => {
  const navigate = useNavigate(); // Added navigate
  const [inputPrompt, setInputPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<'mindmap' | 'mnemonic' | 'voice'>('mindmap');
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tabs = useMemo(() => [
    { id: 'mindmap' as const, name: 'Mind Map', icon: Map, colorKey: 'success', activeBg: 'bg-mindmap-active border border-mindmap-border shadow-md' },
    { id: 'mnemonic' as const, name: 'Mnemonic Creator', icon: Lightbulb, colorKey: 'accent', activeBg: 'bg-mnemonic-active border border-mnemonic-border shadow-md' },
    { id: 'voice' as const, name: 'Voice Notes', icon: Mic, colorKey: 'primary', activeBg: 'bg-voice-active border border-voice-border shadow-md' },
  ], []);

  const handleTabChange = (tabId: 'mindmap' | 'mnemonic' | 'voice') => {
      if (activeTab === 'voice' && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
      }
      setActiveTab(tabId);
      if (tabId !== 'mindmap') setMindMapData(null);
  }
  
  const CustomStyles: React.FC = () => (
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite ease-in-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 15s linear infinite;
        }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(180deg, hsl(220 25% 97%) 0%, hsl(240 20% 95%) 100%);
            min-height: 100vh;
        }
        .mnemonic-content li {
            list-style: disc inside;
        }
        :root {
          --color-primary-h: 245;
          --color-primary-s: 75%;
          --color-primary-l: 58%;
          --color-success-h: 145;
          --color-success-s: 65%;
          --color-success-l: 50%;
          --color-accent-h: 45;
          --color-accent-s: 95%;
          --color-accent-l: 60%;
        }
        .bg-mindmap-active { 
          background-color: hsl(var(--color-success-h) var(--color-success-s) 95%); 
        }
        .border-mindmap-border { 
          border-color: hsl(var(--color-success-h) var(--color-success-s) 85%); 
        }
        .bg-mnemonic-active { 
          background-color: hsl(var(--color-accent-h) var(--color-accent-s) 95%); 
        }
        .border-mnemonic-border { 
          border-color: hsl(var(--color-accent-h) var(--color-accent-s) 85%); 
        }
        .bg-voice-active { 
          background-color: hsl(var(--color-primary-h) var(--color-primary-s) 95%); 
        }
        .border-voice-border { 
          border-color: hsl(var(--color-primary-h) var(--color-primary-s) 85%); 
        }
        .text-success { color: hsl(var(--color-success-h) var(--color-success-s) var(--color-success-l)); }
        .text-accent { color: hsl(var(--color-accent-h) var(--color-accent-s) var(--color-accent-l)); }
        .text-primary { color: hsl(var(--color-primary-h) var(--color-primary-s) var(--color-primary-l)); }
        .gradient-primary {
            background: linear-gradient(135deg, hsl(var(--color-primary-h) var(--color-primary-s) var(--color-primary-l)) 0%, hsl(260 60% 55%) 100%);
        }
        .gradient-success {
            background: linear-gradient(135deg, hsl(var(--color-success-h) var(--color-success-s) var(--color-success-l)) 0%, hsl(165 60% 45%) 100%);
        }
        .gradient-accent {
            background: linear-gradient(135deg, hsl(var(--color-accent-h) var(--color-accent-s) var(--color-accent-l)) 0%, hsl(50 90% 50%) 100%);
        }
        @media print {
            #study-mind-app-root > div > * {
                visibility: hidden !important;
                position: absolute !important;
                display: none !important;
            }
            #study-mind-app-root,
            #study-mind-app-root > div {
                visibility: visible !important;
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                position: static !important;
            }
            .mind-map-view-container {
                visibility: visible !important;
                display: block !important;
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background-color: transparent !important;
            }
            .mind-map-canvas-content {
                visibility: visible !important;
                display: block !important;
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .mind-map-canvas-content > div {
                break-inside: avoid-page;
                page-break-inside: avoid;
            }
            .print\:hidden {
                display: none !important;
                visibility: hidden !important;
            }
        }
      `}</style>
  );

  return (
    <>
      <CustomStyles />
      <Toaster />

      <div id="study-mind-app-root" className="min-h-screen font-sans antialiased">
        <div className="max-w-7xl mx-auto space-y-10 p-4 md:p-10">
          <Header onBack={() => navigate("/dashboard")} /> {/* Pass navigate function */}

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <InputPanel
                inputPrompt={inputPrompt}
                setInputPrompt={setInputPrompt}
                activeTab={activeTab}
                isLoading={isLoading}
              />
            </div>

            <div className="lg:col-span-2 space-y-6 mind-map-view-container">
              <div className="bg-card rounded-2xl shadow-lg p-2 flex gap-2 border border-border/70 print:hidden">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    disabled={isLoading}
                    className={cn(
                      `flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-base font-semibold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] bg-transparent`,
                      activeTab === tab.id ? tab.activeBg : 'hover:bg-muted/80',
                      isLoading && "opacity-60 cursor-not-allowed hover:scale-100"
                    )}
                  >
                    <tab.icon 
                      className={cn("w-5 h-5 flex-shrink-0", `text-${tab.colorKey}`)} 
                    /> 
                    <span 
                        className={cn("hidden sm:inline tab-inactive-color")}
                    >
                      {tab.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="bg-card rounded-3xl shadow-strong border border-border/70 mind-map-output-container">
                {activeTab === 'mindmap' && (
                  <MindMapView
                    inputPrompt={inputPrompt}
                    mindMapData={mindMapData}
                    setMindMapData={setMindMapData}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                  />
                )}
                {activeTab === 'mnemonic' && (
                  <MnemonicView
                    inputPrompt={inputPrompt}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                  />
                )}
                {activeTab === 'voice' && (
                  <VoiceNotesView
                    inputPrompt={inputPrompt}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TheoryMemorizerApp;
