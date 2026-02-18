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
}

export interface Calibration extends CalibrationCreate {
  id: string;
  created_at: string;
}

export interface CandidateResult {
  id: string;
  name: string;
  parsed_text: string;
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

export async function uploadResumes(files: File[]): Promise<CandidateResult[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await wrapFetch(`${API}/api/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Upload failed");
  }
  return res.json();
}
