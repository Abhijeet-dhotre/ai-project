// src/pages/ImageGenerator.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Removed useParams
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    ArrowLeft,
    Image as ImageIcon,
    BookOpen,
    Sparkles,
    Download,
    Loader2,
    Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const ImageGenerator = () => {
    // const { planId } = useParams(); // Removed
    const navigate = useNavigate();
    const [theory, setTheory] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // --- Supabase Function URL ---
    const supabaseUrl = 'https://ylfyiojbhzdknnhinqfe.supabase.co'; //
    const functionUrl = `${supabaseUrl}/functions/v1/generate-study-image`;

    // --- Message Logic ---
    const showMessage = (text: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        switch (type) {
            case 'success': toast.success(text); break;
            case 'error': toast.error(text); break;
            case 'info': toast.info(text); break;
            case 'warning': toast.warning(text); break;
            default: toast(text);
        }
    };

    // --- API Call Logic ---
    const handleGenerate = async () => {
        const trimmedTheory = theory.trim();
        if (!trimmedTheory) { showMessage("Please enter theory", 'error'); return; }
        setIsLoading(true); setImageUrl(null);
        try {
            let attempts = 0; const maxAttempts = 5; const initialDelay = 1000;
            const fetchWithRetry = async (): Promise<any> => {
                 try {
                  const response = await fetch(functionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', /* Add Auth if needed */ }, body: JSON.stringify({ theory: trimmedTheory }) });
                  if (!response.ok) { /* ... error handling ... */
                    if (response.status === 402) throw new Error('AI credits depleted.');
                    let errorData: { error?: string } = {}; try { errorData = await response.json(); } catch (e) { /* ignore */ }
                    if (response.status === 400) throw new Error(errorData.error || `Bad Request: ${response.statusText}`);
                    if (response.status === 429) throw new Error('Rate limit exceeded. Try again later.');
                    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
                  } return await response.json();
                } catch (error: any) { /* ... retry logic ... */
                  attempts++; const isRetryable = error.message?.includes('Rate limit') || error instanceof TypeError || (error.message?.includes('HTTP error') && parseInt(error.message.split('Status: ')[1] || '0') >= 500);
                  if (attempts >= maxAttempts || !isRetryable) throw error;
                  const delay = initialDelay * Math.pow(2, attempts - 1) + Math.random() * 1000; console.warn(`Request failed (${error.message}). Retrying attempt ${attempts} in ${Math.round(delay/1000)}s...`);
                  await new Promise(resolve => setTimeout(resolve, delay)); return fetchWithRetry();
                }
            };
            const data = await fetchWithRetry();
            if (data.image && typeof data.image === 'string') { setImageUrl(data.image); showMessage("Visual generated!", 'success'); }
            else { throw new Error(data.error || 'Invalid response received.'); }
        } catch (error: any) { console.error('Error generating image:', error); showMessage(error.message || "Failed to generate visual.", 'error'); setImageUrl(null); }
        finally { setIsLoading(false); }
    };

    // --- Download Logic ---
    const handleDownload = () => {
        if (!imageUrl) return;
        fetch(imageUrl)
          .then(response => { if (!response.ok) throw new Error(`Fetch blob failed: ${response.statusText}`); return response.blob(); })
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = blobUrl; link.download = `study-visual-${Date.now()}.png`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl); showMessage("Download started.", 'success');
          })
          .catch(error => {
            console.warn("Blob download error:", error); showMessage("Direct download failed. Opening image in new tab.", 'warning');
            const link = document.createElement('a'); link.href = imageUrl; link.target = '_blank';
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
          });
    };

    return (
        // Apply consistent background across the page
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
            {/* Sticky Header */}
            <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate(`/dashboard`)} className="text-sm"> {/* ✨ CHANGED */}
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard {/* ✨ CHANGED */}
                    </Button>
                     {/* Add placeholder for potential future header items */}
                    <div></div>
                </div>
            </header>

            {/* Main Content Area - Centered and Max-Width */}
            <main className="container mx-auto max-w-6xl px-4 py-8"> {/* Adjusted max-width */}
                {/* Hero Section (Optional - can be simpler) */}
                <section className="mb-8 text-center rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 p-6 border border-border/50 shadow-sm">
                    <div className="flex items-center justify-center gap-3 mb-2 text-primary">
                        <ImageIcon className="w-7 h-7" />
                        <h1 className="text-2xl md:text-3xl font-semibold">Theory to Visual</h1>
                    </div>
                    <p className="text-sm md:text-base text-muted-foreground">
                        Transform study notes into clear diagrams.
                    </p>
                </section>

                {/* Core Input/Output */}
                <div className="grid lg:grid-cols-2 gap-6"> {/* Reduced gap slightly */}

                    {/* Input Card */}
                    <Card className="shadow-md border-border/50 flex flex-col">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2 text-primary">
                                <Sparkles className="w-4 h-4" />
                                <CardTitle className="text-lg">Your Theory</CardTitle>
                            </div>
                            <CardDescription className="text-xs pt-1">Enter the concept to visualize.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <Textarea
                                id="theoryInput"
                                placeholder="Example: Photosynthesis process including sunlight, water, CO2, chlorophyll..."
                                className="h-[350px] md:h-[400px] text-sm resize-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md" // Slightly shorter
                                value={theory}
                                onChange={(e) => setTheory(e.target.value)}
                                disabled={isLoading}
                            />
                        </CardContent>
                        <CardFooter>
                             <Button
                                id="generateButton"
                                size="default" // Standard size
                                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-95 text-primary-foreground font-medium text-sm h-10 shadow" // Adjusted style
                                onClick={handleGenerate}
                                disabled={isLoading || !theory.trim()}
                            >
                                {isLoading ? (
                                    <> <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                                ) : (
                                    <> <Sparkles className="w-4 h-4 mr-2" /> Generate Visual </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Output Card */}
                    <Card className="shadow-md border-border/50 flex flex-col">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                            <div className="space-y-0.5"> {/* Reduced space */}
                               <CardTitle className="text-lg">Generated Visual</CardTitle>
                               <CardDescription className="text-xs">AI-generated image based on theory.</CardDescription>
                            </div>
                            {imageUrl && !isLoading && (
                                <Button id="downloadButton" variant="outline" size="sm" onClick={handleDownload} className="shrink-0 h-8 px-2.5"> {/* Compact */}
                                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                                </Button>
                            )}
                        </CardHeader>
                        {/* Ensure CardContent fills space and centers content */}
                        <CardContent className="flex-grow flex items-center justify-center p-3 min-h-[350px] md:min-h-[400px]">
                            <div id="imageContainer" className="w-full h-full bg-muted/40 rounded flex items-center justify-center overflow-hidden border border-dashed border-border/50">
                                {isLoading && (
                                    <div className="text-center p-4">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                                        <p className="text-xs font-medium text-foreground">Creating visual...</p>
                                    </div>
                                )}
                                {!isLoading && !imageUrl && (
                                    <div className="text-center p-4">
                                        <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5}/>
                                        <p className="text-xs font-medium text-muted-foreground">Visual will appear here</p>
                                    </div>
                                )}
                                {!isLoading && imageUrl && (
                                    <img src={imageUrl} alt="Generated study visual" className="max-w-full max-h-full object-contain rounded" />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tips Section */}
                 <Card className="mt-6 p-4 bg-muted/30 border-l-4 border-blue-400"> {/* Reduced margin */}
                   <CardHeader className="p-0 mb-2 flex flex-row items-center gap-2">
                       <Info className="w-4 h-4 text-blue-600"/>
                       <CardTitle className="text-base font-semibold">Tips for Best Results</CardTitle>
                   </CardHeader>
                   <CardContent className="p-0">
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside marker:text-blue-500 pl-1"> {/* Smaller text/spacing */}
                      <li>Be **specific** and **clear** about the concept.</li>
                      <li>Include **key terms** and explain their **relationships**.</li>
                      <li>Mention the desired **diagram type** (e.g., flowchart, cycle).</li>
                      <li>More **detail** often yields better results.</li>
                    </ul>
                   </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default ImageGenerator;