"""
API key authentication for attorney review endpoints.
Expects X-API-Key header; validates against API_KEY env var.
"""
import os
from typing import Annotated

from fastapi import Header, HTTPException

REQUIRED_HEADER = "X-API-Key"


def verify_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> str:
    """Validate API key from header. Raises 401 if missing or invalid."""
    expected = os.environ.get("API_KEY", "").strip()
    if not expected:
        raise HTTPException(
            status_code=500,
            detail="Server misconfiguration: API_KEY not set",
        )
    if not x_api_key or x_api_key.strip() != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key",
        )
    return x_api_key.strip()
