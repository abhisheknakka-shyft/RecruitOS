# RecruitOS – Judge Presentation

**One-line pitch:** RecruitOS is an AI-assisted Applicant Tracking System (ATS) that lets HR define job requirements once (Calibrate), collect and manage candidates per job (Dashboard), move them through pipeline stages (Pipeline), and see hiring analytics (Insights). It’s built around **job postings as structured configurations**, not just text ads.

---

## 1. What We Built – Features at a Glance

| Feature | What it does |
|--------|----------------|
| **Multi-job support** | Create and switch between multiple job postings (requisitions). Each has its own candidates and pipeline. |
| **Structured calibration** | Define role, locations, skills, years of experience, seniority, education, workplace type, ideal candidate, and full job description in one place. |
| **PDF resume handling** | Upload PDFs per job. Backend extracts text (PyMuPDF/Marker). No manual copy-paste. |
| **Pipeline stages** | Every job has stages (e.g. Applied → Screening → Interview → Offer). Move candidates between stages from Dashboard or Pipeline. |
| **Per-candidate rating & notes** | Rate 1–5 stars; add private notes. Stage and rating visible in list and detail. |
| **Pipeline (Kanban) view** | See all candidates by stage in columns. Drag-and-drop or “Move to” to change stage. |
| **Insights / analytics** | At-a-glance counts by stage, pipeline distribution (donut), hiring trends table, by-requisition breakdown. Filter by **month of application received**. |
| **Templates** | Save a job as a template; create new jobs from templates. |
| **Persistence** | Data stored in JSON; survives server restart. |

---

## 2. How Scoring Works (Points per Dimension, Not Percentages That Sum to 100)

When scoring is enabled, the system compares each resume to the **calibration** (job requirements) and produces a **rating 1–5** for each of six dimensions. Each dimension has a **weight** (max points). You earn a fraction of that weight based on the rating. The **total score** is the **sum of points earned** across dimensions, capped at 100. So the total is **not** “six percentages that add up to 100”; it’s “points earned out of a weighted total, with the cap at 100.”

### Dimensions and default weights (recruiter can change these per job)

| Dimension | Default weight (max points) | Meaning |
|-----------|-----------------------------|---------|
| **Skills** | 28 | Match of resume skills to required/preferred skills. |
| **Titles** | 18 | Fit of current/past job titles to the role. |
| **Work** | 16 | Relevance of companies, industries, and work context. |
| **Education** | 10 | Schools and degrees vs calibration. |
| **Experience** | 16 | Years of experience vs required range. |
| **Context** | 12 | JD / ideal-candidate language and context. |

Default weights sum to **100**. Recruiters can set custom weights per job (e.g. more on Skills, less on Education); the backend normalizes them so the six weights still sum to 100.

### How points are computed

- For each dimension the engine produces a **rating from 1 to 5** (from resume vs calibration, using term matching and rules).
- **Points earned** for that dimension = `round((rating / 5) × weight)`.
- Example: **Skills** weight 28, rating 3 → points earned = round(28 × 3/5) = **17**. So you see **17/28** for Skills.
- Example: **Titles** weight 18, rating 1 → points earned = round(18 × 1/5) = **4**. So you see **4/18** for Titles.

**Total score** = sum of the six “points earned” values, then **capped between 0 and 100**. So if the raw sum is 73, the candidate’s score is 73; if the raw sum is 105, the score is 100. There is no separate “bottom that sums to 100”—the **weights** define the max points per dimension, and the **total** is simply the sum of what was earned (with a cap of 100).

### In the UI

- Each sub-metric is shown as **points_earned / points_possible** (e.g. 17/28, 4/18), with the 1–5 rating and optional evidence/rationale.
- The **overall score** is the capped sum above (0–100), used for ranking and display.

Scoring is **consistent per job** because every candidate is evaluated against the **same calibration** (and, if set, the same custom weights) for that requisition.

---

## 3. The Four Pages – What Each One Does

### Calibrate (Configuration / Job Posting)

- **Purpose:** Define *what* you’re hiring for. This is the single source of truth for the role.
- **What you set:**
  - **Requisition name** (e.g. “Data Architect – Q1”)
  - **Hiring company**, **job locations**, **role**, **full job description**
  - **Ideal candidate** (free text: who you’ve hired before or would hire)
  - **Refine requirements:** skills (tags), job titles, companies, industries, seniority levels, years of experience (slider: total vs relevant), education (schools, degrees, graduation year range), workplace type (Onsite/Hybrid/Remote), relocation, exclude short tenures
