import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  LayoutDashboard,
  Kanban,
  BarChart3,
  ChevronRight,
  Sparkles,
  Bell,
  Share2,
  Download,
} from "lucide-react";

const FEATURES = [
  {
    href: "/calibrate",
    icon: FileText,
    title: "Calibrate",
    description:
      "Define job requirements once—role, skills, experience, education, and ideal candidate. Structured configuration drives consistent scoring and pipeline for every requisition.",
  },
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Manage candidates per job. Upload PDF resumes, view AI-scored rankings, move stages, add ratings and notes. One card per requisition with full control.",
  },
  {
    href: "/pipeline",
    icon: Kanban,
    title: "Pipeline",
    description:
      "See applications by stage in a Kanban view. Drag cards or use Move to—Applied, Screening, Interview, Offer—so HR can track and advance candidates at a glance.",
  },
  {
    href: "/insights",
    icon: BarChart3,
    title: "Insights",
    description:
      "Hiring analytics by stage and by month. At-a-glance counts, pipeline distribution, trends table, and per-requisition breakdown. Filter by application date.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/90 via-background to-muted/70">
      <header className="sticky top-0 z-10 border-b border-border bg-header-bg backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="text-xl font-semibold text-primary">
            RecruitOS
          </Link>
          <nav className="flex gap-4">
            <Link href="/calibrate" className="text-base font-medium text-muted-foreground hover:text-foreground">
              Calibrate
            </Link>
            <Link href="/dashboard" className="text-base font-medium text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/pipeline" className="text-base font-medium text-muted-foreground hover:text-foreground">
              Pipeline
            </Link>
            <Link href="/insights" className="text-base font-medium text-muted-foreground hover:text-foreground">
              Insights
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Notifications">
              <Bell className="h-6 w-6" />
            </button>
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Share">
              <Share2 className="h-6 w-6" />
            </button>
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Download">
              <Download className="h-6 w-6" />
            </button>
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Report">
              <FileText className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center">
        <section className="w-full max-w-3xl px-4 pt-24 pb-20 text-center md:pt-32 md:pb-28">
          <div className="mx-auto max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-base font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              AI-assisted hiring
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              RecruitOS
            </h1>
            <p className="mt-5 text-xl leading-relaxed text-muted-foreground md:mt-6 md:text-2xl">
              Define jobs once. Score candidates. Move them through the pipeline. See hiring insights—all in one place.
            </p>
            <div className="mt-10 flex justify-center">
              <Button asChild size="lg" className="gap-2 shadow-sm">
                <Link href="/calibrate">
                  Get started
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="w-full max-w-6xl px-4 pb-28">
          <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight text-foreground md:mb-12">
            Features
          </h2>
          <div className="grid justify-center gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.href}
                  className="group flex flex-col border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                >
                  <CardContent className="flex flex-1 flex-col p-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 flex-1 text-base leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                    <div className="mt-5 flex justify-center">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-fit gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                      >
                        <Link href={feature.href}>
                          Open {feature.title}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <footer className="w-full border-t border-border bg-header-bg/70 py-8">
          <div className="container mx-auto px-4 text-center text-base text-muted-foreground">
            RecruitOS — job postings as structured config. Score, pipeline, and insights.
          </div>
        </footer>
      </main>
    </div>
  );
}
