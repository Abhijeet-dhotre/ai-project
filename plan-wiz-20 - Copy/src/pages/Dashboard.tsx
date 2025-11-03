import { useNavigate } from "react-router-dom";
// Import MessageSquare for the new icon
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Brain, FileText, ImageIcon, Lightbulb, MessageSquare, MessageSquareQuote, Target } from "lucide-react"; 

// AI Tool definitions
const aiTools = [
  {
    title: "Notes Maker",
    description: "Generate comprehensive notes from your study material.",
    path: "/notes-maker",
    icon: FileText,
    colorClasses: "from-blue-600 to-blue-500",
  },
  {
    title: "Q&A Component",
    description: "Ask questions and get answers about your topics.",
    path: "/qna-component",
    icon: MessageSquareQuote,
    colorClasses: "from-green-600 to-green-500",
  },
  {
    title: "Theory Memorizer",
    description: "Tools to help you memorize key theories and facts.",
    path: "/theory-memorizer",
    icon: Brain,
    colorClasses: "from-purple-600 to-purple-500",
  },
  {
    title: "FlashCards",
    description: "Create and study with interactive flashcards.",
    path: "/flashcard",
    icon: BookOpen,
    colorClasses: "from-orange-600 to-orange-500",
  },
  {
    title: "MCQ Generator",
    description: "Test your knowledge with multiple-choice questions.",
    path: "/mcq",
    icon: Target,
    colorClasses: "from-red-600 to-red-500",
  },
  {
    title: "Subjective Qs",
    description: "Practice with subjective and long-form questions.",
    path: "/subjective",
    icon: Lightbulb,
    colorClasses: "from-yellow-500 to-yellow-600",
  },
  {
    title: "Image Generator",
    description: "Create images to visualize complex concepts.",
    path: "/image-generator",
    icon: ImageIcon,
    colorClasses: "from-pink-600 to-pink-500",
  },
  // ✨ NEW AI TUTOR CARD
  {
    title: "AI Tutor",
    description: "Talk with a personal AI teacher.",
    path: "/ai-tutor",
    icon: MessageSquare, // Using the MessageSquare icon
    colorClasses: "from-teal-600 to-teal-500",
  },
];


const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
              SP
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              AI Study Planner
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">
            Welcome to your <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">AI Study Hub</span>!
          </h1>
          <p className="text-muted-foreground">
            Select a tool to get started.
          </p>
        </div>

        {/* AI Study Tools Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6">AI Study Tools</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiTools.map((tool) => (
              <Card
                key={tool.path}
                className="cursor-pointer transition-all hover:shadow-[var(--shadow-elevated)] hover:scale-105 border-2"
                onClick={() => navigate(tool.path)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tool.colorClasses} flex items-center justify-center mb-4`}>
                    <tool.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;