from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable

from backend.models import RankingPayload, RankingSubMetric


@dataclass(frozen=True)
class MetricSpec:
    key: str
    label: str
    weight: int


METRICS: list[MetricSpec] = [
    MetricSpec("skills", "Skill Relevance", 28),
    MetricSpec("titles", "Title Relevance", 18),
    MetricSpec("work", "Work Relevance", 16),
    MetricSpec("education", "School Relevance", 10),
    MetricSpec("experience", "Experience Relevance", 16),
    MetricSpec("context", "JD/Ideal Candidate Relevance", 12),
]


def score_resume(calibration: dict, resume_text: str) -> RankingPayload:
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

    total_points = 0
    sub_metrics: list[RankingSubMetric] = []
    for spec in METRICS:
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


def _score_experience(chunks: list[str], calibration: dict) -> tuple[float | None, list[str], int]:
    text = " ".join(chunks).lower()
    values: list[float] = []
    for pattern in [
        r"(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years|year|yrs|yr)\b",
        r"over\s+(\d{1,2}(?:\.\d+)?)\s*(?:years|year)\b",
        r"(\d{1,2}(?:\.\d+)?)\s*(?:years|year)\s+of\s+experience",
    ]:
        for match in re.findall(pattern, text):
            try:
                v = float(match)
            except ValueError:
                continue
            if 0 <= v <= 60:
                values.append(v)
    exp_years = max(values) if values else None
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
