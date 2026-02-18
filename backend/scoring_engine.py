import json
import re
from backend.llm_providers import chat_completion, chat_completion_structured
from backend.models import CandidateResult, ScoringMetrics

SYSTEM_PROMPT = """You are an expert technical recruiter. Compare the candidate's resume against the job requirements.
Extract the candidate's full name from the resume. Score 0-100 how well they match. Set experience_years to null if unclear.
All metrics (skill_relevance, title_relevance, work_relevance, experience_relevance) are 1-5. Summary is one short sentence."""


def score_resume(calibration: dict, resume_text: str, default_name: str = "Unknown") -> CandidateResult:
    req = _format_requirements(calibration)
    user_content = f"Job requirements:\n{req}\n\nResume:\n{resume_text[:12000]}"
    structured = chat_completion_structured(SYSTEM_PROMPT, user_content, CandidateResult)
    if structured is not None:
        name = (structured.name or "").strip() or default_name
        m = structured.metrics
        metrics = ScoringMetrics(
            skill_relevance=min(5, max(1, m.skill_relevance)),
            title_relevance=min(5, max(1, m.title_relevance)),
            work_relevance=min(5, max(1, m.work_relevance)),
            experience_relevance=min(5, max(1, m.experience_relevance)),
        )
        return CandidateResult(
            name=name,
            score=min(100, max(0, structured.score)),
            relevant_skills=structured.relevant_skills or [],
            experience_years=structured.experience_years,
            metrics=metrics,
            summary=structured.summary or "",
        )
    raw = chat_completion(SYSTEM_PROMPT, user_content) or "{}"
    raw = re.sub(r"^```\w*\n?", "", raw).strip()
    raw = re.sub(r"\n?```\s*$", "", raw).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return CandidateResult(
            name=default_name,
            score=0,
            relevant_skills=[],
            experience_years=None,
            metrics=ScoringMetrics(skill_relevance=1, title_relevance=1, work_relevance=1, experience_relevance=1),
            summary="Could not parse LLM response.",
        )
    name = data.get("name") or default_name
    metrics = data.get("metrics", {})
    return CandidateResult(
        name=name,
        score=int(data.get("score", 0)),
        relevant_skills=data.get("relevant_skills") or [],
        experience_years=data.get("experience_years"),
        metrics=ScoringMetrics(
            skill_relevance=min(5, max(1, int(metrics.get("skill_relevance", 3)))),
            title_relevance=min(5, max(1, int(metrics.get("title_relevance", 3)))),
            work_relevance=min(5, max(1, int(metrics.get("work_relevance", 3)))),
            experience_relevance=min(5, max(1, int(metrics.get("experience_relevance", 3)))),
        ),
        summary=data.get("summary") or "",
    )


def _format_requirements(cal: dict) -> str:
    parts = [
        f"Requisition: {cal.get('requisition_name', '')}",
        f"Role: {cal.get('role', '')}",
        f"Location: {cal.get('location', '')}",
        f"Hiring company: {cal.get('hiring_company', '')}",
        f"Job locations: {', '.join(cal.get('job_locations', []))}",
        f"Job titles: {', '.join(cal.get('job_titles', []))}",
        f"Companies: {', '.join(cal.get('companies', []))}",
        f"Industries: {', '.join(cal.get('industries', []))}",
        f"Years of experience ({cal.get('years_experience_type', 'total')}): {cal.get('years_experience_min', 0)}–{cal.get('years_experience_max', 30)}",
        f"Seniority levels: {', '.join(cal.get('seniority_levels', []))}",
        f"Skills / keywords: {', '.join(cal.get('skills', []))}",
        f"Schools: {', '.join(cal.get('schools', []))}",
        f"Degrees: {', '.join(cal.get('degrees', []))}",
        f"Workplace type: {cal.get('workplace_type', '')}",
        f"Relocation allowed: {cal.get('relocation_allowed', False)}",
        f"Exclude short tenure: {cal.get('exclude_short_tenure', 'none')}",
    ]
    job_desc = (cal.get("job_description") or "").strip()
    if job_desc:
        parts.insert(4, f"Job description:\n{job_desc}")
    ideal = (cal.get("ideal_candidate") or "").strip()
    if ideal:
        parts.insert(5, f"Ideal candidate: {ideal}")
    return "\n".join(parts)
