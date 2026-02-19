"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  listCalibrations,
  getCandidates,
  updateCandidate,
  type Calibration,
  type CandidateResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Kanban,
  Loader2,
  Star,
  CheckSquare,
  Bell,
  Share2,
  Download,
  FileText,
  ClipboardList,
  Phone,
  Gift,
  ChevronDown,
  MoreHorizontal,
  ArrowRightCircle,
  GripVertical,
} from "lucide-react";

const STAGE_STYLES: Record<string, { bg: string; header: string; border: string; icon: React.ReactNode }> = {
  Applied: {
    bg: "bg-violet-50 dark:bg-violet-950/20",
    header: "bg-violet-500 text-white",
    border: "border-t-violet-500",
    icon: <CheckSquare className="h-4 w-4" />,
  },
  Screening: {
    bg: "bg-sky-50 dark:bg-sky-950/20",
    header: "bg-sky-500 text-white",
    border: "border-t-sky-500",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  Interview: {
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    header: "bg-emerald-500 text-white",
    border: "border-t-emerald-500",
    icon: <Phone className="h-4 w-4" />,
  },
  Offer: {
    bg: "bg-amber-50 dark:bg-amber-950/20",
    header: "bg-amber-500 text-white",
    border: "border-t-amber-500",
    icon: <Gift className="h-4 w-4" />,
  },
  Rejected: {
    bg: "bg-red-50 dark:bg-red-950/20",
    header: "bg-red-500 text-white",
    border: "border-t-red-500",
    icon: <span className="text-lg leading-none">✕</span>,
  },
};

function getStageStyle(stage: string) {
  return STAGE_STYLES[stage] ?? STAGE_STYLES.Applied;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /^[A-Za-z]+$/.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const a = words[0][0] ?? "";
  const b = words[words.length - 1][0] ?? "";
  return (a + b).toUpperCase().replace(/[^A-Z]/g, "") || "?";
}

const DRAGGABLE_PREFIX = "cand-";
const DROPPABLE_PREFIX = "col-";
function draggableId(jobId: string, candidateId: string) {
  return `${DRAGGABLE_PREFIX}${jobId}-${candidateId}`;
}
function droppableId(jobId: string, stage: string) {
  return `${DROPPABLE_PREFIX}${jobId}-${stage}`;
}
function parseDraggableId(id: string): { jobId: string; candidateId: string } | null {
  if (!id.startsWith(DRAGGABLE_PREFIX)) return null;
  const rest = id.slice(DRAGGABLE_PREFIX.length);
  const i = rest.indexOf("-");
  if (i <= 0) return null;
  return { jobId: rest.slice(0, i), candidateId: rest.slice(i + 1) };
}
function parseDroppableId(id: string): { jobId: string; stage: string } | null {
  if (!id.startsWith(DROPPABLE_PREFIX)) return null;
  const rest = id.slice(DROPPABLE_PREFIX.length);
  const i = rest.lastIndexOf("-");
  if (i <= 0) return null;
  return { jobId: rest.slice(0, i), stage: rest.slice(i + 1) };
}

function DroppableColumn({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? "ring-2 ring-primary/50 ring-inset rounded-b-xl" : ""}`}
    >
      {children}
    </div>
  );
}

export default function PipelinePage() {
  const [jobs, setJobs] = useState<Calibration[]>([]);
  const [candidatesByJobId, setCandidatesByJobId] = useState<Record<string, CandidateResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listCalibrations();
      setJobs(list);
      const byId: Record<string, CandidateResult[]> = {};
      await Promise.all(
        list.map(async (job) => {
          const cand = await getCandidates(job.id);
          byId[job.id] = cand;
        })
      );
      setCandidatesByJobId(byId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMoveStage = async (jobId: string, candidateId: string, stage: string) => {
    setError(null);
    try {
      const updated = await updateCandidate(jobId, candidateId, { stage });
      setCandidatesByJobId((prev) => ({
        ...prev,
        [jobId]: (prev[jobId] ?? []).map((c) => (c.id === candidateId ? updated : c)),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stage");
    }
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const a = parseDraggableId(e.active.id as string);
    const over = e.over?.id as string | undefined;
    const b = over ? parseDroppableId(over) : null;
    if (!a || !b || a.jobId !== b.jobId) return;
    const candidates = candidatesByJobId[a.jobId] ?? [];
    const cand = candidates.find((c) => c.id === a.candidateId);
    const currentStage = cand?.stage ?? jobs.find((j) => j.id === a.jobId)?.pipeline_stages?.[0] ?? "Applied";
    if (b.stage !== currentStage) await handleMoveStage(a.jobId, a.candidateId, b.stage);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b border-border bg-header-bg backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="text-xl font-semibold text-primary">
            RecruitOS
          </Link>
          <nav className="flex gap-4">
            <Link href="/calibrate" className="text-lg font-medium text-muted-foreground hover:text-foreground">
              Calibrate
            </Link>
            <Link href="/dashboard" className="text-lg font-medium text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/pipeline" className="text-lg font-medium text-primary underline underline-offset-4">
              Pipeline
            </Link>
            <Link href="/insights" className="text-lg font-medium text-muted-foreground hover:text-foreground">
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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Kanban className="h-6 w-6" />
          <h1 className="text-3xl font-semibold">Track applications</h1>
        </div>
        <p className="mb-6 text-base text-muted-foreground">
          See where each candidate is. Drag cards between columns or use <strong>Move to →</strong> to change stage.
        </p>

        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-base text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground">No job postings yet.</p>
              <Button asChild className="mt-4">
                <Link href="/calibrate">Add job posting</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="space-y-12">
              {jobs.map((job) => {
                const stages = job.pipeline_stages?.length ? job.pipeline_stages : ["Applied", "Screening", "Interview", "Offer"];
                const candidates = candidatesByJobId[job.id] ?? [];
                const byStage = stages.reduce<Record<string, CandidateResult[]>>((acc, s) => {
                  acc[s] = candidates.filter((c) => (c.stage ?? stages[0]) === s);
                  return acc;
                }, {});

                return (
                  <div key={job.id}>
                    <div className="mb-4">
                      <h2 className="text-2xl font-semibold text-foreground">{job.requisition_name}</h2>
                      <p className="text-base text-muted-foreground">{job.role}</p>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {stages.map((stage) => {
                        const style = getStageStyle(stage);
                        const list = byStage[stage] ?? [];
                        return (
                          <div
                            key={stage}
                            className={`flex w-72 shrink-0 flex-col rounded-t-xl ${style.bg} min-h-[320px]`}
                          >
                            <div className={`flex items-center justify-between gap-2 rounded-t-xl px-4 py-3 ${style.header}`}>
                              <div className="flex items-center gap-2">
                                {style.icon}
                                <span className="font-semibold">{stage}</span>
                                <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-medium">
                                  {list.length}
                                </span>
                              </div>
                              <button type="button" className="rounded p-1 hover:bg-white/20" aria-label="Options">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </div>
                            <DroppableColumn
                              id={droppableId(job.id, stage)}
                              className="flex flex-1 flex-col gap-3 overflow-y-auto p-3"
                            >
                              {list.map((c) => (
                                <DraggableKanbanCard
                                  key={c.id}
                                  jobId={job.id}
                                  candidate={c}
                                  stages={stages}
                                  currentStage={c.stage ?? stages[0]}
                                  stageBorderColor={style.border}
                                  onMove={(s) => handleMoveStage(job.id, c.id, s)}
                                  getInitials={getInitials}
                                />
                              ))}
                              <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-white/50 py-6 dark:bg-black/5">
                                <p className="text-center text-sm text-muted-foreground">Add candidate via Dashboard</p>
                              </div>
                            </DroppableColumn>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeId ? (() => {
                const parsed = parseDraggableId(activeId);
                if (!parsed) return null;
                const list = candidatesByJobId[parsed.jobId] ?? [];
                const cand = list.find((c) => c.id === parsed.candidateId);
                const job = jobs.find((j) => j.id === parsed.jobId);
                if (!cand || !job) return null;
                const stages = job.pipeline_stages?.length ? job.pipeline_stages : ["Applied", "Screening", "Interview", "Offer"];
                const stage = cand.stage ?? stages[0];
                const style = getStageStyle(stage);
                return (
                  <div className={`cursor-grabbing rounded-xl border border-border/80 bg-white py-4 pl-4 pr-3 shadow-xl dark:bg-card opacity-95 rotate-2 scale-105 border-t-4 ${style.border}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
                        {getInitials(cand.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{cand.name}</p>
                        <p className="text-sm text-muted-foreground">Resume</p>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })() : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
    </div>
  );
}

