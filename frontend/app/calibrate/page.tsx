"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { SkillsInput } from "@/components/SkillsInput";
import { TagsInput } from "@/components/TagsInput";
import {
  createCalibration,
  updateCalibration,
  listCalibrations,
  getCalibrationById,
  setActiveCalibration,
  type CalibrationCreate,
  type Calibration,
} from "@/lib/api";
import { Briefcase, FileText, Plus, ChevronDown, ChevronRight, Info } from "lucide-react";

const SENIORITY_OPTIONS = ["Entry", "Mid-Level", "Senior", "Manager", "Director", "Vice President", "CXO"];
const DEGREE_OPTIONS = ["Certificate", "Bachelors", "Masters", "Doctorate"];
const WORKPLACE_TYPES = ["Onsite", "Hybrid", "Remote Within Country", "Remote Globally"];
const EXCLUDE_TENURE_OPTIONS = [
  { value: "none", label: "Do not exclude" },
  { value: "6months", label: "Less than 6 months" },
  { value: "1year", label: "Less than 1 year" },
  { value: "2years", label: "Less than 2 years" },
];

const CURRENT_YEAR = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);

function loadCalibrationIntoForm(
  cal: Calibration,
  setters: {
    setRequisition_name: (s: string) => void;
    setRole: (s: string) => void;
    setJob_description: (s: string) => void;
    setHiring_company: (s: string) => void;
    setJob_locations: (s: string[]) => void;
    setJob_titles: (s: string[]) => void;
    setCompanies: (s: string[]) => void;
    setIndustries: (s: string[]) => void;
    setIdeal_candidate: (s: string) => void;
    setSkills: (s: string[]) => void;
    setExperienceRange: (v: [number, number]) => void;
    setYears_experience_type: (s: string) => void;
    setSeniority_levels: (s: string[]) => void;
    setSchools: (s: string[]) => void;
    setDegrees: (s: string[]) => void;
    setGraduation_year_min: (n: number | null) => void;
    setGraduation_year_max: (n: number | null) => void;
    setRelocation_allowed: (b: boolean) => void;
    setWorkplace_type: (s: string) => void;
    setExclude_short_tenure: (s: string) => void;
  }
) {
  const c = cal as unknown as Record<string, unknown>;
  setters.setRequisition_name((c.requisition_name as string) ?? "");
  setters.setRole((c.role as string) ?? "");
  setters.setJob_description((c.job_description as string) ?? "");
  setters.setHiring_company((c.hiring_company as string) ?? "");
  const jobLocs = (c.job_locations as string[] | undefined) ?? [];
  setters.setJob_locations(jobLocs.length ? jobLocs : (c.location ? [c.location as string] : []));
  setters.setJob_titles((c.job_titles as string[]) ?? []);
  setters.setCompanies((c.companies as string[]) ?? []);
  setters.setIndustries((c.industries as string[]) ?? []);
  setters.setIdeal_candidate((c.ideal_candidate as string) ?? "");
  setters.setSkills((c.skills as string[]) ?? []);
  setters.setExperienceRange([
    (c.years_experience_min as number) ?? 0,
    (c.years_experience_max as number) ?? 30,
  ]);
  setters.setYears_experience_type((c.years_experience_type as string) ?? "total");
  setters.setSeniority_levels((c.seniority_levels as string[]) ?? []);
  setters.setSchools((c.schools as string[]) ?? []);
  setters.setDegrees((c.degrees as string[]) ?? []);
  setters.setGraduation_year_min((c.graduation_year_min as number | null) ?? null);
  setters.setGraduation_year_max((c.graduation_year_max as number | null) ?? null);
  setters.setRelocation_allowed((c.relocation_allowed as boolean) ?? false);
  setters.setWorkplace_type((c.workplace_type as string) ?? "");
  setters.setExclude_short_tenure((c.exclude_short_tenure as string) ?? "none");
}

