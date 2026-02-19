from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable

from backend.llm_providers import get_provider, score_resume_with_gemini, score_resume_with_openrouter
from backend.models import RankingPayload, RankingSubMetric


@dataclass(frozen=True)
class MetricSpec:
    key: str
    label: str
    weight: int


DEFAULT_METRICS: list[MetricSpec] = [
    MetricSpec("skills", "Skill Relevance", 28),
    MetricSpec("titles", "Title Relevance", 18),
    MetricSpec("work", "Work Relevance", 16),
    MetricSpec("education", "School Relevance", 10),
    MetricSpec("experience", "Experience Relevance", 16),
    MetricSpec("context", "JD/Ideal Candidate Relevance", 12),
]


def _get_metrics(calibration: dict) -> list[MetricSpec]:
    """Use calibration scoring weights if any are set; otherwise default metrics. Weights normalized to sum 100."""
    keys = ["skills", "titles", "work", "education", "experience", "context"]
    weight_keys = [
        "scoring_weight_skills",
        "scoring_weight_titles",
        "scoring_weight_work",
        "scoring_weight_education",
        "scoring_weight_experience",
        "scoring_weight_context",
    ]
    labels = [
        "Skill Relevance",
        "Title Relevance",
        "Work Relevance",
        "School Relevance",
        "Experience Relevance",
        "JD/Ideal Candidate Relevance",
    ]
    raw = [calibration.get(wk) for wk in weight_keys]
    if all(v is None for v in raw):
        return DEFAULT_METRICS
    values = [int(v) if v is not None else 0 for v in raw]
    total = sum(values)
    if total <= 0:
        return DEFAULT_METRICS
    # Normalize to sum 100
    normalized = [max(0, min(100, int(round(100 * v / total)))) for v in values]
    # Ensure sum is exactly 100 (rounding may leave 99 or 101)
    diff = 100 - sum(normalized)
    if diff != 0 and normalized:
        idx = 0
        for i in range(1, len(normalized)):
            if normalized[i] > normalized[idx]:
                idx = i
        normalized[idx] = max(0, normalized[idx] + diff)
    return [MetricSpec(keys[i], labels[i], normalized[i]) for i in range(6)]


