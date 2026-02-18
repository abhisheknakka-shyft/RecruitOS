import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.models import Calibration, CalibrationCreate
from backend import store
from backend.scoring_tasks import queue_calibration_rescore

router = APIRouter()


class SetActiveBody(BaseModel):
    calibration_id: str


class CreateFromTemplateBody(BaseModel):
    template_id: str
    requisition_name: Optional[str] = None


class SaveAsTemplateBody(BaseModel):
    calibration_id: str
    template_name: Optional[str] = None


@router.post("/calibration", response_model=Calibration)
def create_calibration(body: CalibrationCreate) -> Calibration:
    cal = Calibration(
        id=str(uuid.uuid4()),
        created_at=datetime.utcnow(),
        **body.model_dump(),
    )
    store.set_calibration(cal)
    return cal


@router.patch("/calibration/active")
def set_active(body: SetActiveBody) -> dict:
    if not store.set_active_calibration(body.calibration_id):
        raise HTTPException(status_code=404, detail="Calibration not found.")
    return {"active": body.calibration_id}


@router.patch("/calibration/{calibration_id}", response_model=Calibration)
async def update_calibration(calibration_id: str, body: CalibrationCreate) -> Calibration:
    existing = store.get_calibration(calibration_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Calibration not found.")
    cal = Calibration(
        id=existing.id,
        created_at=existing.created_at,
        **body.model_dump(),
    )
    store.set_calibration(cal)
    queue_calibration_rescore(calibration_id)
    return cal


@router.get("/calibration", response_model=Calibration)
def get_active_calibration() -> Calibration:
    cal = store.get_calibration()
    if cal is None:
        raise HTTPException(status_code=404, detail="No calibration set. Submit the calibration form first.")
    return cal


@router.get("/calibrations", response_model=list[Calibration])
def list_calibrations() -> list[Calibration]:
    return store.list_calibrations()


@router.get("/templates", response_model=list[Calibration])
def list_templates() -> list[Calibration]:
    return store.list_templates()


@router.post("/calibrations/from-template", response_model=Calibration)
def create_from_template(body: CreateFromTemplateBody) -> Calibration:
    template = store.get_calibration(body.template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found.")
    if not getattr(template, "is_template", False):
        raise HTTPException(status_code=400, detail="Not a template.")
    data = template.model_dump()
    data.pop("id", None)
    data.pop("created_at", None)
    data["is_template"] = False
    data["requisition_name"] = body.requisition_name or template.requisition_name
    cal = Calibration(
        id=str(uuid.uuid4()),
        created_at=datetime.utcnow(),
        **data,
    )
    store.set_calibration(cal)
    return cal


@router.post("/calibrations/save-as-template", response_model=Calibration)
def save_as_template(body: SaveAsTemplateBody) -> Calibration:
    cal = store.get_calibration(body.calibration_id)
    if cal is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    data = cal.model_dump()
    data.pop("id", None)
    data.pop("created_at", None)
    data["is_template"] = True
    data["requisition_name"] = body.template_name or f"Template: {cal.requisition_name}"
    template = Calibration(
        id=str(uuid.uuid4()),
        created_at=datetime.utcnow(),
        **data,
    )
    store.set_calibration(template)
    return template


@router.get("/calibration/{calibration_id}", response_model=Calibration)
def get_calibration_by_id(calibration_id: str) -> Calibration:
    cal = store.get_calibration(calibration_id)
    if cal is None:
        raise HTTPException(status_code=404, detail="Calibration not found.")
    return cal


@router.delete("/calibration/{calibration_id}")
def delete_calibration(calibration_id: str) -> dict:
    if not store.delete_calibration(calibration_id):
        raise HTTPException(status_code=404, detail="Calibration not found.")
    return {"deleted": calibration_id}