export default function CalibratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requisition_name, setRequisition_name] = useState("");
  const [role, setRole] = useState("");
  const [job_description, setJob_description] = useState("");
  const [hiring_company, setHiring_company] = useState("");
  const [job_locations, setJob_locations] = useState<string[]>([]);
  const [job_titles, setJob_titles] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [ideal_candidate, setIdeal_candidate] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [experienceRange, setExperienceRange] = useState<[number, number]>([0, 30]);
  const [years_experience_type, setYears_experience_type] = useState<"total" | "relevant">("total");
  const [seniority_levels, setSeniority_levels] = useState<string[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [degrees, setDegrees] = useState<string[]>([]);
  const [graduation_year_min, setGraduation_year_min] = useState<number | null>(null);
  const [graduation_year_max, setGraduation_year_max] = useState<number | null>(null);
  const [relocation_allowed, setRelocation_allowed] = useState(false);
  const [workplace_type, setWorkplace_type] = useState("");
  const [exclude_short_tenure, setExclude_short_tenure] = useState("none");
  const [expandedExperience, setExpandedExperience] = useState(true);
  const [expandedEducation, setExpandedEducation] = useState(true);
  const [expandedAdvanced, setExpandedAdvanced] = useState(true);

  useEffect(() => {
    listCalibrations()
      .then(setCalibrations)
      .catch(() => setCalibrations([]));
  }, []);

  useEffect(() => {
    if (editId) {
      setSelectedId(editId);
      selectCalibration(editId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectCalibration = async (id: string | null) => {
    setSelectedId(id);
    if (!id) {
      setRequisition_name("");
      setRole("");
      setJob_description("");
      setHiring_company("");
      setJob_locations([]);
      setJob_titles([]);
      setCompanies([]);
      setIndustries([]);
      setIdeal_candidate("");
      setSkills([]);
      setExperienceRange([0, 30]);
      setYears_experience_type("total");
      setSeniority_levels([]);
      setSchools([]);
      setDegrees([]);
      setGraduation_year_min(null);
      setGraduation_year_max(null);
      setRelocation_allowed(false);
      setWorkplace_type("");
      setExclude_short_tenure("none");
      return;
    }
    try {
      const cal = await getCalibrationById(id);
      if (cal) {
        setActiveCalibration(id).catch(() => {});
        loadCalibrationIntoForm(cal, {
          setRequisition_name,
          setRole,
          setJob_description,
          setHiring_company,
          setJob_locations,
          setJob_titles,
          setCompanies,
          setIndustries,
          setIdeal_candidate,
          setSkills,
          setExperienceRange,
          setYears_experience_type: (s) => setYears_experience_type(s as "total" | "relevant"),
          setSeniority_levels,
          setSchools,
          setDegrees,
          setGraduation_year_min,
          setGraduation_year_max,
          setRelocation_allowed,
          setWorkplace_type,
          setExclude_short_tenure,
        });
      }
    } catch {
      setCalibrations((prev) => prev.filter((c) => c.id !== id));
      setSelectedId(null);
    }
  };

  const toggleSeniority = (s: string) => {
    setSeniority_levels((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };
  const toggleDegree = (d: string) => {
    setDegrees((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: CalibrationCreate = {
        requisition_name: requisition_name || "Unnamed Requisition",
        role,
        location: job_locations[0] ?? "",
        job_description: job_description || undefined,
        hiring_company: hiring_company || undefined,
        job_locations,
        job_titles,
        companies,
        industries,
        ideal_candidate: ideal_candidate || undefined,
        skills,
        years_experience_min: experienceRange[0],
        years_experience_max: experienceRange[1],
        years_experience_type: years_experience_type,
        seniority_levels,
        schools,
        degrees,
        graduation_year_min: graduation_year_min ?? undefined,
        graduation_year_max: graduation_year_max ?? undefined,
        relocation_allowed: relocation_allowed,
        workplace_type: workplace_type || undefined,
        exclude_short_tenure: exclude_short_tenure,
      };
      if (selectedId) {
        const updated = await updateCalibration(selectedId, body);
        setCalibrations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        router.push("/dashboard");
      } else {
        const created = await createCalibration(body);
        setCalibrations((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
        setSelectedId(created.id);
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbLabel = selectedId
    ? calibrations.find((c) => c.id === selectedId)?.requisition_name ?? "Calibration"
    : "New calibration";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="font-semibold text-primary">
            RecruitOS
          </Link>
          <nav className="flex gap-4">
            <Link href="/calibrate" className="text-sm font-medium text-primary underline">
              Calibrate
            </Link>
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
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

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground">{breadcrumbLabel}</span>
        </nav>
        <h1 className="text-2xl font-semibold">Calibration</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Calibration captures the job requirements as agreed with the hiring manager. Do not accidentally modify.
        </p>

        {calibrations.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Label className="mb-2 block">Requisition</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedId === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectCalibration(null)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  New
                </Button>
                {calibrations.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant={selectedId === c.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectCalibration(c.id)}
                  >
                    {c.requisition_name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Who do you want to hire?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="req" className="flex items-center gap-1">
                    Requisition
                    <span title="Change requisition name in Workday">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </Label>
                  <Input
                    id="req"
                    value={requisition_name}
                    onChange={(e) => setRequisition_name(e.target.value)}
                    placeholder="e.g. KERING Test 1 (R157328)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Hiring Company</Label>
                  <Input
                    id="company"
                    value={hiring_company}
                    onChange={(e) => setHiring_company(e.target.value)}
                    placeholder="Company name"
                  />
                </div>
              </div>
              <TagsInput
                label="Job Location(s)"
                value={job_locations}
                onChange={setJob_locations}
                placeholder="Add location or paste comma-separated"
              />
              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Role
                </Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Security - Specialist"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_description">Job description</Label>
                <textarea
                  id="job_description"
                  value={job_description}
                  onChange={(e) => setJob_description(e.target.value)}
                  placeholder="Paste or type the full job description"
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Who is your ideal candidate?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Candidates you have hired before, given offer to, or would hire in the future.
              </p>
            </CardHeader>
            <CardContent>
              <Label htmlFor="ideal">Ideal Candidate</Label>
              <textarea
                id="ideal"
                value={ideal_candidate}
                onChange={(e) => setIdeal_candidate(e.target.value)}
                placeholder="Describe ideal candidate profile"
                rows={3}
                className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Refine your Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <SkillsInput value={skills} onChange={setSkills} />
              </div>

              <details open={expandedExperience} onToggle={() => setExpandedExperience((e) => !e)} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 font-medium">
                  {expandedExperience ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Experience
                </summary>
                <div className="space-y-4 pl-6 pt-2">
                  <TagsInput label="Job Titles" value={job_titles} onChange={setJob_titles} placeholder="Add job title" />
                  <TagsInput label="Companies" value={companies} onChange={setCompanies} placeholder="Add company" />
                  <TagsInput label="Industries" value={industries} onChange={setIndustries} placeholder="Add industry" />
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">Preferred Seniority Level</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SENIORITY_OPTIONS.map((s) => (
                        <label key={s} className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={seniority_levels.includes(s)}
                            onCheckedChange={() => toggleSeniority(s)}
                          />
                          <span className="text-sm">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">Years of Experience</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="yearsType"
                          checked={years_experience_type === "total"}
                          onChange={() => setYears_experience_type("total")}
                        />
                        <span className="text-sm">Total Years</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="yearsType"
                          checked={years_experience_type === "relevant"}
                          onChange={() => setYears_experience_type("relevant")}
                        />
                        <span className="text-sm">Years Relevant to this Requisition</span>
                      </label>
                    </div>
                    <p className="text-sm text-muted-foreground">{experienceRange[0]} – {experienceRange[1]}{experienceRange[1] >= 30 ? "+" : ""}</p>
                    <Slider
                      min={0}
                      max={30}
                      step={1}
                      value={experienceRange}
                      onValueChange={(v) => setExperienceRange(v as [number, number])}
                    />
                  </div>
                </div>
              </details>

              <details open={expandedEducation} onToggle={() => setExpandedEducation((e) => !e)} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 font-medium">
                  {expandedEducation ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Education
                </summary>
                <div className="space-y-4 pl-6 pt-2">
                  <TagsInput label="Schools" value={schools} onChange={setSchools} placeholder="Add school" />
                  <div className="space-y-2">
                    <Label>Degrees</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {DEGREE_OPTIONS.map((d) => (
                        <label key={d} className="flex cursor-pointer items-center gap-2">
                          <Checkbox checked={degrees.includes(d)} onCheckedChange={() => toggleDegree(d)} />
                          <span className="text-sm">{d}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-2">
                      <Label>Graduation Year (from)</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={graduation_year_min ?? ""}
                        onChange={(e) => setGraduation_year_min(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">N/A</option>
                        {GRAD_YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Graduation Year (to)</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={graduation_year_max ?? ""}
                        onChange={(e) => setGraduation_year_max(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">N/A</option>
                        {GRAD_YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </details>

              <details open={expandedAdvanced} onToggle={() => setExpandedAdvanced((e) => !e)} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 font-medium">
                  {expandedAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Advanced Options
                </summary>
                <div className="space-y-4 pl-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="relocation"
                      checked={relocation_allowed}
                      onCheckedChange={(c) => setRelocation_allowed(!!c)}
                    />
                    <Label htmlFor="relocation">Relocation Allowed</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Workplace Type</Label>
                    <div className="flex flex-wrap gap-4">
                      {WORKPLACE_TYPES.map((w) => (
                        <label key={w} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="workplace"
                            checked={workplace_type === w}
                            onChange={() => setWorkplace_type(w)}
                          />
                          <span className="text-sm">{w}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">Exclude short tenures</Label>
                    <p className="text-xs text-muted-foreground">Average tenure of the most recent 3 requisitions.</p>
                    <div className="flex flex-wrap gap-4">
                      {EXCLUDE_TENURE_OPTIONS.map((o) => (
                        <label key={o.value} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="tenure"
                            checked={exclude_short_tenure === o.value}
                            onChange={() => setExclude_short_tenure(o.value)}
                          />
                          <span className="text-sm">{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save & go to Dashboard"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
