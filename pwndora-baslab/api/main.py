"""PWNDORA BASLab API.

Track T-03 EPME · Problem Statement BSCDS26-EPME-02 · BlackPerl DFIR.

Run locally::

    uvicorn api.main:app --reload --port 8000

The bundled playbook library and ATT&CK catalog are validated during startup, so
the process refuses to serve traffic if the content files are malformed.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import __version__
from api.routers import mitre, playbooks, sessions
from api.services.session_manager import CatalogError, catalog, session_manager

logger = logging.getLogger("baslab")

#: Frontend origins permitted to call this API. Overridable for deployment, but
#: never a wildcard: the default covers the nginx container and the Vite dev server.
DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"


def _allowed_origins() -> list[str]:
    raw = os.getenv("BASLAB_CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if "*" in origins:
        # A wildcard would let any page on the internet drive a learner's session.
        raise RuntimeError("BASLAB_CORS_ORIGINS must name explicit origins, not '*'")
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load and validate bundled content before the first request is served."""
    logging.basicConfig(
        level=os.getenv("BASLAB_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    )
    catalog.load()
    logger.info(
        "catalog loaded: %d playbooks, %d techniques, %d ATT&CK entries",
        catalog.playbook_count,
        catalog.technique_count,
        catalog.mitre_count,
    )
    yield
    session_manager.clear()
    logger.info("session store cleared on shutdown")


app = FastAPI(
    title="PWNDORA BASLab API",
    version=__version__,
    description=(
        "Breach & Attack Simulation training module for the PWNDORA platform. "
        "Reveals one ATT&CK technique at a time, scores a three-part detection "
        "decision deterministically, and produces a Control Effectiveness Report."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline hardening headers on every API response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(CatalogError)
async def catalog_error_handler(request: Request, exc: CatalogError) -> JSONResponse:
    """Content problems are server faults, and are logged rather than echoed."""
    logger.error("catalog error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "bundled playbook content could not be read"},
    )


app.include_router(playbooks.router)
app.include_router(sessions.router)
app.include_router(mitre.router)


@app.get("/api/health", tags=["meta"], summary="Liveness and content check")
def health() -> dict[str, object]:
    """Used by docker-compose healthchecks and by the judges' smoke test."""
    return {
        "status": "ok",
        "version": __version__,
        "problem_statement": "BSCDS26-EPME-02",
        "playbooks": catalog.playbook_count,
        "techniques": catalog.technique_count,
        "mitre_techniques": catalog.mitre_count,
        "active_sessions": session_manager.active_sessions,
    }
