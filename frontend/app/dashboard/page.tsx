"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  getCalibration,
  listCalibrations,
  getCandidates,
  setActiveCalibration,
  uploadResumes,
  deleteCalibration,
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
  const [activeCalibration, setActiveCalibrationState] = useState<Calibration | null>(null);
  const [selectedCalibrationId, setSelectedCalibrationId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetCalibrationIdRef = useRef<string | null>(null);

  const selectedCandidate = selectedCandidateId
    ? candidates.find((c) => c.id === selectedCandidateId) ?? null
    : null;

  const selectedCalibration =
    selectedCalibrationId
      ? calibrations.find((c) => c.id === selectedCalibrationId) ?? null
      : activeCalibration;

  const fetchCalibrationsAndActive = async () => {
    try {
      const [list, active] = await Promise.all([listCalibrations(), getCalibration()]);
      setCalibrations(list);
      let resolvedActive = active ?? null;
      if (list.length > 0 && !resolvedActive) {
        try {
          await setActiveCalibration(list[0].id);
          resolvedActive = list[0];
        } catch {
          // ignore
        }
      }
      setActiveCalibrationState(resolvedActive);
      if (!selectedCalibrationId) {
        setSelectedCalibrationId(resolvedActive?.id ?? list[0]?.id ?? null);
      }
    } catch {
      setCalibrations([]);
      setActiveCalibrationState(null);
    }
  };

  const fetchCandidates = async (calibrationId: string | null) => {
    if (!calibrationId) {
      setCandidates([]);
      return;
    }
    try {
      const cand = await getCandidates(calibrationId);
      setCandidates(cand);
    } catch {
      setCandidates([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchCalibrationsAndActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCalibrationId) fetchCandidates(selectedCalibrationId);
    else setCandidates([]);
  }, [selectedCalibrationId]);

  const switchCalibration = (id: string) => {
    setSelectedCalibrationId(id);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const targetId = uploadTargetCalibrationIdRef.current;
    if (!files?.length) {
      uploadTargetCalibrationIdRef.current = null;
      return;
    }
    if (!targetId) return;
    setUploading(true);
    setError(null);
    try {
      await setActiveCalibration(targetId);
      const list = Array.from(files);
      const next = await uploadResumes(list);
      if (selectedCalibrationId === targetId) setCandidates(next);
      setActiveCalibrationState(calibrations.find((c) => c.id === targetId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      uploadTargetCalibrationIdRef.current = null;
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job posting? Its candidates will be removed.")) return;
    setError(null);
    try {
      await deleteCalibration(id);
      const [list, active] = await Promise.all([listCalibrations(), getCalibration()]);
      setCalibrations(list);
      setActiveCalibrationState(active ?? null);
      if (selectedCalibrationId === id) {
        setSelectedCalibrationId(list[0]?.id ?? null);
        if (list[0]) fetchCandidates(list[0].id);
        else setCandidates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const triggerUploadFor = (id: string) => {
    uploadTargetCalibrationIdRef.current = id;
    setActiveCalibrationState(calibrations.find((c) => c.id === id) ?? null);
    fileInputRef.current?.click();
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
      setSelectedCalibrationId(created.id);
      setActiveCalibrationState(created);
      await setActiveCalibration(created.id);
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
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboard className="h-6 w-6" />
            Job postings
          </h1>
          <Button asChild className="gap-2">
            <Link href="/calibrate">
              <Plus className="h-4 w-4" />
              Add job posting
            </Link>
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={onUpload}
        />

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {calibrations.map((c) => (
            <Card
              key={c.id}
              className={`transition-shadow hover:shadow-md ${selectedCalibrationId === c.id ? "ring-2 ring-primary" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-medium leading-tight">
                    {c.requisition_name}
                  </CardTitle>
                  <div className="flex shrink-0 items-center gap-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      asChild
                    >
                      <Link href={`/calibrate?edit=${encodeURIComponent(c.id)}`} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyCalibration(c)}
                      aria-label="Make a copy"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(c.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{c.role}</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                <Button
                  type="button"
                  variant={selectedCalibrationId === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchCalibration(c.id)}
                >
                  View candidates
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={uploading}
                  onClick={() => triggerUploadFor(c.id)}
                >
                  {uploading && activeCalibration?.id === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
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

        {selectedCalibration && (
          <Card>
            <CardHeader>
              <CardTitle>
                Candidates for {selectedCalibration.requisition_name} ({candidates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCandidate ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setSelectedCandidateId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to all candidates
                  </Button>
                  <div>
                    <h3 className="mb-2 font-medium">
                      {selectedCandidate
                        ? getDisplayNameFromParsedText(selectedCandidate.parsed_text, selectedCandidate.name)
                        : ""}
                    </h3>
                    <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap font-sans">
                      {selectedCandidate.parsed_text || "(No text extracted)"}
                    </pre>
                  </div>
                </div>
              ) : candidates.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No candidates yet. Upload PDF resumes to see profiles and parsed text.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {candidates.map((c) => {
                    const displayName = getDisplayNameFromParsedText(c.parsed_text, c.name);
                    const initials = getInitialsFromName(displayName);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                          onClick={() => setSelectedCandidateId(c.id)}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="font-medium text-foreground truncate">{displayName}</p>
                            <p className="text-sm text-muted-foreground">Resume · Click to view parsed text</p>
                          </div>
                          <FileTextIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
