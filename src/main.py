"""
FastAPI application for Legal Intake Voice Service.
Provides GET /api/calls for attorney review of redacted intake records.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.api.calls import router as calls_router
from src.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure DB tables exist on startup."""
    init_db()
    yield


app = FastAPI(
    title="Legal Intake Voice Service",
    description="API for attorney review of redacted intake call records (FRBP 9037).",
    lifespan=lifespan,
)
app.include_router(calls_router)


@app.get("/health")
def health() -> dict:
    """Liveness/readiness check."""
    return {"status": "ok"}
