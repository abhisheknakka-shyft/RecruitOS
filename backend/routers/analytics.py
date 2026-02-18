from fastapi import APIRouter

from backend import store

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def get_analytics_overview():
    """Aggregate pipeline metrics across all requisitions for HR insights."""
    jobs = store.list_calibrations()
    by_stage: dict[str, int] = {}
    by_requisition: list[dict] = []

    for job in jobs:
        candidates = store.get_candidates(job.id)
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
    }
