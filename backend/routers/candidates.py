import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from backend.models import CandidateProfile, CandidateResult, CandidateUpdate
from backend import store
from backend.parser import extract_text_from_pdf
from backend.llm_providers import chat_completion

router = APIRouter()

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB per file


@router.get("/candidates", response_model=list[CandidateResult])
def list_candidates(
    calibration_id: Optional[str] = Query(None, description="Calibration ID; defaults to active"),
) -> list[CandidateResult]:
    return store.get_candidates(calibration_id)


@router.post("/upload", response_model=list[CandidateResult])
async def upload_resumes(
    files: list[UploadFile] = File(...),
    calibration_id: Optional[str] = Query(None, description="Target calibration; defaults to active"),
) -> list[CandidateResult]:
    cal = store.get_calibration(calibration_id) if calibration_id else store.get_calibration()
    if cal is None:
        raise HTTPException(
            status_code=404,
            detail="Calibration not found. It may have been deleted or the server restarted—refresh the page.",
        )
    profiles: list[CandidateProfile] = []
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            continue
        try:
            content = await f.read()
            if len(content) > MAX_FILE_SIZE_BYTES:
                continue
            text = extract_text_from_pdf(content)
        except Exception:
            continue
        name = _name_from_filename(f.filename)
        now = datetime.now(timezone.utc)
        stages = getattr(cal, "pipeline_stages", None) or ["Applied"]
        first_stage = stages[0] if stages else "Applied"
        profiles.append(
            CandidateProfile(
                id=str(uuid.uuid4()),
                name=name,
                parsed_text=text.strip() or "",
                created_at=now,
                source_filename=f.filename,
                stage=first_stage,
            )
        )
    store.add_candidates(cal.id, profiles)
    return store.get_candidates(cal.id)


@router.patch("/calibrations/{calibration_id}/candidates/{candidate_id}", response_model=CandidateResult)
def update_candidate(calibration_id: str, candidate_id: str, body: CandidateUpdate) -> CandidateResult:
    if store.get_calibration(calibration_id) is None:
        raise HTTPException(status_code=404, detail="Calibration not found.")
    payload = body.model_dump(exclude_unset=True)
    updated = store.update_candidate(calibration_id, candidate_id, **payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    candidates = store.get_candidates(calibration_id)
    for c in candidates:
        if c.id == candidate_id:
            return c
    raise HTTPException(status_code=404, detail="Candidate not found.")


@router.post("/calibrations/{calibration_id}/candidates/{candidate_id}/summarize", response_model=CandidateResult)
def summarize_candidate(calibration_id: str, candidate_id: str) -> CandidateResult:
    """Use AI to generate a 1–2 sentence summary of the resume for pipeline view."""
    if store.get_calibration(calibration_id) is None:
        raise HTTPException(status_code=404, detail="Calibration not found.")
    candidates = store.get_candidates(calibration_id)
    candidate = next((c for c in candidates if c.id == candidate_id), None)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    text = (candidate.parsed_text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No resume text to summarize.")
    system = (
        "You are an HR assistant. Summarize the following resume in 1–2 short sentences. "
        "Include current/latest role, key skills or domain, and years of experience if clear. "
        "Write in third person. Be concise and factual."
    )
    try:
        summary = chat_completion(system, text[:8000])
        summary = (summary or "").strip() or "No summary generated."
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    store.update_candidate(calibration_id, candidate_id, ai_summary=summary)
    updated = store.get_candidates(calibration_id)
    for c in updated:
        if c.id == candidate_id:
            return c
    raise HTTPException(status_code=404, detail="Candidate not found.")


@router.delete("/calibrations/{calibration_id}/candidates/{candidate_id}")
def delete_candidate(calibration_id: str, candidate_id: str) -> dict:
    if store.get_calibration(calibration_id) is None:
        raise HTTPException(status_code=404, detail="Calibration not found.")
    if not store.delete_candidate(calibration_id, candidate_id):
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return {"deleted": candidate_id}


def _name_from_filename(filename: str) -> str:
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    return base.replace("_", " ").replace("-", " ").strip() or "Unknown"
