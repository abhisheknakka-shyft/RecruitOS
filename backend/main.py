from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import calibration, candidates

app = FastAPI(title="AutoRecruit API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(calibration.router, prefix="/api", tags=["calibration"])
app.include_router(candidates.router, prefix="/api", tags=["candidates"])
