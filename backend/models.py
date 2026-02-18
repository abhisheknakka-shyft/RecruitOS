from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CalibrationCreate(BaseModel):
    requisition_name: str
    role: str
    location: str
    job_description: str = ""
    hiring_company: str = ""
    job_locations: list[str] = Field(default_factory=list)
    job_titles: list[str] = Field(default_factory=list)
    companies: list[str] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)
    ideal_candidate: str = ""
    skills: list[str] = Field(default_factory=list)
    years_experience_min: int = Field(ge=0, le=50, default=0)
    years_experience_max: int = Field(ge=0, le=50, default=30)
    years_experience_type: str = "total"  # "total" | "relevant"
    seniority_levels: list[str] = Field(default_factory=list)
    schools: list[str] = Field(default_factory=list)
    degrees: list[str] = Field(default_factory=list)
    graduation_year_min: Optional[int] = None
    graduation_year_max: Optional[int] = None
    relocation_allowed: bool = False
    workplace_type: str = ""  # Onsite | Hybrid | Remote Within Country | Remote Globally
    exclude_short_tenure: str = "none"  # none | 6months | 1year | 2years


class Calibration(CalibrationCreate):
    id: str
    created_at: datetime


class ScoringMetrics(BaseModel):
    skill_relevance: int = Field(ge=1, le=5)
    title_relevance: int = Field(ge=1, le=5)
    work_relevance: int = Field(ge=1, le=5)
    experience_relevance: int = Field(ge=1, le=5)


class CandidateResult(BaseModel):
    name: str
    score: int = Field(ge=0, le=100)
    relevant_skills: list[str] = Field(default_factory=list)
    experience_years: Optional[float] = None
    metrics: ScoringMetrics
    summary: str = ""