def score_resume(calibration: dict, resume_text: str) -> RankingPayload:
    # When using Gemini or OpenRouter, score with full parsed resume (no truncation); fall back to rule-based on failure.
    provider = get_provider()
    if (resume_text or "").strip():
        if provider == "gemini":
            payload = score_resume_with_gemini(calibration, resume_text)
        elif provider == "openrouter":
            payload = score_resume_with_openrouter(calibration, resume_text)
        else:
            payload = None
        if payload is not None:
            return payload
    chunks = _chunk_text(resume_text)
    role = str(calibration.get("role") or "").strip()
    skills = _clean_terms(calibration.get("skills", []))
    titles = _clean_terms(calibration.get("job_titles", [])) or ([role] if role else [])
    companies = _clean_terms(calibration.get("companies", []))
    industries = _clean_terms(calibration.get("industries", []))
    schools = _clean_terms(calibration.get("schools", []))
    degrees = _clean_terms(calibration.get("degrees", []))
    ideal_text = str(calibration.get("ideal_candidate") or "")
    jd_text = str(calibration.get("job_description") or "")

    matched_skills, skills_ev, skills_rating = _score_term_metric(chunks, skills, "skills")
    matched_titles, titles_ev, title_rating = _score_term_metric(chunks, titles, "titles")
    work_terms = companies + [t for t in industries if t.lower() not in {x.lower() for x in companies}]
    matched_work, work_ev, work_rating = _score_term_metric(chunks, work_terms, "work")
    matched_schools, school_ev, school_rating = _score_term_metric(chunks, schools, "schools")
    matched_degrees, degree_ev, degree_rating = _score_term_metric(chunks, degrees, "degrees")
    exp_years, exp_ev, exp_rating = _score_experience(chunks, calibration)
    context_terms = _derive_context_terms(role, skills, jd_text, ideal_text)
    _, context_ev, context_rating = _score_term_metric(chunks, context_terms, "context")

    work_matches_companies = [t for t in matched_work if t.lower() in {x.lower() for x in companies}]
    work_matches_industries = [t for t in matched_work if t.lower() in {x.lower() for x in industries}]

    ratings = {
        "skills": skills_rating,
        "titles": title_rating,
        "work": work_rating,
        "education": max(school_rating, degree_rating),
        "experience": exp_rating,
        "context": context_rating,
    }

    evidence_map = {
        "skills": skills_ev,
        "titles": titles_ev,
        "work": work_ev,
        "education": school_ev + [e for e in degree_ev if e not in school_ev],
        "experience": exp_ev,
        "context": context_ev,
    }

    matched_terms_map = {
        "skills": matched_skills,
        "titles": matched_titles,
        "work": matched_work,
        "education": matched_schools + [d for d in matched_degrees if d not in matched_schools],
        "experience": [f"{exp_years:g} years"] if exp_years is not None else [],
        "context": context_terms[:4],
    }

    metrics = _get_metrics(calibration)
    total_points = 0
    sub_metrics: list[RankingSubMetric] = []
    for spec in metrics:
        rating = ratings[spec.key]
        earned = int(round((rating / 5) * spec.weight))
        total_points += earned
        rationale = _build_rationale(spec.key, rating, matched_terms_map[spec.key], spec.weight)
        sub_metrics.append(
            RankingSubMetric(
                key=spec.key,
                label=spec.label,
                rating=rating,
                points_earned=earned,
                points_possible=spec.weight,
                matched_terms=matched_terms_map[spec.key],
                evidence=evidence_map[spec.key][:3],
                rationale=rationale,
            )
        )

    total_score = max(0, min(100, total_points))
    return RankingPayload(
        total_score=total_score,
        experience_years=exp_years,
        summary=_build_summary(total_score, matched_skills, matched_titles, work_matches_companies, exp_years),
        matched_skills=matched_skills,
        matched_titles=matched_titles,
        matched_companies=work_matches_companies,
        matched_industries=work_matches_industries,
        matched_schools=matched_schools,
        matched_degrees=matched_degrees,
        sub_metrics=sub_metrics,
    )


