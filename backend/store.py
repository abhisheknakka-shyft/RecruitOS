from typing import Optional

from backend.models import Calibration, CandidateProfile, CandidateResult

_calibrations: dict[str, Calibration] = {}
_active_calibration_id: Optional[str] = None
_candidates_by_calibration: dict[str, list[CandidateProfile]] = {}


def get_calibration(calibration_id: Optional[str] = None) -> Optional[Calibration]:
    if calibration_id:
        return _calibrations.get(calibration_id)
    if _active_calibration_id:
        return _calibrations.get(_active_calibration_id)
    return None


def list_calibrations() -> list[Calibration]:
    return sorted(_calibrations.values(), key=lambda c: c.created_at, reverse=True)


def set_calibration(cal: Calibration) -> None:
    global _calibrations, _active_calibration_id
    _calibrations[cal.id] = cal
    _active_calibration_id = cal.id


def set_active_calibration(calibration_id: str) -> bool:
    global _active_calibration_id
    if calibration_id in _calibrations:
        _active_calibration_id = calibration_id
        return True
    return False


def delete_calibration(calibration_id: str) -> bool:
    global _calibrations, _active_calibration_id, _candidates_by_calibration
    if calibration_id not in _calibrations:
        return False
    del _calibrations[calibration_id]
    _candidates_by_calibration.pop(calibration_id, None)
    if _active_calibration_id == calibration_id:
        remaining = list(_calibrations.keys())
        _active_calibration_id = remaining[0] if remaining else None
    return True


def get_candidates(calibration_id: Optional[str] = None) -> list[CandidateResult]:
    cid = calibration_id or _active_calibration_id
    if not cid:
        return []
    profiles = _candidates_by_calibration.get(cid, [])
    return [CandidateResult(id=p.id, name=p.name, parsed_text=p.parsed_text) for p in profiles]


def add_candidates(calibration_id: str, profiles: list[CandidateProfile]) -> None:
    global _candidates_by_calibration
    if calibration_id not in _candidates_by_calibration:
        _candidates_by_calibration[calibration_id] = []
    _candidates_by_calibration[calibration_id].extend(profiles)


def clear_candidates(calibration_id: Optional[str] = None) -> None:
    global _candidates_by_calibration
    if calibration_id:
        _candidates_by_calibration.pop(calibration_id, None)
    else:
        _candidates_by_calibration.clear()
