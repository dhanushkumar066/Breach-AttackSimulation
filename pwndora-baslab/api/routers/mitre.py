"""ATT&CK Enterprise reference endpoints backing the Part A technique dropdown."""

from __future__ import annotations

from fastapi import APIRouter, Query

from api.models.playbook import MitreTechnique
from api.services.session_manager import catalog

router = APIRouter(prefix="/api/mitre", tags=["mitre"])


@router.get(
    "/techniques",
    response_model=list[MitreTechnique],
    summary="List ATT&CK Enterprise techniques",
)
def list_techniques(
    search: str | None = Query(
        default=None,
        max_length=64,
        description="Case-insensitive match against technique id, name or tactic.",
    ),
    tactic: str | None = Query(
        default=None,
        max_length=64,
        description="Exact (case-insensitive) tactic filter, e.g. 'Credential Access'.",
    ),
    limit: int = Query(default=500, ge=1, le=1000),
) -> list[MitreTechnique]:
    """The bundled ATT&CK Enterprise catalog.

    Served entirely from ``api/data/enterprise-attack-techniques.json`` — the module
    makes no call to attack.mitre.org at runtime.
    """
    return catalog.list_mitre_techniques(search=search, tactic=tactic, limit=limit)


@router.get("/tactics", response_model=list[str], summary="List ATT&CK tactics")
def list_tactics() -> list[str]:
    """Distinct tactic names present in the bundled catalog."""
    return catalog.list_tactics()
