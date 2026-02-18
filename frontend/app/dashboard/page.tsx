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
import { Upload, LayoutDashboard, FileText, Loader2, Plus, Trash2, ArrowLeft, FileText as FileTextIcon } from "lucide-react";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    if (!files?.length || !activeCalibration) return;
    setUploading(true);
    setError(null);
    try {
      const list = Array.from(files);
      const next = await uploadResumes(list);
      if (selectedCalibrationId === activeCalibration.id) setCandidates(next);
      else setCandidates(await getCandidates(selectedCalibrationId ?? undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
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

  const triggerUploadFor = async (id: string) => {
    try {
      await setActiveCalibration(id);
      setActiveCalibrationState(calibrations.find((c) => c.id === id) ?? null);
      fileInputRef.current?.click();
    } catch {
      // ignore
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
                    <h3 className="mb-2 font-medium">{selectedCandidate.name}</h3>
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
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                        onClick={() => setSelectedCandidateId(c.id)}
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-medium text-foreground truncate">{c.name}</p>
                          <p className="text-sm text-muted-foreground">Resume · Click to view parsed text</p>
                        </div>
                        <FileTextIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
