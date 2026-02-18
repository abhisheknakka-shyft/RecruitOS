from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from backend.models import CandidateResult
from backend import store
from backend.parser import extract_text_from_pdf
from backend.scoring_engine import score_resume

router = APIRouter()


@router.get("/candidates", response_model=list[CandidateResult])
def list_candidates(
    calibration_id: Optional[str] = Query(None, description="Calibration ID; defaults to active"),
) -> list[CandidateResult]:
    return store.get_candidates(calibration_id)


@router.post("/upload", response_model=list[CandidateResult])
async def upload_resumes(files: list[UploadFile] = File(...)) -> list[CandidateResult]:
    cal = store.get_calibration()
    if cal is None:
        raise HTTPException(
            status_code=400,
            detail="No calibration set. Complete the calibration form first.",
        )
    results: list[CandidateResult] = []
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            continue
        content = await f.read()
        text = extract_text_from_pdf(content)
        if not text.strip():
            continue
        name = _name_from_filename(f.filename)
        result = score_resume(cal.model_dump(), text, default_name=name)
        results.append(result)
    store.add_candidates(cal.id, results)
    return store.get_candidates(cal.id)


def _name_from_filename(filename: str) -> str:
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    return base.replace("_", " ").replace("-", " ").strip() or "Unknown"
