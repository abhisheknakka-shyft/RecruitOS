import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from backend.models import CandidateProfile, CandidateResult
from backend import store
from backend.parser import extract_text_from_pdf

router = APIRouter()


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
            text = extract_text_from_pdf(content)
        except Exception:
            continue
        name = _name_from_filename(f.filename)
        profiles.append(CandidateProfile(id=str(uuid.uuid4()), name=name, parsed_text=text.strip() or ""))
    store.add_candidates(cal.id, profiles)
    return store.get_candidates(cal.id)


def _name_from_filename(filename: str) -> str:
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    return base.replace("_", " ").replace("-", " ").strip() or "Unknown"
