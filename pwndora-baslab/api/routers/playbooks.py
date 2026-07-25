"""Playbook library endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from api.models.playbook import PlaybookMeta
from api.models.session import RESPONSE_ACTIONS
from api.services.session_manager import catalog

router = APIRouter(prefix="/api", tags=["playbooks"])


@router.get("/playbooks", response_model=list[PlaybookMeta], summary="List BAS playbooks")
def list_playbooks() -> list[PlaybookMeta]:
    """Metadata for every bundled playbook.

    Deliberately excludes log evidence, reference indicators and Sigma rules: the
    selection screen must not leak any part of the answer key.
    """
    return catalog.list_playbooks()


@router.get(
    "/playbooks/{playbook_id}",
    response_model=PlaybookMeta,
    summary="Get one playbook's metadata",
)
def get_playbook(playbook_id: str) -> PlaybookMeta:
    playbook = catalog.get_playbook(playbook_id)
    if playbook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"playbook '{playbook_id}' does not exist",
        )
    return PlaybookMeta.from_playbook(playbook)


@router.get(
    "/response-actions",
    response_model=list[str],
    summary="List the seven valid response actions",
)
def list_response_actions() -> list[str]:
    """The Part C radio group options, served from the same constant the scorer uses."""
    return list(RESPONSE_ACTIONS)
