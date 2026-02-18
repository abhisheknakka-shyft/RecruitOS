# RecruitOS – Future improvements

Backlog and ideas for scaling the app (senior full-stack perspective).

## Done in this pass
- **Persistence** – Calibrations and candidates saved to `backend/data/recruitos_data.json`; survive server restart.
- **Delete resume** – Per-candidate remove with confirm; remove from list and detail view.
- **Upload feedback** – Success message after upload (e.g. “3 resumes added to Test 1”); 15MB max per PDF.
- **Extensible candidate model** – `created_at`, `source_filename`; ready for scoring fields (score, metrics, summary) later.

---

## High impact (next)
- **Scoring** – Re-enable LLM scoring per resume vs calibration; show score/breakdown in UI (current model already has placeholders).
- **Search / filter** – Filter candidates by name or parsed-text snippet when lists grow.
- **Bulk delete** – Select multiple resumes and remove in one action.
- **Export** – Export candidate list (CSV/Excel) per job: name, source file, added date, optional score.

## Data & scale
- **Database** – Replace JSON file with SQLite (or Postgres) for concurrent access, migrations, and querying.
- **Pagination** – Cursor or page-based for candidates per job (e.g. 50 per page).
- **Duplicate detection** – Hash first page or filename+size; warn “This resume may already be uploaded.”

## UX & product
- **Toast notifications** – Replace or complement inline success/error with toasts (e.g. sonner).
- **Skeleton loaders** – Per-card loading state while fetching candidates.
- **Keyboard nav** – Arrow keys in candidate list; Escape to close detail.
- **Re-upload / replace** – “Replace PDF” for a candidate without deleting the profile.
- **Sort candidates** – By name, date added, later by score.

## Security & ops
- **Auth** – Login (e.g. NextAuth) and scope data by tenant/user.
- **File validation** – Stricter PDF checks (magic bytes); virus scan hook if needed.
- **Rate limiting** – Throttle upload and API by IP or user.
- **Audit log** – Who added/removed which resume when (needs DB).

## Infra
- **Docker** – Dockerfile and compose for backend + frontend.
- **Env-based API URL** – Already supported; document for staging/prod.
- **Health check** – `GET /health` for load balancers and monitoring.
