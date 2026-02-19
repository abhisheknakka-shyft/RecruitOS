from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field


DEFAULT_PIPELINE_STAGES = ["Applied", "Screening", "Interview", "Offer"]


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
    pipeline_stages: list[str] = Field(default_factory=lambda: list(DEFAULT_PIPELINE_STAGES))
    is_template: bool = False
    # Optional scoring weights (0–100 each). If all None, backend uses defaults. Weights are normalized to sum 100.
    scoring_weight_skills: Optional[int] = Field(None, ge=0, le=100)
    scoring_weight_titles: Optional[int] = Field(None, ge=0, le=100)
    scoring_weight_work: Optional[int] = Field(None, ge=0, le=100)
    scoring_weight_education: Optional[int] = Field(None, ge=0, le=100)
    scoring_weight_experience: Optional[int] = Field(None, ge=0, le=100)
    scoring_weight_context: Optional[int] = Field(None, ge=0, le=100)


class Calibration(CalibrationCreate):
    id: str
    created_at: datetime


class ScoringMetrics(BaseModel):
    skill_relevance: int = Field(ge=1, le=5)
    title_relevance: int = Field(ge=1, le=5)
    work_relevance: int = Field(ge=1, le=5)
    experience_relevance: int = Field(ge=1, le=5)


class CandidateProfile(BaseModel):
    """Candidate profile: id, name, parsed text, pipeline stage, rating, notes, optional AI summary."""
    id: str
    name: str
    parsed_text: str
    created_at: Optional[datetime] = None
    source_filename: Optional[str] = None
    stage: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = None
    ai_summary: Optional[str] = None  # 1–2 sentence LLM summary for pipeline view


class CandidateResult(BaseModel):
    """API response: same fields as CandidateProfile."""
    id: str
    name: str
    parsed_text: str
    created_at: Optional[datetime] = None
    source_filename: Optional[str] = None
    stage: Optional[str] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    ai_summary: Optional[str] = None


class CandidateUpdate(BaseModel):
    """Partial update for candidate: stage, rating, notes, ai_summary."""
    stage: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = None
    ai_summary: Optional[str] = None


class RankingSubMetric(BaseModel):
    key: str
    label: str
    rating: int = Field(ge=1, le=5)
    points_earned: int = Field(ge=0)
    points_possible: int = Field(ge=1)
    matched_terms: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    rationale: str = ""


class RankingPayload(BaseModel):
    total_score: int = Field(ge=0, le=100)
    experience_years: Optional[float] = None
    summary: str = ""
    matched_skills: list[str] = Field(default_factory=list)
    matched_titles: list[str] = Field(default_factory=list)
    matched_companies: list[str] = Field(default_factory=list)
    matched_industries: list[str] = Field(default_factory=list)
    matched_schools: list[str] = Field(default_factory=list)
    matched_degrees: list[str] = Field(default_factory=list)
    sub_metrics: list[RankingSubMetric] = Field(default_factory=list)


class CandidateScoringState(BaseModel):
    status: Literal["pending", "processing", "completed", "failed"] = "pending"
    total_score: Optional[int] = Field(default=None, ge=0, le=100)
    experience_years: Optional[float] = None
    summary: str = ""
    matched_skills: list[str] = Field(default_factory=list)
    matched_titles: list[str] = Field(default_factory=list)
    matched_companies: list[str] = Field(default_factory=list)
    matched_industries: list[str] = Field(default_factory=list)
    matched_schools: list[str] = Field(default_factory=list)
    matched_degrees: list[str] = Field(default_factory=list)
    sub_metrics: list[RankingSubMetric] = Field(default_factory=list)
    error: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RankedCandidateResult(CandidateResult):
    scoring: CandidateScoringState = Field(default_factory=CandidateScoringState)
