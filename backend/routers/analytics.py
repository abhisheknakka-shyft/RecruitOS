from datetime import datetime

from fastapi import APIRouter, Query

from backend import store

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _in_month(dt: datetime | None, year: int, month: int) -> bool:
    if dt is None:
        return False
    return dt.year == year and dt.month == month


@router.get("/overview")
def get_analytics_overview(
    year: int | None = Query(None, description="Filter by application received year"),
    month: int | None = Query(None, ge=1, le=12, description="Filter by application received month (1-12)"),
):
    """Aggregate pipeline metrics. Optionally filter by date of application received (candidate created_at)."""
    jobs = store.list_calibrations()
    by_stage: dict[str, int] = {}
    by_requisition: list[dict] = []
    filter_month = year is not None and month is not None

    for job in jobs:
        candidates = store.get_candidates(job.id)
        if filter_month:
            candidates = [c for c in candidates if _in_month(c.created_at, year, month)]
        job_stages: dict[str, int] = {}
        for c in candidates:
            stage = c.stage or "Applied"
            job_stages[stage] = job_stages.get(stage, 0) + 1
            by_stage[stage] = by_stage.get(stage, 0) + 1
        by_requisition.append({
            "id": job.id,
            "requisition_name": job.requisition_name,
            "role": job.role,
            "by_stage": job_stages,
            "total": len(candidates),
        })

    total = sum(by_stage.values())
    return {
        "by_stage": by_stage,
        "total": total,
        "by_requisition": by_requisition,
        "filter_year": year,
        "filter_month": month,
    }
