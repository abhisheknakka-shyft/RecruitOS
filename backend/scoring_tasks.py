from __future__ import annotations

import asyncio

from backend import store
from backend.scoring_engine import score_resume

_active_jobs: set[tuple[str, str]] = set()


def queue_candidate_scoring(calibration_id: str, candidate_id: str) -> bool:
    job_key = (calibration_id, candidate_id)
    if job_key in _active_jobs:
        return False
    _active_jobs.add(job_key)
    loop = asyncio.get_running_loop()
    loop.create_task(_run_scoring(calibration_id, candidate_id))
    return True


def queue_calibration_rescore(calibration_id: str) -> int:
    queued = 0
    for candidate_id in store.list_candidate_ids(calibration_id):
        if queue_candidate_scoring(calibration_id, candidate_id):
            queued += 1
    return queued


async def _run_scoring(calibration_id: str, candidate_id: str) -> None:
    try:
        calibration = store.get_calibration(calibration_id)
        candidate = store.get_candidate_profile(calibration_id, candidate_id)
        if calibration is None or candidate is None:
            store.mark_candidate_scoring_failed(
                calibration_id,
                candidate_id,
                "Calibration or candidate no longer exists.",
            )
            return

        store.mark_candidate_scoring(calibration_id, candidate_id)
        payload = await asyncio.to_thread(
            score_resume,
            calibration.model_dump(),
            candidate.parsed_text or "",
        )
        store.set_candidate_score(calibration_id, candidate_id, payload)
    except Exception as exc:
        store.mark_candidate_scoring_failed(calibration_id, candidate_id, str(exc))
    finally:
        _active_jobs.discard((calibration_id, candidate_id))
