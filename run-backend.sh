#!/usr/bin/env bash
# Run from project root (RecruitOS). Do not run from inside backend/.
cd "$(dirname "$0")"
source backend/venv/bin/activate
exec uvicorn backend.main:app --reload --host 0.0.0.0
