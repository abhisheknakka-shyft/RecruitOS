"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  listCalibrations,
  listTemplates,
  getCandidates,
  getCandidateRankings,
  uploadResumes,
  deleteCalibration,
  deleteCandidate,
  updateCandidate,
  createFromTemplate,
  saveAsTemplate,
  type Calibration,
  type CandidateResult,
  type RankedCandidateResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DotScale } from "@/components/DotScale";
import { ScoreCircle } from "@/components/ScoreCircle";
import {
  Upload,
  LayoutDashboard,
  FileText,
  Loader2,
  Plus,
  Trash2,
  ArrowLeft,
  FileText as FileTextIcon,
  Pencil,
  Copy,
  Star,
  LayoutTemplate,
  GripVertical,
  Bell,
  Share2,
  Download,
} from "lucide-react";
import { createCalibration, type CalibrationCreate } from "@/lib/api";

/** Derive display name from first line of parsed text if it looks like a person name, else use filename name. */
function getDisplayNameFromParsedText(parsedText: string, fallbackName: string): string {
  const firstLine = parsedText.split(/\r?\n/)[0]?.trim() ?? "";
  const words = firstLine.split(/\s+/).filter((w) => /^[A-Za-z.-]+$/.test(w));
  if (words.length >= 2 && words.length <= 5 && firstLine.length < 50) return firstLine;
  return fallbackName;
}

/** Initials from name: only letters (first letter of first two letter-only words). */
function getInitialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /^[A-Za-z]+$/.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const a = words[0][0] ?? "";
  const b = words[words.length - 1][0] ?? "";
  return (a + b).toUpperCase().replace(/[^A-Z]/g, "") || "?";
}

function statusLabel(status: RankedCandidateResult["scoring"]["status"] | undefined): string {
  if (status === "processing") return "Scoring";
  if (status === "failed") return "Failed";
  if (status === "completed") return "Scored";
  return "Queued";
}

function statusClass(status: RankedCandidateResult["scoring"]["status"] | undefined): string {
  if (status === "completed") return "bg-primary text-primary-foreground";
  if (status === "failed") return "bg-destructive text-destructive-foreground";
  if (status === "processing") return "bg-amber-500 text-white";
  return "bg-muted text-muted-foreground";
}

type CandidateSortMode =
  | "overall"
  | "alphabetical"
  | "experience_years"
  | "skills"
  | "titles"
  | "work"
  | "education"
  | "experience"
  | "context";

const CANDIDATE_SORT_OPTIONS: Array<{ value: CandidateSortMode; label: string }> = [
  { value: "overall", label: "Rank by overall score" },
  { value: "skills", label: "Skill relevance score" },
  { value: "titles", label: "Title relevance score" },
  { value: "work", label: "Work relevance score" },
  { value: "education", label: "School relevance score" },
  { value: "experience", label: "Experience relevance score" },
  { value: "context", label: "JD/Ideal relevance score" },
  { value: "experience_years", label: "Years of experience" },
  { value: "alphabetical", label: "Alphabetical" },
];

function getSubMetricPoints(
  ranking: RankedCandidateResult | undefined,
  key: "skills" | "titles" | "work" | "education" | "experience" | "context"
): number {
  const metric = ranking?.scoring?.sub_metrics?.find((m) => m.key === key);
  return metric?.points_earned ?? -1;
}

