const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse(res: Response, context?: string): Promise<never> {
  const text = await res.text();
  throw new Error(text || res.statusText || `Request failed (${res.status})${context ? `: ${context}` : ""}`);
}

function wrapFetch(url: string, init?: RequestInit, context?: string): Promise<Response> {
  return fetch(url, init).catch((err) => {
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      throw new Error(
        `Cannot reach the API at ${API}. Is the backend running? From the project root run: uvicorn backend.main:app --reload --host 0.0.0.0`
      );
    }
    throw err;
  });
}

export interface CalibrationCreate {
  requisition_name: string;
  role: string;
  location: string;
  job_description?: string;
  hiring_company?: string;
  job_locations?: string[];
  job_titles?: string[];
  companies?: string[];
  industries?: string[];
  ideal_candidate?: string;
  skills: string[];
  years_experience_min: number;
  years_experience_max: number;
  years_experience_type?: "total" | "relevant";
  seniority_levels: string[];
  schools?: string[];
  degrees?: string[];
  graduation_year_min?: number | null;
  graduation_year_max?: number | null;
  relocation_allowed?: boolean;
  workplace_type?: string;
  exclude_short_tenure?: string;
  pipeline_stages?: string[];
  is_template?: boolean;
}

export interface Calibration extends CalibrationCreate {
  id: string;
  created_at: string;
  pipeline_stages?: string[];
  is_template?: boolean;
}

export interface CandidateResult {
  id: string;
  name: string;
  parsed_text: string;
  created_at?: string | null;
  source_filename?: string | null;
  stage?: string | null;
  rating?: number | null;
  notes?: string | null;
  ai_summary?: string | null;
}

export interface CandidateUpdate {
  stage?: string;
  rating?: number;
  notes?: string;
}

export async function getCalibration(): Promise<Calibration | null> {
  const res = await wrapFetch(`${API}/api/calibration`);
  if (res.status === 404) return null;
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function getCalibrationById(id: string): Promise<Calibration | null> {
  const res = await wrapFetch(`${API}/api/calibration/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function listCalibrations(): Promise<Calibration[]> {
  const res = await wrapFetch(`${API}/api/calibrations`);
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function listTemplates(): Promise<Calibration[]> {
  const res = await wrapFetch(`${API}/api/templates`);
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function createFromTemplate(templateId: string, requisitionName?: string): Promise<Calibration> {
  const res = await wrapFetch(`${API}/api/calibrations/from-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId, requisition_name: requisitionName }),
  });
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function saveAsTemplate(calibrationId: string, templateName?: string): Promise<Calibration> {
  const res = await wrapFetch(`${API}/api/calibrations/save-as-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calibration_id: calibrationId, template_name: templateName }),
  });
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function setActiveCalibration(calibrationId: string): Promise<void> {
  const res = await wrapFetch(`${API}/api/calibration/active`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calibration_id: calibrationId }),
  });
  if (!res.ok) await handleResponse(res);
}

export async function createCalibration(body: CalibrationCreate): Promise<Calibration> {
  const res = await wrapFetch(`${API}/api/calibration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function updateCalibration(calibrationId: string, body: CalibrationCreate): Promise<Calibration> {
  const res = await wrapFetch(`${API}/api/calibration/${calibrationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function deleteCalibration(calibrationId: string): Promise<void> {
  const res = await wrapFetch(`${API}/api/calibration/${calibrationId}`, { method: "DELETE" });
  if (!res.ok) await handleResponse(res);
}

export async function getCandidates(calibrationId?: string): Promise<CandidateResult[]> {
  const url = calibrationId
    ? `${API}/api/candidates?calibration_id=${encodeURIComponent(calibrationId)}`
    : `${API}/api/candidates`;
  const res = await wrapFetch(url);
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function updateCandidate(
  calibrationId: string,
  candidateId: string,
  body: CandidateUpdate
): Promise<CandidateResult> {
  const res = await wrapFetch(
    `${API}/api/calibrations/${encodeURIComponent(calibrationId)}/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function summarizeCandidate(calibrationId: string, candidateId: string): Promise<CandidateResult> {
  const res = await wrapFetch(
    `${API}/api/calibrations/${encodeURIComponent(calibrationId)}/candidates/${encodeURIComponent(candidateId)}/summarize`,
    { method: "POST" }
  );
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function deleteCandidate(calibrationId: string, candidateId: string): Promise<void> {
  const res = await wrapFetch(
    `${API}/api/calibrations/${encodeURIComponent(calibrationId)}/candidates/${encodeURIComponent(candidateId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) await handleResponse(res);
}

export interface AnalyticsOverview {
  by_stage: Record<string, number>;
  total: number;
  by_requisition: Array<{
    id: string;
    requisition_name: string;
    role: string;
    by_stage: Record<string, number>;
    total: number;
  }>;
  filter_year?: number | null;
  filter_month?: number | null;
}

export async function getAnalyticsOverview(params?: { year?: number; month?: number }): Promise<AnalyticsOverview> {
  const sp = new URLSearchParams();
  if (params?.year != null) sp.set("year", String(params.year));
  if (params?.month != null) sp.set("month", String(params.month));
  const qs = sp.toString();
  const url = qs ? `${API}/api/analytics/overview?${qs}` : `${API}/api/analytics/overview`;
  const res = await wrapFetch(url);
  if (!res.ok) await handleResponse(res);
  return res.json();
}

export async function uploadResumes(files: File[], calibrationId?: string): Promise<CandidateResult[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const url = calibrationId
    ? `${API}/api/upload?calibration_id=${encodeURIComponent(calibrationId)}`
    : `${API}/api/upload`;
  const res = await wrapFetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const t = await res.text();
    let msg = "Upload failed";
    try {
      const j = JSON.parse(t) as { detail?: string };
      msg = typeof j.detail === "string" ? j.detail : msg;
    } catch {
      if (t) msg = t;
    }
    throw new Error(msg);
  }
  return res.json();
}
