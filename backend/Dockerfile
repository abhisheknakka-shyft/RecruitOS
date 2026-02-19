FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip && pip install -r /tmp/requirements.txt

COPY backend /app/backend

RUN useradd --create-home --shell /bin/bash --uid 10001 appuser && \
    mkdir -p /app/backend/data && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

ENV PORT=8000 \
    UVICORN_WORKERS=1

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS:-1}"]
