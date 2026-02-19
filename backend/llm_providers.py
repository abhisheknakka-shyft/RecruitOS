"""
LLM provider abstraction. Set LLM_PROVIDER=openai|openrouter|gemini and the
corresponding API key + optional model name in .env.
"""
import json
import os
import re
from typing import Literal, Optional, TypeVar

Provider = Literal["openai", "openrouter", "gemini"]

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "openrouter": "meta-llama/llama-3.1-8b-instruct:free",
    "gemini": "gemini-1.5-flash",
}

T = TypeVar("T")


def get_provider() -> Provider:
    p = (os.environ.get("LLM_PROVIDER") or "openai").strip().lower()
    if p not in ("openai", "openrouter", "gemini"):
        return "openai"
    return p  # type: ignore


def get_model(provider: Provider) -> str:
    key = f"{provider.upper()}_MODEL" if provider != "openrouter" else "MODEL_NAME"
    if provider == "openrouter":
        return os.environ.get("MODEL_NAME") or os.environ.get("OPENROUTER_MODEL") or DEFAULT_MODELS["openrouter"]
    return os.environ.get(key) or DEFAULT_MODELS[provider]


def chat_completion_structured(system: str, user: str, response_model: type[T]) -> Optional[T]:
    """Return structured Pydantic model when using OpenAI (instructor). Else returns None for fallback."""
    provider = get_provider()
    model = get_model(provider)
    if provider == "openai":
        try:
            import instructor
            from openai import OpenAI
            key = os.environ.get("OPENAI_API_KEY", "").strip()
            if not key:
                raise ValueError("OPENAI_API_KEY is not set")
            client = instructor.from_openai(OpenAI(api_key=key))
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.2,
                response_model=response_model,
            )
            return resp  # instructor returns the parsed model
        except Exception:
            return None
    return None


def chat_completion(system: str, user: str) -> str:
    """Returns the assistant message content. Raises ValueError if provider misconfigured or call fails."""
    provider = get_provider()
    model = get_model(provider)

    if provider == "openai":
        from openai import OpenAI
        key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not key:
            raise ValueError("OPENAI_API_KEY is not set")
        client = OpenAI(api_key=key)
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
        )
        return (resp.choices[0].message.content or "").strip()

    if provider == "openrouter":
        from openai import OpenAI
        key = os.environ.get("OPENROUTER_API_KEY", "").strip()
        if not key:
            raise ValueError("OPENROUTER_API_KEY is not set")
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=key,
        )
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
        )
        return (resp.choices[0].message.content or "").strip()

    if provider == "gemini":
        try:
            import google.generativeai as genai
        except ImportError:
            raise ValueError("Gemini provider requires: pip install google-generativeai")
        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "").strip()
        if not key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not set")
        genai.configure(api_key=key)
        gemini = genai.GenerativeModel(model)
        full_prompt = f"{system}\n\n{user}"
        resp = gemini.generate_content(
            full_prompt,
            generation_config={"temperature": 0.2},
        )
        if not resp or not getattr(resp, "text", None):
            raise ValueError("Gemini returned empty response")
        return resp.text.strip()

    raise ValueError(f"Unknown provider: {provider}")