- **Output:** A saved **calibration** (job config) that drives matching, scoring, and pipeline for that job. You can create new jobs, edit existing ones, or copy from templates.
- **Why it matters for judges:** This is not a “post and forget” job ad. It’s a **structured configuration** that the rest of the product uses for consistency and automation.

### Dashboard

- **Purpose:** Operate at the **job level**. One card per job; inside each card, manage that job’s candidates.
- **What you do:**
  - **Upload resumes** (PDFs) for that job. Text is extracted; candidates appear in the list.
  - **See candidates** with initials, name (from parsed text), stage, and rating.
  - **Change stage** via dropdown on each row.
  - **Open a candidate** → detail view: full parsed text, stage dropdown, 1–5 rating, private notes (saved on blur), remove resume.
  - **Edit job** (link to Calibrate), **copy job**, **save as template**, **delete job** from the card.
- **Why it matters:** All actions are **scoped to the requisition**. No mixing candidates across jobs.

### Pipeline

- **Purpose:** View applications **by stage** (Kanban). Move candidates between stages quickly.
- **What you see:**
  - One section per job (requisition name + role).
  - Columns: Applied, Screening, Interview, Offer (and Rejected if configured). Each column shows count and candidate cards.
  - **Move candidates:** Drag a card (grip handle) to another column, or use “Move to” dropdown on the card.
- **Why it matters:** HR can answer “where is this applicant?” and “who’s in Interview?” at a glance, without opening the Dashboard list.

### Insights

- **Purpose:** HR analytics on **hiring funnel and volume**.
- **What you see:**
  - **At a glance:** Counts per stage (Applications, Screening, Interview, Offer, Rejected) across all jobs or filtered by **month of application received**.
  - **Pipeline distribution:** Donut chart of candidates by stage.
  - **Hiring trends:** Table of stage, count, and % of total.
  - **By requisition:** Table of each job with stage counts and total.
- **Filter:** “Date of application received” = month (and year). Uses candidate `created_at` (when the resume was added).
- **Why it matters:** Shows **what’s happening** in the funnel without opening each job. Month filter supports “applications received in January”–style reporting.

---

## 4. How “Job Postings” Are Different in RecruitOS

In most systems, a **job posting** is:

- A **public ad** (title, description, apply button) aimed at **candidates**.
- Often **unstructured** (rich text). Used for marketing and apply flow, not for consistent evaluation.

In **RecruitOS**, a job posting is a **private, structured configuration** aimed at **HR and the system**:

| Aspect | Typical job posting | RecruitOS “job posting” (calibration) |
|--------|----------------------|----------------------------------------|
| **Audience** | Candidates (external) | HR + AI (internal) |
| **Structure** | Free text, maybe a few fields | Structured: role, locations, skills, years, seniority, education, workplace type, ideal candidate, full JD |
| **Use** | Attract applicants; link to apply | **Define the bar** for screening, scoring, and pipeline |
| **Consistency** | Different jobs described in different ways | Same schema for every job → consistent matching and analytics |
| **Lifecycle** | Publish / unpublish / expire | Create → use for candidates → optional template for next role |

So in RecruitOS:

- **“Job posting” = calibration.** It’s the **definition of the role** that drives:
  - What we compare resumes against (for scoring).
  - What pipeline stages and filters we show.
  - How we aggregate in Insights (by requisition).
- We are **not** (in this build) publishing these to a career site or job board. We are **configuring the ATS** so that every candidate is evaluated and tracked against the same, explicit requirements.

**One sentence for judges:** “Our job postings are structured calibrations that define the role once and drive consistent candidate evaluation, pipeline, and analytics—rather than one-off text ads.”

---

## 5. Suggested Talking Points for the Demo

1. **Start with Calibrate:** “We define the job once: role, skills, experience, education. That’s our calibration.”
2. **Dashboard:** “Resumes are uploaded per job. We see who’s in which stage and rate them. Everything is per requisition.”
3. **Pipeline:** “Pipeline view shows the funnel. We move candidates by dragging or using ‘Move to.’”
4. **Insights:** “Insights show volume by stage and by month of application, so we can see trends without opening each job.”
5. **Differentiation:** “Our job postings aren’t just ads—they’re the config that powers scoring, pipeline, and analytics so hiring stays consistent and data-driven.”

---

## 6. Tech Stack (Brief)

- **Frontend:** Next.js (App Router), Tailwind, ShadcnUI, Recharts, @dnd-kit (drag-and-drop).
- **Backend:** FastAPI, PyMuPDF/Marker for PDF text extraction, optional LLM scoring (OpenAI / OpenRouter / Gemini).
- **Data:** JSON file persistence (calibrations + candidates per job). Ready for DB migration.

Use this doc as your script or export sections into slides (e.g. one slide per page + one slide on “How job postings are different”).