function CondensedScoreCard({ ranking }: { ranking: RankedCandidateResult | undefined }) {
  if (!ranking) {
    return (
      <div className="space-y-1">
        <p className="text-base font-medium">Scoring not available</p>
        <p className="text-sm text-muted-foreground">No ranking payload found for this candidate yet.</p>
      </div>
    );
  }

  if (ranking.scoring.status !== "completed") {
    return (
      <div className="space-y-1">
        <p className="text-base font-medium">{statusLabel(ranking.scoring.status)}</p>
        <p className="text-sm text-muted-foreground">
          {ranking.scoring.status === "failed"
            ? ranking.scoring.error || "Scoring failed."
            : "Scoring is running asynchronously."}
        </p>
      </div>
    );
  }

  const subMetrics = Array.isArray(ranking.scoring.sub_metrics) ? ranking.scoring.sub_metrics : [];
  const matchedSkills = Array.isArray(ranking.scoring.matched_skills) ? ranking.scoring.matched_skills : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-medium">Candidate Match</p>
        <span className="text-base font-semibold text-primary">{ranking.scoring.total_score ?? 0}%</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {ranking.scoring.experience_years != null
          ? `${ranking.scoring.experience_years} yrs exp detected`
          : "Experience not confidently detected"}
      </p>
      <div className="space-y-2">
        {subMetrics.slice(0, 4).map((metric) => {
          const hoverText = [
            metric.rationale?.trim() || "No explanation available.",
            metric.matched_terms?.length
              ? ` Matched: ${metric.matched_terms.slice(0, 8).join(", ")}${metric.matched_terms.length > 8 ? "…" : ""}`
              : "",
          ]
            .join("")
            .trim();
          return (
            <div
              key={metric.key}
              className="space-y-1 cursor-help rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-muted/50 transition-colors"
              title={hoverText}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{metric.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {metric.points_earned}/{metric.points_possible}
                </p>
              </div>
              <DotScale rating={metric.rating} />
            </div>
          );
        })}
      </div>
      {matchedSkills.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Skills: {matchedSkills.slice(0, 4).join(", ")}
          {matchedSkills.length > 4 ? "..." : ""}
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [candidatesByCalibrationId, setCandidatesByCalibrationId] = useState<Record<string, CandidateResult[]>>({});
  const [rankingsByCalibrationId, setRankingsByCalibrationId] = useState<Record<string, RankedCandidateResult[]>>({});
  const [expandedCandidateByCalibrationId, setExpandedCandidateByCalibrationId] = useState<Record<string, string | null>>({});
  const [uploadingCalibrationId, setUploadingCalibrationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Calibration[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const fetchCalibrations = async () => {
    try {
      const list = await listCalibrations();
      setCalibrations(list);
      return list;
    } catch {
      setCalibrations([]);
      return [];
    }
  };

  const fetchCandidatesForCalibration = async (calibrationId: string) => {
    try {
      const cand = await getCandidates(calibrationId);
      setCandidatesByCalibrationId((prev) => ({ ...prev, [calibrationId]: cand }));
    } catch {
      setCandidatesByCalibrationId((prev) => ({ ...prev, [calibrationId]: [] }));
    }
  };

  const fetchRankingsForCalibration = useCallback(async (calibrationId: string, silent = false) => {
    try {
      const rankings = await getCandidateRankings(calibrationId);
      setRankingsByCalibrationId((prev) => ({ ...prev, [calibrationId]: rankings }));
    } catch (err) {
      setRankingsByCalibrationId((prev) => ({ ...prev, [calibrationId]: [] }));
      if (!silent) throw err;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCalibrations();
      await Promise.all(
        list.map(async (c) => {
          await Promise.all([fetchCandidatesForCalibration(c.id), fetchRankingsForCalibration(c.id, true)]);
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchRankingsForCalibration]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inFlightCalibrationIds = useMemo(() => {
    return calibrations
      .map((c) => c.id)
      .filter((id) =>
        (rankingsByCalibrationId[id] ?? []).some(
          (r) => r.scoring.status === "pending" || r.scoring.status === "processing"
        )
      );
  }, [calibrations, rankingsByCalibrationId]);

  useEffect(() => {
    if (inFlightCalibrationIds.length === 0) return;
    const timer = setInterval(() => {
      inFlightCalibrationIds.forEach((id) => {
        fetchRankingsForCalibration(id, true).catch(() => {});
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [inFlightCalibrationIds, fetchRankingsForCalibration]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>, calibrationId: string) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingCalibrationId(calibrationId);
    setError(null);
    try {
      const list = Array.from(files);
      const next = await uploadResumes(list, calibrationId);
      setCandidatesByCalibrationId((prev) => ({ ...prev, [calibrationId]: next }));
      await fetchRankingsForCalibration(calibrationId, true);
      const name = calibrations.find((c) => c.id === calibrationId)?.requisition_name ?? "Job";
      setSuccessMessage(
        list.length > 0
          ? `${list.length} resume${list.length === 1 ? "" : "s"} queued for scoring in ${name}`
          : "No new resumes added (only PDFs under 15MB are accepted)"
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      if (message.includes("not found") || message.includes("restarted")) {
        fetchData();
      }
    } finally {
      setUploadingCalibrationId(null);
      e.target.value = "";
    }
  };

  const setExpandedCandidate = (calibrationId: string, candidateId: string | null) => {
    setExpandedCandidateByCalibrationId((prev) => ({ ...prev, [calibrationId]: candidateId }));
  };

  const onDeleteCandidate = async (calibrationId: string, candidateId: string) => {
    setError(null);
    setDeletingCandidateId(candidateId);
    try {
      await deleteCandidate(calibrationId, candidateId);
      setCandidatesByCalibrationId((prev) => ({
        ...prev,
        [calibrationId]: (prev[calibrationId] ?? []).filter((c) => c.id !== candidateId),
      }));
      setRankingsByCalibrationId((prev) => ({
        ...prev,
        [calibrationId]: (prev[calibrationId] ?? []).filter((c) => c.id !== candidateId),
      }));
      setExpandedCandidateByCalibrationId((prev) =>
        prev[calibrationId] === candidateId ? { ...prev, [calibrationId]: null } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove resume");
    } finally {
      setDeletingCandidateId(null);
    }
  };

  const onUpdateCandidate = async (
    calibrationId: string,
    candidateId: string,
    update: { stage?: string; rating?: number; notes?: string }
  ) => {
    setError(null);
    try {
      const updated = await updateCandidate(calibrationId, candidateId, update);
      setCandidatesByCalibrationId((prev) => ({
        ...prev,
        [calibrationId]: (prev[calibrationId] ?? []).map((c) => (c.id === candidateId ? updated : c)),
      }));
      setRankingsByCalibrationId((prev) => ({
        ...prev,
        [calibrationId]: (prev[calibrationId] ?? []).map((c) =>
          c.id === candidateId ? { ...c, stage: updated.stage, rating: updated.rating, notes: updated.notes } : c
        ),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleCreateFromTemplate = async (templateId: string, requisitionName: string) => {
    setError(null);
    try {
      const created = await createFromTemplate(templateId, requisitionName || undefined);
      setCalibrations((prev) => [created, ...prev]);
      setCandidatesByCalibrationId((prev) => ({ ...prev, [created.id]: [] }));
      setRankingsByCalibrationId((prev) => ({ ...prev, [created.id]: [] }));
      setTemplateModalOpen(false);
      setSuccessMessage(`Job "${created.requisition_name}" created from template`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create from template");
    }
  };

  const handleSaveAsTemplate = async (calibrationId: string) => {
    setError(null);
    try {
      await saveAsTemplate(calibrationId);
      const list = await listTemplates();
      setTemplates(list);
      setSuccessMessage("Saved as template");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save as template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job posting? Its candidates will be removed.")) return;
    setError(null);
    try {
      await deleteCalibration(id);
      await fetchCalibrations();
      setCandidatesByCalibrationId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setRankingsByCalibrationId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedCandidateByCalibrationId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleCopyCalibration = async (cal: Calibration) => {
    setError(null);
    try {
      const body: CalibrationCreate = {
        requisition_name: cal.requisition_name + " (Copy)",
        role: cal.role,
        location: cal.location,
        job_description: cal.job_description ?? "",
        hiring_company: cal.hiring_company ?? "",
        job_locations: cal.job_locations ?? [],
        job_titles: cal.job_titles ?? [],
        companies: cal.companies ?? [],
        industries: cal.industries ?? [],
        ideal_candidate: cal.ideal_candidate ?? "",
        skills: cal.skills ?? [],
        years_experience_min: cal.years_experience_min ?? 0,
        years_experience_max: cal.years_experience_max ?? 30,
        years_experience_type: cal.years_experience_type ?? "total",
        seniority_levels: cal.seniority_levels ?? [],
        schools: cal.schools ?? [],
        degrees: cal.degrees ?? [],
        graduation_year_min: cal.graduation_year_min ?? undefined,
        graduation_year_max: cal.graduation_year_max ?? undefined,
        relocation_allowed: cal.relocation_allowed ?? false,
        workplace_type: cal.workplace_type ?? "",
        exclude_short_tenure: cal.exclude_short_tenure ?? "none",
      };
      const created = await createCalibration(body);
      setCalibrations((prev) => [created, ...prev]);
      setCandidatesByCalibrationId((prev) => ({ ...prev, [created.id]: [] }));
      setRankingsByCalibrationId((prev) => ({ ...prev, [created.id]: [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy");
    }
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
            <Link href="/dashboard" className="text-lg font-medium text-primary underline underline-offset-4">
              Dashboard
            </Link>
            <Link href="/pipeline" className="text-lg font-medium text-muted-foreground hover:text-foreground">
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
              <FileTextIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
            Job postings
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                setTemplateModalOpen(true);
                try {
                  const list = await listTemplates();
                  setTemplates(list);
                } catch {
                  setTemplates([]);
                }
              }}
            >
              <LayoutTemplate className="h-4 w-4" />
              Create from template
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link href="/calibrate">
                <Plus className="h-4 w-4" />
                Add job posting
              </Link>
            </Button>
          </div>
        </div>

        {templateModalOpen && (
          <TemplateModal
            templates={templates}
            onClose={() => setTemplateModalOpen(false)}
            onCreate={handleCreateFromTemplate}
          />
        )}

        <div className="space-y-6">
          {calibrations.map((cal) => (
            <JobCard
              key={cal.id}
              calibration={cal}
              candidates={candidatesByCalibrationId[cal.id] ?? []}
              rankings={rankingsByCalibrationId[cal.id] ?? []}
              expandedCandidateId={expandedCandidateByCalibrationId[cal.id] ?? null}
              uploading={uploadingCalibrationId === cal.id}
              deletingCandidateId={deletingCandidateId}
              onUpload={(e) => onUpload(e, cal.id)}
              onDeleteJob={() => handleDelete(cal.id)}
              onCopy={() => handleCopyCalibration(cal)}
              onSaveAsTemplate={() => handleSaveAsTemplate(cal.id)}
              onExpandCandidate={(candidateId) => setExpandedCandidate(cal.id, candidateId)}
              onCollapseCandidate={() => setExpandedCandidate(cal.id, null)}
              onDeleteCandidate={(candidateId) => onDeleteCandidate(cal.id, candidateId)}
              onUpdateCandidate={(candidateId, update) => onUpdateCandidate(cal.id, candidateId, update)}
            />
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-base text-destructive">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            {successMessage}
          </div>
        )}

        {calibrations.length === 0 && !error && (
          <Card className="border-dashed border-border/80 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground/70" />
              <p className="text-muted-foreground">No job postings yet.</p>
              <Button asChild className="mt-5" size="sm">
                <Link href="/calibrate">Add job posting</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function TemplateModal({
  templates,
  onClose,
  onCreate,
}: {
  templates: Calibration[];
  onClose: () => void;
  onCreate: (templateId: string, requisitionName: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">Create job from template</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet. Save a job as template from its card.</p>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-base font-medium">Template</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-base"
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) setName(t.requisition_name.replace(/^Template: /i, ""));
                  }}
                >
                  <option value="">Select…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.requisition_name} ({t.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-base font-medium">Job title</label>
                <input
                  type="text"
                  className="w-full rounded-md border bg-background px-3 py-2 text-base"
                  placeholder="e.g. Senior Data Engineer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!selectedId || !name.trim()}
                  onClick={() => onCreate(selectedId, name.trim())}
                >
                  Create job
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobCard({
  calibration,
  candidates,
  rankings,
  expandedCandidateId,
  uploading,
  deletingCandidateId,
  onUpload,
  onDeleteJob,
  onCopy,
  onSaveAsTemplate,
  onExpandCandidate,
  onCollapseCandidate,
  onDeleteCandidate,
  onUpdateCandidate,
}: {
  calibration: Calibration;
  candidates: CandidateResult[];
  rankings: RankedCandidateResult[];
  expandedCandidateId: string | null;
  uploading: boolean;
  deletingCandidateId: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteJob: () => void;
  onCopy: () => void;
  onSaveAsTemplate: () => void;
  onExpandCandidate: (candidateId: string) => void;
  onCollapseCandidate: () => void;
  onDeleteCandidate: (candidateId: string) => void;
  onUpdateCandidate: (candidateId: string, update: { stage?: string; rating?: number; notes?: string }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localNotes, setLocalNotes] = useState("");
  const [hoveredScoreCandidateId, setHoveredScoreCandidateId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<CandidateSortMode>("overall");
  const [manualOverride, setManualOverride] = useState(false);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rankingByCandidateId = useMemo(() => {
    return new Map(rankings.map((r) => [r.id, r]));
  }, [rankings]);

  useEffect(() => {
    try {
      const savedSort = localStorage.getItem(`recruitos:dashboard:sort:${calibration.id}`);
      if (savedSort) {
        // Backward compatibility with previous sort keys.
        if (savedSort === "score") setSortMode("overall");
        else if (savedSort === "alpha") setSortMode("alphabetical");
        else if (CANDIDATE_SORT_OPTIONS.some((opt) => opt.value === savedSort)) setSortMode(savedSort as CandidateSortMode);
      }
      const savedManualOverride = localStorage.getItem(`recruitos:dashboard:manual-override:${calibration.id}`);
      setManualOverride(savedManualOverride === "1");
      const savedOrder = localStorage.getItem(`recruitos:dashboard:manual-order:${calibration.id}`);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as string[];
        if (Array.isArray(parsed)) setManualOrder(parsed.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      // ignore storage errors
    }
  }, [calibration.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`recruitos:dashboard:sort:${calibration.id}`, sortMode);
    } catch {
      // ignore storage errors
    }
  }, [calibration.id, sortMode]);

  useEffect(() => {
    try {
      localStorage.setItem(`recruitos:dashboard:manual-override:${calibration.id}`, manualOverride ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [calibration.id, manualOverride]);

  useEffect(() => {
    try {
      localStorage.setItem(`recruitos:dashboard:manual-order:${calibration.id}`, JSON.stringify(manualOrder));
    } catch {
      // ignore storage errors
    }
  }, [calibration.id, manualOrder]);

  useEffect(() => {
    const ids = candidates.map((c) => c.id);
    setManualOrder((prev) => {
      const seen = new Set<string>();
      const existing: string[] = [];
      for (const id of prev) {
        if (ids.includes(id) && !seen.has(id)) {
          seen.add(id);
          existing.push(id);
        }
      }
      const appended = ids.filter((id) => !seen.has(id));
      return [...existing, ...appended];
    });
  }, [candidates]);

  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const sortedBySelectedSort = useMemo(() => {
    if (sortMode === "alphabetical") {
      return [...candidates].sort((a, b) =>
        getDisplayNameFromParsedText(a.parsed_text, a.name).localeCompare(
          getDisplayNameFromParsedText(b.parsed_text, b.name)
        )
      );
    }

    const scoreOf = (candidate: CandidateResult): number => {
      const ranking = rankingByCandidateId.get(candidate.id);
      if (!ranking) return -1;
      if (sortMode === "overall") return ranking.scoring.total_score ?? -1;
      if (sortMode === "experience_years") return ranking.scoring.experience_years ?? -1;
      return getSubMetricPoints(ranking, sortMode);
    };

    return [...candidates].sort((a, b) => {
      const aScore = scoreOf(a);
      const bScore = scoreOf(b);
      if (aScore !== bScore) return bScore - aScore;
      const overallA = rankingByCandidateId.get(a.id)?.scoring.total_score ?? -1;
      const overallB = rankingByCandidateId.get(b.id)?.scoring.total_score ?? -1;
      if (overallA !== overallB) return overallB - overallA;
      return getDisplayNameFromParsedText(a.parsed_text, a.name).localeCompare(
        getDisplayNameFromParsedText(b.parsed_text, b.name)
      );
    });
  }, [candidates, rankingByCandidateId, sortMode]);

  const sortedCandidates = useMemo(() => {
    if (!manualOverride) return sortedBySelectedSort;
    const seen = new Set<string>();
    const ordered = manualOrder
      .map((id) => candidateById.get(id))
      .filter((candidate): candidate is CandidateResult => Boolean(candidate))
      .filter((candidate) => {
        if (seen.has(candidate.id)) return false;
        seen.add(candidate.id);
        return true;
      });
    const missing = sortedBySelectedSort.filter((candidate) => !seen.has(candidate.id));
    return [...ordered, ...missing];
  }, [manualOverride, sortedBySelectedSort, manualOrder, candidateById]);

  const expandedCandidate = expandedCandidateId
    ? sortedCandidates.find((c) => c.id === expandedCandidateId) ?? null
    : null;
  const expandedRanking = expandedCandidate ? rankingByCandidateId.get(expandedCandidate.id) ?? null : null;

  useEffect(() => {
    if (expandedCandidate) setLocalNotes(expandedCandidate.notes ?? "");
  }, [expandedCandidate]);

  const stages = calibration.pipeline_stages?.length
    ? calibration.pipeline_stages
    : ["Applied", "Screening", "Interview", "Offer"];

  useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    };
  }, []);

  const openScorePopover = (candidateId: string) => {
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    setHoveredScoreCandidateId(candidateId);
  };

  const closeScorePopover = (candidateId: string) => {
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoveredScoreCandidateId((prev) => (prev === candidateId ? null : prev));
    }, 120);
  };

  const onDropCandidate = (targetId: string) => {
    if (!draggedCandidateId || draggedCandidateId === targetId) return;
    const currentOrderIds = sortedCandidates.map((candidate) => candidate.id);
    const next = currentOrderIds.filter((id) => id !== draggedCandidateId);
    const targetIndex = next.indexOf(targetId);
    if (targetIndex < 0) {
      next.push(draggedCandidateId);
    } else {
      next.splice(targetIndex, 0, draggedCandidateId);
    }
    setManualOrder(next);
    setManualOverride(true);
    setDraggedCandidateId(null);
  };

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold leading-tight tracking-tight text-foreground">
              {calibration.requisition_name}
            </CardTitle>
            <p className="mt-1 text-base text-muted-foreground">{calibration.role}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 p-0.5">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
              <Link href={`/calibrate?edit=${encodeURIComponent(calibration.id)}`} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onCopy} aria-label="Make a copy">
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onSaveAsTemplate} aria-label="Save as template">
              <LayoutTemplate className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDeleteJob} aria-label="Delete job">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={onUpload} />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload resumes
          </Button>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <label className="text-sm font-medium text-muted-foreground">Sort</label>
            <select
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value as CandidateSortMode);
                setManualOverride(false);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CANDIDATE_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {manualOverride && (
              <Button type="button" size="sm" variant="ghost" className="h-9 text-sm" onClick={() => setManualOverride(false)}>
                Use sort order
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20">
          <p className="border-b border-border/60 px-4 py-3 text-base font-medium text-muted-foreground">
            Candidates ({candidates.length})
          </p>
          {expandedCandidate ? (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onCollapseCandidate}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to list
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={deletingCandidateId === expandedCandidate.id}
                  onClick={() => {
                    if (confirm("Remove this resume from this job?")) onDeleteCandidate(expandedCandidate.id);
                  }}
                >
                  {deletingCandidateId === expandedCandidate.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove resume
                </Button>
              </div>

              <h3 className="font-medium">{getDisplayNameFromParsedText(expandedCandidate.parsed_text, expandedCandidate.name)}</h3>

              {expandedRanking && (
                <p className="text-sm text-muted-foreground">
                  Hover the score badge in the candidate list for condensed scoring details.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Stage</label>
                  <select
                    className="rounded border bg-background px-2 py-1 text-base"
                    value={expandedCandidate.stage ?? stages[0]}
                    onChange={(e) => onUpdateCandidate(expandedCandidate.id, { stage: e.target.value })}
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Rating (1–5)</label>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => onUpdateCandidate(expandedCandidate.id, { rating: r })}
                        aria-label={`${r} star`}
                      >
                        <Star className={`h-5 w-5 ${(expandedCandidate.rating ?? 0) >= r ? "fill-primary text-primary" : ""}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Notes (saved on blur)</label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-base"
                  placeholder="Private notes…"
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={() => onUpdateCandidate(expandedCandidate.id, { notes: localNotes })}
                />
              </div>

              <pre className="max-h-[50vh] overflow-auto rounded-md border bg-background p-4 text-base whitespace-pre-wrap font-sans">
                {expandedCandidate.parsed_text || "(No text extracted)"}
              </pre>
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-4 py-8 text-center text-base text-muted-foreground">No resumes yet. Upload PDFs above.</p>
          ) : (
            <ul className="divide-y">
              {sortedCandidates.map((c) => {
                const displayName = getDisplayNameFromParsedText(c.parsed_text, c.name);
                const initials = getInitialsFromName(displayName);
                const isDeleting = deletingCandidateId === c.id;
                const ranking = rankingByCandidateId.get(c.id);
                const score = ranking?.scoring.total_score;
                return (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggedCandidateId(c.id)}
                    onDragEnd={() => setDraggedCandidateId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      onDropCandidate(c.id);
                    }}
                    className={draggedCandidateId === c.id ? "opacity-60" : ""}
                  >
                    <div className="flex items-center gap-2 p-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <button
                        type="button"
                        className="-m-2 flex min-w-0 flex-1 items-center gap-4 rounded-md p-2 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                        onClick={() => onExpandCandidate(c.id)}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate font-medium text-foreground">{displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {c.stage ?? stages[0]}
                            {(c.rating ?? 0) > 0 && ` · ${c.rating}/5`}
                          </p>
                        </div>
                        <Popover open={hoveredScoreCandidateId === c.id}>
                          <PopoverTrigger asChild>
                            <div
                              className="shrink-0"
                              onMouseEnter={() => openScorePopover(c.id)}
                              onMouseLeave={() => closeScorePopover(c.id)}
                            >
                              {score != null ? (
                                <ScoreCircle score={score} size={44} />
                              ) : (
                                <span className={`rounded px-2 py-0.5 text-sm ${statusClass(ranking?.scoring.status)}`}>
                                  {statusLabel(ranking?.scoring.status)}
                                </span>
                              )}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-64"
                            side="top"
                            align="end"
                            onMouseEnter={() => openScorePopover(c.id)}
                            onMouseLeave={() => closeScorePopover(c.id)}
                          >
                            <CondensedScoreCard ranking={ranking} />
                          </PopoverContent>
                        </Popover>
                        <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                      <select
                        className="w-28 shrink-0 rounded border bg-background px-2 py-1 text-sm"
                        value={c.stage ?? stages[0]}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          onUpdateCandidate(c.id, { stage: e.target.value });
                        }}
                      >
                        {stages.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Remove this resume from this job?")) onDeleteCandidate(c.id);
                        }}
                        aria-label="Remove resume"
                      >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