def _clean_terms(values: Iterable[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        term = str(raw or "").strip()
        if not term:
            continue
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(term)
    return out


def _chunk_text(text: str, words_per_chunk: int = 90, overlap: int = 20) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    chunks: list[str] = []
    i = 0
    step = max(1, words_per_chunk - overlap)
    while i < len(words):
        part = words[i : i + words_per_chunk]
        chunks.append(" ".join(part))
        i += step
    return chunks


def _derive_context_terms(role: str, skills: list[str], jd: str, ideal: str) -> list[str]:
    seed = []
    if role:
        seed.extend(_tokenize(role))
    seed.extend([s.lower() for s in skills[:6]])
    seed.extend(_top_tokens(jd, 10))
    seed.extend(_top_tokens(ideal, 8))
    cleaned = [t for t in seed if len(t) > 2]
    unique: list[str] = []
    seen: set[str] = set()
    for t in cleaned:
        if t in seen:
            continue
        seen.add(t)
        unique.append(t)
    return unique[:15]


def _top_tokens(text: str, limit: int) -> list[str]:
    stop = {
        "the",
        "and",
        "for",
        "with",
        "you",
        "that",
        "this",
        "are",
        "from",
        "will",
        "have",
        "your",
        "our",
        "years",
        "experience",
        "candidate",
        "role",
        "job",
    }
    tokens = [t for t in _tokenize(text) if len(t) > 2 and t not in stop]
    counts = Counter(tokens)
    return [token for token, _ in counts.most_common(limit)]


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9+#.-]+", (text or "").lower())


def _score_term_metric(chunks: list[str], terms: list[str], key: str) -> tuple[list[str], list[str], int]:
    if not terms:
        return [], [], 3
    matched = _matched_terms(chunks, terms)
    ratio = len(matched) / max(1, len(terms))
    rating = _ratio_to_rating(ratio)
    evidence = _retrieve_evidence(chunks, matched or terms, key)
    return matched, evidence, rating


def _matched_terms(chunks: list[str], terms: list[str]) -> list[str]:
    hay = " ".join(chunks).lower()
    matched: list[str] = []
    for term in terms:
        t = term.lower().strip()
        if not t:
            continue
        pattern = r"\b" + re.escape(t) + r"\b"
        if re.search(pattern, hay):
            matched.append(term)
    return matched


def _retrieve_evidence(chunks: list[str], terms: list[str], key: str) -> list[str]:
    if not chunks:
        return []
    query_tokens = set(_tokenize(" ".join(terms)))
    ranked: list[tuple[float, str]] = []
    for chunk in chunks:
        chunk_tokens = _tokenize(chunk)
        if not chunk_tokens:
            continue
        overlap = sum(1 for t in chunk_tokens if t in query_tokens)
        density = overlap / len(chunk_tokens)
        phrase_bonus = 0.0
        lchunk = chunk.lower()
        for term in terms[:8]:
            term_l = term.lower()
            if term_l and term_l in lchunk:
                phrase_bonus += 0.15
        score = density + phrase_bonus
        if score > 0:
            ranked.append((score, chunk.strip()))
    ranked.sort(key=lambda x: x[0], reverse=True)
    snippets = [f"{key.title()} evidence: {c[:220]}" for _, c in ranked[:3]]
    return snippets


def _parse_month(s: str) -> int:
    """Return 1-12 for month name or number, else 0."""
    s = (s or "").strip()[:3].lower()
    months = "jan feb mar apr may jun jul aug sep oct nov dec".split()
    if s in months:
        return months.index(s) + 1
    try:
        m = int(s)
        return m if 1 <= m <= 12 else 0
    except ValueError:
        return 0


def _extract_experience_section(text: str) -> str | None:
    """
    Extract the work experience section only (exclude education). Returns None if no clear section.
    """
    lower = text.lower()
    start_markers = ["experience", "work experience", "employment", "professional experience", "career"]
    end_markers = ["education", "academic", "skills", "certifications", "projects", "summary", "objective", "references"]
    start_idx = -1
    for m in start_markers:
        i = lower.find(m)
        if i >= 0 and (start_idx < 0 or i < start_idx):
            start_idx = i
    if start_idx < 0:
        return None
    end_idx = len(text)
    for m in end_markers:
        i = lower.find(m, start_idx + 10)
        if i >= 0 and i < end_idx:
            end_idx = i
    return text[start_idx:end_idx]


def _infer_years_from_date_ranges(text: str) -> float | None:
    """
    Infer total years of experience from employment date ranges when resume
    does not state "X years of experience". Handles e.g. "Jan 2022 – Dec 2023", "Jun 2021– Dec 2021".
    Counts only ranges in the experience section when detectable (excludes education).
    """
    import datetime
    section = _extract_experience_section(text)
    search_text = (section if section else text).lower()
    # Match: Month YYYY – Month YYYY or Month YYYY - Month YYYY (various dashes/spacing)
    pattern = (
        r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\s*[–\-—]\s*"
        r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})"
    )
    total_months = 0.0
    for m in re.finditer(pattern, search_text, re.IGNORECASE):
        y1, y2 = int(m.group(1)), int(m.group(2))
        if y1 > 2100 or y2 > 2100 or y1 < 1990 or y2 < 1990:
            continue
        full = m.group(0)
        parts = re.split(r"[–\-—]", full, maxsplit=1)
        start_part = (parts[0] if parts else "").strip()
        end_part = (parts[1] if len(parts) > 1 else "").strip()
        mon1 = _parse_month(re.match(r"[a-z]+", start_part, re.I).group(0) if re.match(r"[a-z]+", start_part, re.I) else "")
        mon2 = _parse_month(re.match(r"[a-z]+", end_part, re.I).group(0) if re.match(r"[a-z]+", end_part, re.I) else "")
        if mon1 == 0:
            mon1 = 1
        if mon2 == 0:
            mon2 = 12
        try:
            d1 = datetime.date(y1, mon1, 1)
            d2 = datetime.date(y2, mon2, 1)
            if d2 >= d1:
                total_months += (d2.year - d1.year) * 12 + (d2.month - d1.month) + 1
        except (ValueError, TypeError):
            total_months += max(0, (y2 - y1) * 12)
    if total_months <= 0:
        return None
    return round(total_months / 12.0, 1)


