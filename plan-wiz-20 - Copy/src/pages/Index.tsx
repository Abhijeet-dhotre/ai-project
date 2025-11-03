import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, Target, CheckCircle } from "lucide-react";

const Index = () => {
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
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Sign In
            </Button>
            <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90" onClick={() => navigate("/signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <section className="py-20 text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold">
              Plan Your Exam Success
              <br />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                With AI Power
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create personalized study plans, track your progress, and ace your exams with our intelligent planning system.
            </p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg px-8"
              onClick={() => navigate("/signup")}
            >
              Start Planning Now
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8"
              onClick={() => navigate("/login")}
            >
              Sign In
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4 p-6 rounded-lg bg-card/50 backdrop-blur-sm border-2 shadow-[var(--shadow-card)]">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold">Smart Planning</h3>
            <p className="text-muted-foreground">
              AI-powered exam plans tailored to your subjects and exam patterns
            </p>
          </div>

          <div className="text-center space-y-4 p-6 rounded-lg bg-card/50 backdrop-blur-sm border-2 shadow-[var(--shadow-card)]">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
              <Target className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold">Track Progress</h3>
            <p className="text-muted-foreground">
              Monitor your study progress and stay on track with your goals
            </p>
          </div>

          <div className="text-center space-y-4 p-6 rounded-lg bg-card/50 backdrop-blur-sm border-2 shadow-[var(--shadow-card)]">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold">Achieve Success</h3>
            <p className="text-muted-foreground">
              Boost your confidence and achieve better results with structured planning
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
