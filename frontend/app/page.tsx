import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, LayoutDashboard } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center px-4">
          <span className="font-semibold text-primary">RecruitOS</span>
        </div>
      </header>
      <main className="container mx-auto flex flex-col items-center justify-center px-4 py-24">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          RecruitOS
        </h1>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Calibrate job requirements and get an AI-scored leaderboard of candidates.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" className="gap-2">
            <Link href="/calibrate">
              <FileText className="h-4 w-4" />
              Calibrate
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