def _score_experience(chunks: list[str], calibration: dict) -> tuple[float | None, list[str], int]:
    text = " ".join(chunks)
    text_lower = text.lower()
    inferred = _infer_years_from_date_ranges(text_lower)
    values: list[float] = []
    for pattern in [
        r"(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years|year|yrs|yr)\b",
        r"over\s+(\d{1,2}(?:\.\d+)?)\s*(?:years|year)\b",
        r"(\d{1,2}(?:\.\d+)?)\s*(?:years|year)\s+of\s+experience",
    ]:
        for match in re.findall(pattern, text_lower):
            try:
                v = float(match)
            except ValueError:
                continue
            if 0 <= v <= 60:
                values.append(v)
    explicit = max(values) if values else None
    if explicit is not None and inferred is not None and explicit > inferred + 3:
        exp_years = inferred
    elif explicit is not None:
        exp_years = explicit
    elif inferred is not None and 0 <= inferred <= 60:
        exp_years = inferred
    else:
        exp_years = None
    lo = _to_int(calibration.get("years_experience_min"), 0)
    hi = _to_int(calibration.get("years_experience_max"), 30)
    if lo > hi:
        lo, hi = hi, lo
    if exp_years is None:
        return None, [], 2
    evidence = [f"Experience evidence: detected {exp_years:g} years in resume."]
    if lo <= exp_years <= hi:
        return exp_years, evidence, 5
    if exp_years < lo:
        gap = lo - exp_years
        if gap <= 1:
            return exp_years, evidence, 4
        if gap <= 3:
            return exp_years, evidence, 3
        if gap <= 5:
            return exp_years, evidence, 2
        return exp_years, evidence, 1
    # Above range: usually acceptable for seniority.
    gap = exp_years - hi
    return exp_years, evidence, 4 if gap <= 3 else 3


def _ratio_to_rating(ratio: float) -> int:
    if ratio >= 0.9:
        return 5
    if ratio >= 0.65:
        return 4
    if ratio >= 0.4:
        return 3
    if ratio >= 0.2:
        return 2
    return 1


def _to_int(raw: object, default: int) -> int:
    try:
        return int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _build_rationale(key: str, rating: int, matched_terms: list[str], points_possible: int) -> str:
    if not matched_terms and key != "experience":
        return f"Limited direct evidence found in parsed resume text. {rating}/5 for this criterion."
    if key == "experience":
        if matched_terms:
            return f"Detected {matched_terms[0]} against target experience band. {rating}/5."
        return f"Unable to confidently extract years of experience. {rating}/5."
    return (
        f"Matched {len(matched_terms)} signal term{'s' if len(matched_terms) != 1 else ''}; "
        f"awarded {int(round((rating / 5) * points_possible))}/{points_possible} points."
    )


def _build_summary(
    total_score: int,
    matched_skills: list[str],
    matched_titles: list[str],
    matched_companies: list[str],
    exp_years: float | None,
) -> str:
    highlights: list[str] = []
    if matched_skills:
        highlights.append(f"{len(matched_skills)} skill match{'es' if len(matched_skills) != 1 else ''}")
    if matched_titles:
        highlights.append(f"{len(matched_titles)} title match{'es' if len(matched_titles) != 1 else ''}")
    if matched_companies:
        highlights.append(f"{len(matched_companies)} company match{'es' if len(matched_companies) != 1 else ''}")
    if exp_years is not None:
        highlights.append(f"{exp_years:g} years experience detected")
    if not highlights:
        return f"Overall candidate match {total_score}% using resume-to-requisition retrieval scoring."
    return f"{', '.join(highlights)}. Overall candidate match {total_score}%."
