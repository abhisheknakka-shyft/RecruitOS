"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  listCalibrations,
  listTemplates,
  getCandidates,
  uploadResumes,
  deleteCalibration,
  deleteCandidate,
  updateCandidate,
  createFromTemplate,
  saveAsTemplate,
  type Calibration,
  type CandidateResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function DashboardPage() {
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [candidatesByCalibrationId, setCandidatesByCalibrationId] = useState<Record<string, CandidateResult[]>>({});
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCalibrations();
      await Promise.all(list.map((c) => fetchCandidatesForCalibration(c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>, calibrationId: string) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingCalibrationId(calibrationId);
    setError(null);
    try {
      const list = Array.from(files);
      const next = await uploadResumes(list, calibrationId);
      setCandidatesByCalibrationId((prev) => ({ ...prev, [calibrationId]: next }));
      const name = calibrations.find((c) => c.id === calibrationId)?.requisition_name ?? "Job";
      setSuccessMessage(
        next.length > 0
          ? `${next.length} resume${next.length === 1 ? "" : "s"} added to ${name}`
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
      const list = await fetchCalibrations();
      setCandidatesByCalibrationId((prev) => {
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
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="font-semibold text-primary">
            RecruitOS
          </Link>
          <nav className="flex gap-4">
            <Link href="/calibrate" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Calibrate
            </Link>
            <Link href="/dashboard" className="text-sm font-medium text-primary underline">
              Dashboard
            </Link>
            <Link href="/pipeline" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Pipeline
            </Link>
            <Link href="/insights" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Insights
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboard className="h-6 w-6" />
            Job postings
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
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
            <Button asChild className="gap-2">
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
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {successMessage && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm text-foreground">{successMessage}</p>
            </CardContent>
          </Card>
        )}

        {calibrations.length === 0 && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No job postings yet.</p>
              <Button asChild className="mt-4">
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
          <CardTitle className="text-lg">Create job from template</CardTitle>
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
                <label className="mb-1 block text-sm font-medium">Template</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
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
                <label className="mb-1 block text-sm font-medium">Job title</label>
                <input
                  type="text"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
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
  const expandedCandidate = expandedCandidateId ? candidates.find((c) => c.id === expandedCandidateId) ?? null : null;
  useEffect(() => {
    if (expandedCandidate) setLocalNotes(expandedCandidate.notes ?? "");
  }, [expandedCandidate?.id, expandedCandidate?.notes]);
  const stages = calibration.pipeline_stages?.length ? calibration.pipeline_stages : ["Applied", "Screening", "Interview", "Offer"];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium leading-tight">
            {calibration.requisition_name}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-0">
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
        <p className="text-sm text-muted-foreground">{calibration.role}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={onUpload}
        />
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload resumes
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/30">
          <p className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">
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
              <h3 className="font-medium">
                {getDisplayNameFromParsedText(expandedCandidate.parsed_text, expandedCandidate.name)}
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Stage</label>
                  <select
                    className="rounded border bg-background px-2 py-1 text-sm"
                    value={expandedCandidate.stage ?? stages[0]}
                    onChange={(e) => onUpdateCandidate(expandedCandidate.id, { stage: e.target.value })}
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Rating (1–5)</label>
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (saved on blur)</label>
                <textarea
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Private notes…"
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={() => onUpdateCandidate(expandedCandidate.id, { notes: localNotes })}
                />
              </div>
              <pre className="max-h-[50vh] overflow-auto rounded-md border bg-background p-4 text-sm whitespace-pre-wrap font-sans">
                {expandedCandidate.parsed_text || "(No text extracted)"}
              </pre>
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No resumes yet. Upload PDFs above.
            </p>
          ) : (
            <ul className="divide-y">
              {candidates.map((c) => {
                const displayName = getDisplayNameFromParsedText(c.parsed_text, c.name);
                const initials = getInitialsFromName(displayName);
                const isDeleting = deletingCandidateId === c.id;
                return (
                  <li key={c.id}>
                    <div className="flex items-center gap-2 p-4">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset rounded-md p-2 -m-2"
                        onClick={() => onExpandCandidate(c.id)}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-medium text-foreground truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.stage ?? stages[0]}
                            {(c.rating ?? 0) > 0 && ` · ${c.rating}/5`}
                          </p>
                        </div>
                        <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                      <select
                        className="rounded border bg-background px-2 py-1 text-xs w-28 shrink-0"
                        value={c.stage ?? stages[0]}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          onUpdateCandidate(c.id, { stage: e.target.value });
                        }}
                      >
                        {stages.map((s) => (
                          <option key={s} value={s}>{s}</option>
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