function DraggableKanbanCard({
  jobId,
  candidate,
  stages,
  currentStage,
  stageBorderColor,
  onMove,
  getInitials,
}: {
  jobId: string;
  candidate: CandidateResult;
  stages: string[];
  currentStage: string;
  stageBorderColor: string;
  onMove: (stage: string) => void;
  getInitials: (name: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId(jobId, candidate.id),
    data: { candidate },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
      <CandidateKanbanCard
        dragHandle={<button type="button" className="touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing" {...listeners} {...attributes} aria-label="Drag to move"><GripVertical className="h-4 w-4" /></button>}
        candidate={candidate}
        stages={stages}
        currentStage={currentStage}
        stageBorderColor={stageBorderColor}
        onMove={onMove}
        getInitials={getInitials}
      />
    </div>
  );
}

function CandidateKanbanCard({
  candidate,
  stages,
  currentStage,
  stageBorderColor,
  onMove,
  getInitials,
  dragHandle,
}: {
  candidate: CandidateResult;
  stages: string[];
  currentStage: string;
  stageBorderColor: string;
  onMove: (stage: string) => void;
  getInitials: (name: string) => string;
  dragHandle?: React.ReactNode;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const otherStages = stages.filter((s) => s !== currentStage);

  return (
    <div
      className={`group relative rounded-xl border border-border/80 bg-white py-4 pl-4 pr-3 shadow-md transition-all hover:shadow-lg dark:bg-card ${stageBorderColor} border-t-4`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
          {getInitials(candidate.name)}
        </div>
        {dragHandle && <div className="shrink-0">{dragHandle}</div>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{candidate.name}</p>
          <p className="text-sm text-muted-foreground">Resume</p>
          {(candidate.rating ?? 0) > 0 && (
            <div className="mt-2">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <Star className="h-3 w-3 fill-current" />
                {candidate.rating}/5
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="relative">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/80 py-2 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setMoveOpen(!moveOpen)}
            aria-label="Move to stage"
          >
            <ArrowRightCircle className="h-4 w-4" />
            Move to
            <ChevronDown className="h-4 w-4" />
          </button>
          {moveOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                aria-label="Close"
                onClick={() => setMoveOpen(false)}
              />
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border bg-card py-1 shadow-lg" role="menu">
                {otherStages.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-base hover:bg-muted"
                    onClick={() => {
                      onMove(s);
                      setMoveOpen(false);
                    }}
                  >
                    → {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