def _build_scoring_prompt(calibration: dict, resume_text: str) -> str:
    """Build prompt for Gemini resume scoring. Passes full resume and job context."""
    role = str(calibration.get("role") or "").strip()
    jd = str(calibration.get("ideal_candidate") or calibration.get("job_description") or "").strip()
    skills = calibration.get("skills") or []
    job_titles = calibration.get("job_titles") or []
    companies = calibration.get("companies") or []
    industries = calibration.get("industries") or []
    schools = calibration.get("schools") or []
    degrees = calibration.get("degrees") or []
    y_min = calibration.get("years_experience_min", 0)
    y_max = calibration.get("years_experience_max", 30)

    job_context = f"""Role: {role or "Not specified"}
Job description / ideal candidate: {jd[:4000] if jd else "Not specified"}
Preferred skills: {", ".join(skills[:20]) if skills else "None"}
Relevant job titles: {", ".join(job_titles[:15]) if job_titles else "None"}
Companies/industries: {", ".join((companies or [])[:10] + (industries or [])[:10]) or "None"}
Schools/degrees: {", ".join((schools or [])[:10] + (degrees or [])[:10]) or "None"}
Years of experience range: {y_min}–{y_max}"""

    return f"""You are an expert recruiter. Score this candidate's resume against the job requirements below. Return exactly one JSON object, no other text.

Required JSON shape:
{{
  "total_score": <0-100 integer>,
  "experience_years": <number or null>,
  "summary": "<1-2 sentence summary>",
  "matched_skills": ["<skill from resume that matches>", ...],
  "matched_titles": ["<title from resume that matches>", ...],
  "matched_companies": ["<company from resume>", ...],
  "matched_industries": ["<industry from resume>", ...],
  "matched_schools": ["<school from resume>", ...],
  "matched_degrees": ["<degree from resume>", ...],
  "sub_metrics": [
    {{ "key": "skills", "label": "Skill Relevance", "rating": <1-5>, "points_earned": <int>, "points_possible": <int>, "matched_terms": [], "evidence": [], "rationale": "<short reason>" }},
    {{ "key": "titles", "label": "Title Relevance", "rating": <1-5>, "points_earned": <int>, "points_possible": <int>, "matched_terms": [], "evidence": [], "rationale": "<short reason>" }},
    {{ "key": "work", "label": "Work Relevance", "rating": <1-5>, "points_earned": <int>, "points_possible": <int>, "matched_terms": [], "evidence": [], "rationale": "<short reason>" }},
    {{ "key": "education", "label": "School Relevance", "rating": <1-5>, "points_earned": <int>, "points_possible": <int>, "matched_terms": [], "evidence": [], "rationale": "<short reason>" }},
    {{ "key": "experience", "label": "Experience Relevance", "rating": <1-5>, "points_earned": <int>, "points_possible": <int>, "matched_terms": [], "evidence": [], "rationale": "<short reason>" }},
    {{ "key": "context", "label": "JD/Ideal Candidate Relevance", "rating": <1-5>, "points_earned": <int>, "points_possible": <int>, "matched_terms": [], "evidence": [], "rationale": "<short reason>" }}
  ]
}}
Use points_possible: 28 skills, 18 titles, 16 work, 10 education, 16 experience, 12 context. Ensure sub_metrics sum to total_score and ratings are 1-5.
Experience: experience_years must be WORK experience only (exclude education). If not stated explicitly, infer from employment section dates only (e.g. Jan 2022 – Dec 2023 = 2 years). Do not count education dates.

--- JOB CONTEXT ---
{job_context}

--- FULL RESUME (use the entire text for scoring) ---
{resume_text}
"""


def score_resume_with_gemini(calibration: dict, resume_text: str):
    """
    Score a resume using Gemini with the full parsed resume text (no truncation).
    Returns RankingPayload on success, None on failure (caller should fall back to rule-based).
    """
    from backend.models import RankingPayload, RankingSubMetric

    if get_provider() != "gemini":
        return None
    resume_text = (resume_text or "").strip()
    if not resume_text:
        return None
    try:
        import google.generativeai as genai
    except ImportError:
        return None
    key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
    if not key:
        return None
    model_name = get_model("gemini")
    genai.configure(api_key=key)
    model = genai.GenerativeModel(model_name)
    prompt = _build_scoring_prompt(calibration, resume_text)
    generation_config = {"temperature": 0.2}
    try:
        types_mod = getattr(genai, "types", None)
        if types_mod and hasattr(types_mod, "GenerationConfig"):
            generation_config = types_mod.GenerationConfig(
                temperature=0.2,
                response_mime_type="application/json",
            )
        elif isinstance(generation_config, dict):
            generation_config["response_mime_type"] = "application/json"
    except Exception:
        pass
    try:
        resp = model.generate_content(
            prompt,
            generation_config=generation_config,
        )
    except Exception:
        return None
    text = getattr(resp, "text", None) if resp else None
    if not text or not isinstance(text, str):
        return None
    data = _extract_json_from_response(text.strip())
    if not data:
        return None
    return _parse_scoring_response(data)


