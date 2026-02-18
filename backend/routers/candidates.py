import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from backend.models import CandidateProfile, CandidateResult
from backend import store
from backend.parser import extract_text_from_pdf

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
        profiles.append(
            CandidateProfile(
                id=str(uuid.uuid4()),
                name=name,
                parsed_text=text.strip() or "",
                created_at=now,
                source_filename=f.filename,
            )
        )
    store.add_candidates(cal.id, profiles)
    return store.get_candidates(cal.id)


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
