import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.models import Calibration, CalibrationCreate
from backend import store

router = APIRouter()


class SetActiveBody(BaseModel):
    calibration_id: str


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
def update_calibration(calibration_id: str, body: CalibrationCreate) -> Calibration:
    existing = store.get_calibration(calibration_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Calibration not found.")
    cal = Calibration(
        id=existing.id,
        created_at=existing.created_at,
        **body.model_dump(),
    )
    store.set_calibration(cal)
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
