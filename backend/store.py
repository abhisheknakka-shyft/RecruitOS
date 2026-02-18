from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.models import (
    Calibration,
    CandidateProfile,
    CandidateResult,
    CandidateScoringState,
    RankedCandidateResult,
    RankingPayload,
)

_DATA_DIR = Path(__file__).resolve().parent / "data"
_DATA_FILE = _DATA_DIR / "recruitos_data.json"

_calibrations: dict[str, Calibration] = {}
_active_calibration_id: Optional[str] = None
_candidates_by_calibration: dict[str, list[CandidateProfile]] = {}
_scores_by_calibration: dict[str, dict[str, CandidateScoringState]] = {}
_loaded = False


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True
    _load_from_disk()


def _load_from_disk() -> None:
    global _calibrations, _active_calibration_id, _candidates_by_calibration, _scores_by_calibration
    if not _DATA_FILE.exists():
        return
    try:
        raw = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return
    calibrations_list = raw.get("calibrations") or []
    _calibrations = {}
    for c in calibrations_list:
        try:
            cal = Calibration.model_validate(c)
            _calibrations[cal.id] = cal
        except Exception:
            continue
    _active_calibration_id = raw.get("active_calibration_id") or (list(_calibrations.keys())[0] if _calibrations else None)
    cand_raw = raw.get("candidates_by_calibration") or {}
    _candidates_by_calibration = {}
    for cid, profiles_list in cand_raw.items():
        if cid not in _calibrations:
            continue
        out = []
        for p in profiles_list:
            try:
                out.append(CandidateProfile.model_validate(p))
            except Exception:
                continue
        _candidates_by_calibration[cid] = out
    score_raw = raw.get("scores_by_calibration") or {}
    _scores_by_calibration = {}
    for cid, score_map in score_raw.items():
        if cid not in _calibrations:
            continue
        parsed_map: dict[str, CandidateScoringState] = {}
        if isinstance(score_map, dict):
            for candidate_id, score_obj in score_map.items():
                try:
                    parsed_map[candidate_id] = CandidateScoringState.model_validate(score_obj)
                except Exception:
                    continue
        _scores_by_calibration[cid] = parsed_map


def _save_to_disk() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "calibrations": [c.model_dump(mode="json") for c in _calibrations.values()],
        "active_calibration_id": _active_calibration_id,
        "candidates_by_calibration": {
            cid: [p.model_dump(mode="json") for p in profiles]
            for cid, profiles in _candidates_by_calibration.items()
        },
        "scores_by_calibration": {
            cid: {candidate_id: score.model_dump(mode="json") for candidate_id, score in score_map.items()}
            for cid, score_map in _scores_by_calibration.items()
        },
    }
    _DATA_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def get_calibration(calibration_id: Optional[str] = None) -> Optional[Calibration]:
    _ensure_loaded()
    if calibration_id:
        return _calibrations.get(calibration_id)
    if _active_calibration_id:
        return _calibrations.get(_active_calibration_id)
    return None


def list_calibrations() -> list[Calibration]:
    """List job postings (excludes templates)."""
    _ensure_loaded()
    jobs = [c for c in _calibrations.values() if not getattr(c, "is_template", False)]
    return sorted(jobs, key=lambda c: c.created_at, reverse=True)


def list_templates() -> list[Calibration]:
    """List job templates (for creating new jobs)."""
    _ensure_loaded()
    templates = [c for c in _calibrations.values() if getattr(c, "is_template", False)]
    return sorted(templates, key=lambda c: c.created_at, reverse=True)


def set_calibration(cal: Calibration) -> None:
    global _calibrations, _active_calibration_id
    _ensure_loaded()
    _calibrations[cal.id] = cal
    _active_calibration_id = cal.id
    _save_to_disk()


def set_active_calibration(calibration_id: str) -> bool:
    global _active_calibration_id
    _ensure_loaded()
    if calibration_id in _calibrations:
        _active_calibration_id = calibration_id
        _save_to_disk()
        return True
    return False


def delete_calibration(calibration_id: str) -> bool:
    global _calibrations, _active_calibration_id, _candidates_by_calibration, _scores_by_calibration
    _ensure_loaded()
    if calibration_id not in _calibrations:
        return False
    del _calibrations[calibration_id]
    _candidates_by_calibration.pop(calibration_id, None)
    _scores_by_calibration.pop(calibration_id, None)
    if _active_calibration_id == calibration_id:
        remaining = list(_calibrations.keys())
        _active_calibration_id = remaining[0] if remaining else None
    _save_to_disk()
    return True


def _profile_to_result(p: CandidateProfile, first_stage: str = "Applied") -> CandidateResult:
    return CandidateResult(
        id=p.id,
        name=p.name,
        parsed_text=p.parsed_text,
        created_at=p.created_at,
        source_filename=p.source_filename,
        stage=p.stage or first_stage,
        rating=p.rating,
        notes=p.notes,
        ai_summary=p.ai_summary,
    )


def get_candidates(calibration_id: Optional[str] = None) -> list[CandidateResult]:
    _ensure_loaded()
    cid = calibration_id or _active_calibration_id
    if not cid:
        return []
    cal = _calibrations.get(cid)
    stages = getattr(cal, "pipeline_stages", None) if cal else None
    first_stage = (stages[0] if stages else "Applied")
    profiles = _candidates_by_calibration.get(cid, [])
    return [_profile_to_result(p, first_stage) for p in profiles]


