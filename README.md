# RecruitOS

Two-page app: **Calibrate** job requirements, then view a **Dashboard** leaderboard of candidates scored by AI.

## How to run

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

- Open http://localhost:3000 → **Calibrate** to set job requirements, then **Dashboard** to upload PDF resumes and see the scored leaderboard.

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

## Flow

1. **Calibrate** – Set requisition name, role, location, skills (tags), years of experience (slider), seniority levels. Submit to save.
2. **Dashboard** – Upload PDF resumes (multiple). Backend extracts text with PyMuPDF, scores each with OpenAI against the calibration, returns a sorted leaderboard. Click the score circle for an insight popover (skill/title/work/experience relevance and summary).

## API

- `POST /api/calibration` – Create/update calibration (JSON body).
- `GET /api/calibration` – Get current calibration (404 if none).
- `GET /api/candidates` – List candidates sorted by score.
- `POST /api/upload` – Upload PDFs (form field `files`); returns updated candidate list.