def _parse_scoring_response(data: dict):
    """Build RankingPayload from parsed JSON. Returns None if invalid."""
    from backend.models import RankingPayload, RankingSubMetric

    try:
        total_score = int(data.get("total_score", 0))
        total_score = max(0, min(100, total_score))
    except (TypeError, ValueError):
        total_score = 0
    experience_years = data.get("experience_years")
    if experience_years is not None:
        try:
            experience_years = float(experience_years)
        except (TypeError, ValueError):
            experience_years = None
    summary = str(data.get("summary") or "").strip() or f"Overall candidate match {total_score}%."

    def str_list(val):
        if isinstance(val, list):
            return [str(x).strip() for x in val if str(x).strip()]
        return []

    matched_skills = str_list(data.get("matched_skills"))
    matched_titles = str_list(data.get("matched_titles"))
    matched_companies = str_list(data.get("matched_companies"))
    matched_industries = str_list(data.get("matched_industries"))
    matched_schools = str_list(data.get("matched_schools"))
    matched_degrees = str_list(data.get("matched_degrees"))
    sub_metrics: list[RankingSubMetric] = []
    for sm in data.get("sub_metrics") or []:
        if not isinstance(sm, dict):
            continue
        key = str(sm.get("key") or "").strip() or "context"
        label = str(sm.get("label") or key)
        try:
            rating = int(sm.get("rating", 3))
            rating = max(1, min(5, rating))
        except (TypeError, ValueError):
            rating = 3
        try:
            points_earned = int(sm.get("points_earned", 0))
            points_earned = max(0, points_earned)
        except (TypeError, ValueError):
            points_earned = 0
        try:
            points_possible = int(sm.get("points_possible", 1))
            points_possible = max(1, points_possible)
        except (TypeError, ValueError):
            points_possible = 1
        matched_terms = str_list(sm.get("matched_terms"))
        evidence = str_list(sm.get("evidence"))
        rationale = str(sm.get("rationale") or "").strip()
        sub_metrics.append(
            RankingSubMetric(
                key=key,
                label=label,
                rating=rating,
                points_earned=points_earned,
                points_possible=points_possible,
                matched_terms=matched_terms,
                evidence=evidence,
                rationale=rationale,
            )
        )
    if not sub_metrics:
        return None
    return RankingPayload(
        total_score=total_score,
        experience_years=experience_years,
        summary=summary,
        matched_skills=matched_skills,
        matched_titles=matched_titles,
        matched_companies=matched_companies,
        matched_industries=matched_industries,
        matched_schools=matched_schools,
        matched_degrees=matched_degrees,
        sub_metrics=sub_metrics,
    )


def _extract_json_from_response(text: str) -> dict | None:
    """Extract JSON object from model response (handles markdown code blocks)."""
    text = (text or "").strip()
    json_str = text
    if "```json" in text:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if m:
            json_str = m.group(1).strip()
    elif "```" in text:
        m = re.search(r"```\s*([\s\S]*?)```", text)
        if m:
            json_str = m.group(1).strip()
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None


def score_resume_with_openrouter(calibration: dict, resume_text: str):
    """
    Score a resume using OpenRouter with the full parsed resume text.
    Returns RankingPayload on success, None on failure (caller falls back to rule-based).
    """
    if get_provider() != "openrouter":
        return None
    resume_text = (resume_text or "").strip()
    if not resume_text:
        return None
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        return None
    model = get_model("openrouter")
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)
    prompt = _build_scoring_prompt(calibration, resume_text)
    system = "You are an expert recruiter. Return only valid JSON, no other text or markdown."
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
    except Exception:
        return None
    content = resp.choices[0].message.content if resp.choices else None
    if not content or not isinstance(content, str):
        return None
    data = _extract_json_from_response(content.strip())
    if not data:
        return None
    return _parse_scoring_response(data)
