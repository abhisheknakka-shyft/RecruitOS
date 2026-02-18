from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from backend.models import Calibration, CandidateProfile, CandidateResult

_DATA_DIR = Path(__file__).resolve().parent / "data"
_DATA_FILE = _DATA_DIR / "recruitos_data.json"

_calibrations: dict[str, Calibration] = {}
_active_calibration_id: Optional[str] = None
_candidates_by_calibration: dict[str, list[CandidateProfile]] = {}
_loaded = False


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True
    _load_from_disk()


def _load_from_disk() -> None:
    global _calibrations, _active_calibration_id, _candidates_by_calibration
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


def _save_to_disk() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "calibrations": [c.model_dump(mode="json") for c in _calibrations.values()],
        "active_calibration_id": _active_calibration_id,
        "candidates_by_calibration": {
            cid: [p.model_dump(mode="json") for p in profiles]
            for cid, profiles in _candidates_by_calibration.items()
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
    _ensure_loaded()
    return sorted(_calibrations.values(), key=lambda c: c.created_at, reverse=True)


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
    global _calibrations, _active_calibration_id, _candidates_by_calibration
    _ensure_loaded()
    if calibration_id not in _calibrations:
        return False
    del _calibrations[calibration_id]
    _candidates_by_calibration.pop(calibration_id, None)
    if _active_calibration_id == calibration_id:
        remaining = list(_calibrations.keys())
        _active_calibration_id = remaining[0] if remaining else None
    _save_to_disk()
    return True


def _profile_to_result(p: CandidateProfile) -> CandidateResult:
    return CandidateResult(
        id=p.id,
        name=p.name,
        parsed_text=p.parsed_text,
        created_at=p.created_at,
        source_filename=p.source_filename,
    )


def get_candidates(calibration_id: Optional[str] = None) -> list[CandidateResult]:
    _ensure_loaded()
    cid = calibration_id or _active_calibration_id
    if not cid:
        return []
    profiles = _candidates_by_calibration.get(cid, [])
    return [_profile_to_result(p) for p in profiles]


def add_candidates(calibration_id: str, profiles: list[CandidateProfile]) -> None:
    global _candidates_by_calibration
    _ensure_loaded()
    if calibration_id not in _candidates_by_calibration:
        _candidates_by_calibration[calibration_id] = []
    _candidates_by_calibration[calibration_id].extend(profiles)
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
            _save_to_disk()
            return True
    return False


def clear_candidates(calibration_id: Optional[str] = None) -> None:
    global _candidates_by_calibration
    _ensure_loaded()
    if calibration_id:
        _candidates_by_calibration.pop(calibration_id, None)
    else:
        _candidates_by_calibration.clear()
    _save_to_disk()
