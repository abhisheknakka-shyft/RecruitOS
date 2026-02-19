# RecruitOS

Multi-page app with **Calibrate**, **Dashboard**, **Pipeline**, and **Insights**. Dashboard now includes an async candidate ranking panel with explainable sub-metrics.

## How to run

**You must run both backend and frontend.** If Dashboard, Pipeline, or Insights stay on a loading spinner, the backend is not running or not reachable at `http://localhost:8000`. The app will show an error after ~15s if the API is down.

**1. Backend (from project root)**

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Edit .env: set LLM_PROVIDER and the API key for that provider
```

Then start the API **from the project root** (the folder that contains `backend/`). Do not run uvicorn from inside `backend/` or you'll get `ModuleNotFoundError: No module named 'backend'`.

```bash
cd ..                            # back to project root
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Or from project root in one go: `./run-backend.sh`

API: **http://localhost:8000**

**2. Frontend (new terminal)**

```bash
cd frontend
npm install
npm run dev
```

App: **http://localhost:3000**

**3. Use the app**

- Open http://localhost:3000 → **Calibrate** to set job requirements.
- Use **Dashboard** to upload resumes, see async ranking progress, and inspect detailed sub-metric scoring/evidence.

---

## Stack

- **Frontend**: Next.js (App Router), Tailwind, ShadcnUI, Lucide.
- **Backend**: FastAPI, PyMuPDF; scoring via **OpenAI**, **OpenRouter**, or **Gemini** (env-configurable).

## LLM provider (backend `.env`)

Set `LLM_PROVIDER` to one of `openai`, `openrouter`, `gemini` and the matching API key:

| Provider   | Env vars | Default model |
|-----------|----------|----------------|
| **openrouter** | `OPENROUTER_API_KEY`, optional `MODEL_NAME` | `meta-llama/llama-3.1-8b-instruct:free` |
| **openai**     | `OPENAI_API_KEY`, optional `OPENAI_MODEL`  | `gpt-4o-mini` |
| **gemini**     | `GEMINI_API_KEY` or `GOOGLE_API_KEY`, optional `GEMINI_MODEL` | `gemini-1.5-flash` |

See `backend/.env.example` for a full template.

## Setup (one-time)

- Backend: copy `backend/.env.example` to `backend/.env`, set `LLM_PROVIDER` and the chosen provider’s API key.
- Frontend: optional `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000` if the API is not on that URL.

## Deploy on EC2 / internal infrastructure

Use `docs/DEPLOYMENT_EC2.md` for the production path with:
- Dockerized frontend and backend.
- Separate GitHub Actions workflows for frontend/backend deployment.
- EC2 + Nginx reverse-proxy setup with distinct frontend and API domains.
- Guidance on whether to split repos (monorepo is recommended for now).

## Local Docker smoke test

1. Ensure Docker Desktop/daemon is running.
2. Create backend env:
   - `cp backend/.env.example backend/.env`
   - Set your provider key in `backend/.env` (or the scoring endpoints may fail).
3. Build + run both services:
   - `docker compose -f docker-compose.local.yml up --build`
4. Validate:
   - Frontend: `http://localhost:3000`
   - Backend health: `http://localhost:8000/health`

## Flow

1. **Calibrate** – Set requisition name, role, location, skills (tags), years of experience (slider), seniority levels. Submit to save.
2. **Dashboard** – Upload PDF resumes (multiple). Backend extracts text with PyMuPDF, then asynchronously runs the ranking engine. The dashboard auto-refreshes candidate scores and shows per-metric points, matches, and evidence.

## Deploy frontend on Vercel (fix 404)

The Next.js app lives in **`frontend/`**. If you deploy the repo root, Vercel won’t see a build and you’ll get **404 NOT_FOUND**.

1. In **Vercel** open your project → **Settings** tab.
2. In the left sidebar, open **Build and Deployment** (or scroll to that section).
3. Find **Root Directory** → click **Edit** (or the field), enter **`frontend`**, then **Save**.
4. **Redeploy**: go to the **Deployments** tab → ⋮ on the latest deployment → **Redeploy**.

Vercel will then build and serve the Next.js app from `frontend/`. The **backend** (FastAPI) does not run on Vercel; deploy it elsewhere (e.g. Railway, Render, Fly.io) and set **Environment Variable** in Vercel:

- `NEXT_PUBLIC_API_URL` = your backend URL (e.g. `https://your-backend.up.railway.app`).

---

## API

- `POST /api/calibration` – Create/update calibration (JSON body).
- `GET /api/calibration` – Get current calibration (404 if none).
- `GET /api/candidates` – List candidate records for a calibration.
- `GET /api/candidate-rankings` – List candidates with async scoring status, total score, and sub-metric breakdown.
- `POST /api/candidate-rankings/rescore` – Queue recalculation for all candidates (or one candidate) asynchronously.
- `POST /api/upload` – Upload PDFs (form field `files`); queues scoring asynchronously for each new resume.
