# RecruitOS Deployment Guide (EC2 + GitHub Actions)

This repo is a monorepo with:
- `frontend/`: Next.js UI
- `backend/`: FastAPI API

## Architecture findings from code scan

1. Backend is currently stateful:
- Persists data to `backend/data/recruitos_data.json`.
- Uses in-process async task queue (`scoring_tasks.py`) and in-memory active job tracking.

2. Scaling implication:
- Run backend as a single process/replica (`UVICORN_WORKERS=1`) in current architecture.
- Horizontal scaling needs a shared DB + shared task queue first.

3. Security changes included:
- `backend/.env.example` no longer includes a real key.
- Backend CORS and trusted hosts are now env-configurable.
- `/health` endpoint added.

## Should frontend/backend be split into separate repos?

No, not required.

Best path now: keep one repo, deploy as two independent services.
- Independent URLs (recommended):  
  - Frontend: `https://recruitos.example.com`  
  - Backend: `https://api.recruitos.example.com`
- Independent CI/CD already configured via path-based workflows:
  - `.github/workflows/deploy-frontend-ec2.yml`
  - `.github/workflows/deploy-backend-ec2.yml`

Split into separate repos only if:
- Different teams own release cadence and permissions.
- You need strict repository-level access separation.

## What was added

1. Containerization:
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `.dockerignore`

2. CI/CD:
- `.github/workflows/deploy-backend-ec2.yml`
- `.github/workflows/deploy-frontend-ec2.yml`

3. EC2 ops templates:
- `deploy/ec2/bootstrap-ubuntu.sh`
- `deploy/ec2/nginx/recruitos.conf`

## Deployment model

GitHub Actions flow:
1. Build Docker image.
2. Push image to GHCR.
3. SSH into EC2.
4. Pull latest image and restart container.

Backend persists JSON data on host volume:
- Host path: `/opt/recruitos/backend/data`
- Mounted into container: `/app/backend/data`

## GitHub configuration

### Repository variables
- `NEXT_PUBLIC_API_URL`  
Example: `https://api.recruitos.example.com`

### Repository secrets

Shared:
- `GHCR_USERNAME`: GHCR username for EC2 pulls
- `GHCR_PULL_TOKEN`: token with `read:packages`

Backend workflow:
- `EC2_BACKEND_HOST`
- `EC2_BACKEND_USER`
- `EC2_BACKEND_SSH_KEY`
- `BACKEND_ENV_B64`: base64-encoded backend `.env` content

Frontend workflow:
- `EC2_FRONTEND_HOST`
- `EC2_FRONTEND_USER`
- `EC2_FRONTEND_SSH_KEY`

### Generate `BACKEND_ENV_B64`

```bash
base64 -i backend/.env | pbcopy
```

Paste clipboard value into `BACKEND_ENV_B64`.

## Backend production env example

Use this as source for your `backend/.env` (do not commit):

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-real-key
MODEL_NAME=meta-llama/llama-3.1-8b-instruct:free

CORS_ALLOWED_ORIGINS=https://recruitos.example.com
TRUSTED_HOSTS=api.recruitos.example.com,localhost,127.0.0.1

RECRUITOS_DATA_DIR=/app/backend/data
PORT=8000
UVICORN_WORKERS=1
```

## EC2 setup

1. Launch Ubuntu EC2 instance(s) and open only required ports:
- Public: `22`, `80`, `443`
- Keep `3000` and `8000` private (or SG-restricted) when using Nginx reverse proxy.

2. Run bootstrap script:

```bash
chmod +x deploy/ec2/bootstrap-ubuntu.sh
./deploy/ec2/bootstrap-ubuntu.sh
```

3. Configure Nginx:
- Copy `deploy/ec2/nginx/recruitos.conf` to `/etc/nginx/sites-available/recruitos`
- Symlink to `/etc/nginx/sites-enabled/recruitos`
- Update domain names
- `sudo nginx -t && sudo systemctl reload nginx`

4. Add TLS (LetsEncrypt/ACM/your internal CA).

## Operational notes

1. Current backend design is not stateless. Keep one backend instance until DB + distributed queue migration.
2. Add auth before internet exposure (API currently has no user auth).
3. Rotate any previously exposed API keys immediately.