def get_ranked_candidates(calibration_id: Optional[str] = None) -> list[RankedCandidateResult]:
    _ensure_loaded()
    cid = calibration_id or _active_calibration_id
    if not cid:
        return []
    candidates = get_candidates(cid)
    score_map = _scores_by_calibration.setdefault(cid, {})
    dirty = False
    merged: list[RankedCandidateResult] = []
    for candidate in candidates:
        scoring = score_map.get(candidate.id)
        if scoring is None:
            scoring = CandidateScoringState(status="pending", summary="Awaiting scoring.")
            score_map[candidate.id] = scoring
            dirty = True
        merged.append(
            RankedCandidateResult(
                **candidate.model_dump(),
                scoring=scoring,
            )
        )
    if dirty:
        _save_to_disk()
    status_rank = {"completed": 0, "processing": 1, "pending": 2, "failed": 3}
    merged.sort(
        key=lambda c: (
            status_rank.get(c.scoring.status, 9),
            -(c.scoring.total_score or -1),
            c.name.lower(),
        )
    )
    return merged


def update_candidate(calibration_id: str, candidate_id: str, **kwargs: object) -> bool:
    global _candidates_by_calibration
    _ensure_loaded()
    profiles = _candidates_by_calibration.get(calibration_id)
    if not profiles:
        return False
    for p in profiles:
        if p.id == candidate_id:
            for key, value in kwargs.items():
                if hasattr(p, key):
                    setattr(p, key, value)
            _save_to_disk()
            return True
    return False


def add_candidates(calibration_id: str, profiles: list[CandidateProfile]) -> None:
    global _candidates_by_calibration, _scores_by_calibration
    _ensure_loaded()
    if calibration_id not in _candidates_by_calibration:
        _candidates_by_calibration[calibration_id] = []
    _candidates_by_calibration[calibration_id].extend(profiles)
    score_map = _scores_by_calibration.setdefault(calibration_id, {})
    for profile in profiles:
        score_map[profile.id] = CandidateScoringState(status="pending", summary="Queued for scoring.")
    _save_to_disk()


def delete_candidate(calibration_id: str, candidate_id: str) -> bool:
    global _candidates_by_calibration
    _ensure_loaded()
    profiles = _candidates_by_calibration.get(calibration_id)
    if not profiles:
        return False
    for i, p in enumerate(profiles):
        if p.id == candidate_id:
            profiles.pop(i)
            score_map = _scores_by_calibration.get(calibration_id)
            if score_map:
                score_map.pop(candidate_id, None)
            _save_to_disk()
            return True
    return False


def clear_candidates(calibration_id: Optional[str] = None) -> None:
    global _candidates_by_calibration, _scores_by_calibration
    _ensure_loaded()
    if calibration_id:
        _candidates_by_calibration.pop(calibration_id, None)
        _scores_by_calibration.pop(calibration_id, None)
    else:
        _candidates_by_calibration.clear()
        _scores_by_calibration.clear()
    _save_to_disk()


def get_candidate_profile(calibration_id: str, candidate_id: str) -> Optional[CandidateProfile]:
    _ensure_loaded()
    profiles = _candidates_by_calibration.get(calibration_id) or []
    return next((p for p in profiles if p.id == candidate_id), None)


def list_candidate_ids(calibration_id: str) -> list[str]:
    _ensure_loaded()
    profiles = _candidates_by_calibration.get(calibration_id) or []
    return [p.id for p in profiles]


def mark_candidate_scoring(calibration_id: str, candidate_id: str) -> None:
    _ensure_loaded()
    score_map = _scores_by_calibration.setdefault(calibration_id, {})
    current = score_map.get(candidate_id) or CandidateScoringState(status="pending")
    score_map[candidate_id] = current.model_copy(
        update={
            "status": "processing",
            "error": None,
            "summary": "Scoring in progress.",
            "updated_at": datetime.utcnow(),
        }
    )
    _save_to_disk()


def set_candidate_score(calibration_id: str, candidate_id: str, payload: RankingPayload) -> None:
    _ensure_loaded()
    score_map = _scores_by_calibration.setdefault(calibration_id, {})
    score_map[candidate_id] = CandidateScoringState(
        status="completed",
        total_score=payload.total_score,
        experience_years=payload.experience_years,
        summary=payload.summary,
        matched_skills=payload.matched_skills,
        matched_titles=payload.matched_titles,
        matched_companies=payload.matched_companies,
        matched_industries=payload.matched_industries,
        matched_schools=payload.matched_schools,
        matched_degrees=payload.matched_degrees,
        sub_metrics=payload.sub_metrics,
        error=None,
        updated_at=datetime.utcnow(),
    )
    _save_to_disk()


def mark_candidate_scoring_failed(calibration_id: str, candidate_id: str, error: str) -> None:
    _ensure_loaded()
    score_map = _scores_by_calibration.setdefault(calibration_id, {})
    current = score_map.get(candidate_id) or CandidateScoringState(status="pending")
    score_map[candidate_id] = current.model_copy(
        update={
            "status": "failed",
            "error": error or "Unknown scoring error.",
            "summary": "Scoring failed.",
            "updated_at": datetime.utcnow(),
        }
    )
    _save_to_disk()
