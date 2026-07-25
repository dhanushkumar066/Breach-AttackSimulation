"""Step-by-step BAS execution engine.

Session lifecycle::

    start ─► current-step ─► evaluate ─► advance ─► … ─► completed ─► report
                                                                   └─► export/riskview360

Two invariants are enforced here and nowhere else:

1. The technique identity for the *current* step is never serialised until the
   learner has submitted a decision for it.
2. ``advance`` is refused with 403 while the current step is unsubmitted, so a
   learner cannot skip a technique to avoid being scored on it.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from api.models.report import (
    ComparisonResult,
    ControlEffectivenessReport,
    RiskView360Export,
)
from api.models.session import (
    AdvanceResponse,
    Decision,
    EvaluateRequest,
    EvaluateResponse,
    SessionState,
    StartSessionRequest,
    StartSessionResponse,
    StepResponse,
)
from api.services import report_generator
from api.services.scoring_engine import evaluate_step, running_score
from api.services.session_manager import catalog, session_manager

router = APIRouter(prefix="/api/session", tags=["session"])


def _load_session(session_id: str) -> SessionState:
    """Resolve a session handle or fail with 404.

    The ULID is the bearer credential for the run: it is validated for shape before
    the store is touched, and an unknown or malformed handle is indistinguishable
    in the response, so the endpoint cannot be used to probe for live sessions.
    """
    state = session_manager.get_session(session_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found or expired",
        )
    return state


@router.post(
    "/start",
    response_model=StartSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a BAS run and receive the first step",
)
def start_session(payload: StartSessionRequest) -> StartSessionResponse:
    """Create a session and return the first step's evidence.

    The response contains log evidence and checkbox options only. Nothing in it
    reveals which ATT&CK technique the evidence belongs to.
    """
    playbook = catalog.get_playbook(payload.playbook_id)
    if playbook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"playbook '{payload.playbook_id}' does not exist",
        )

    base_session_id = payload.base_session_id
    if base_session_id is not None:
        base = session_manager.get_session(base_session_id)
        if base is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="base_session_id does not reference a known session",
            )
        if base.playbook_id != payload.playbook_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="a comparison run must replay the same playbook as its base session",
            )

    state = session_manager.create_session(playbook, base_session_id=base_session_id)
    return StartSessionResponse(
        session_id=state.session_id,
        playbook_id=state.playbook_id,
        playbook_name=state.playbook_name,
        threat_actor=state.threat_actor,
        total_steps=state.total_steps,
        step=catalog.build_step_response(state),
    )


@router.get(
    "/{session_id}/current-step",
    response_model=StepResponse,
    summary="Get the current step's evidence (technique identity withheld)",
)
def get_current_step(session_id: str) -> StepResponse:
    state = _load_session(session_id)
    if state.completed:
        return StepResponse(
            session_id=state.session_id,
            step_index=state.current_step_index,
            step_number=state.total_steps,
            total_steps=state.total_steps,
            step_status="submitted",
            log_evidence=[],
            checkbox_options=[],
            response_actions=[],
            completed=True,
        )
    return catalog.build_step_response(state)


@router.post(
    "/{session_id}/evaluate",
    response_model=EvaluateResponse,
    summary="Submit the three-part detection decision for the current step",
)
def evaluate(session_id: str, payload: EvaluateRequest) -> EvaluateResponse:
    """Grade the current step and reveal its answer key.

    Re-submitting an already-graded step is refused with 409 so that a learner
    cannot iterate towards the answer. To verify determinism, replay the whole
    playbook in a fresh session with identical answers: the scores are identical.
    """
    state = _load_session(session_id)

    if state.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="session is already complete; start a new run to play again",
        )
    if state.step_status == "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"step {state.current_step_index + 1} has already been evaluated; "
                "advance to the next technique"
            ),
        )

    technique = catalog.get_technique(state.playbook_id, state.current_step_index)
    if technique is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="session references a step that is not present in the playbook",
        )

    # Only options the backend actually offered for this step are scoreable. This
    # stops a crafted client from submitting the reference indicators verbatim
    # without them having been rendered as checkboxes.
    offered = set(
        catalog.build_checkbox_options(state.session_id, state.current_step_index, technique)
    )
    unknown = [i for i in payload.indicators if i not in offered]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{len(unknown)} submitted indicator(s) were not offered for this step",
        )

    decision = Decision(
        technique_id=payload.technique_id,
        indicators=list(dict.fromkeys(payload.indicators)),
        response_action=payload.response_action,
    )
    result = evaluate_step(decision, technique, step_index=state.current_step_index)

    state.step_results.append(result)
    state.step_status = "submitted"
    session_manager.update_session(state)

    return EvaluateResponse(
        session_id=state.session_id,
        result=result,
        running_score=running_score(state.step_results, state.total_steps),
        steps_evaluated=len(state.step_results),
        total_steps=state.total_steps,
        is_final_step=state.current_step_index == state.total_steps - 1,
    )


@router.post(
    "/{session_id}/advance",
    response_model=AdvanceResponse,
    summary="Advance to the next technique",
)
def advance(session_id: str) -> AdvanceResponse:
    """Move to the next step, or complete the session after the final one."""
    state = _load_session(session_id)

    if state.completed:
        return AdvanceResponse(session_id=state.session_id, completed=True, step=None)

    if state.step_status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"step {state.current_step_index + 1} has not been evaluated yet; "
                "submit a detection decision before advancing"
            ),
        )

    if state.current_step_index >= state.total_steps - 1:
        state.completed = True
        state.completed_at = datetime.now(timezone.utc)
        session_manager.update_session(state)
        return AdvanceResponse(session_id=state.session_id, completed=True, step=None)

    state.current_step_index += 1
    state.step_status = "pending"
    session_manager.update_session(state)
    return AdvanceResponse(
        session_id=state.session_id,
        completed=False,
        step=catalog.build_step_response(state),
    )


@router.get(
    "/{session_id}/report",
    response_model=ControlEffectivenessReport,
    summary="Control Effectiveness Report for a completed run",
)
def get_report(session_id: str) -> ControlEffectivenessReport:
    state = _load_session(session_id)
    if not state.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"session is still in progress ({len(state.step_results)}/{state.total_steps} "
                "steps evaluated); complete the playbook to generate the report"
            ),
        )
    return report_generator.build_report(state)


@router.get(
    "/{session_id}/export/riskview360",
    response_model=RiskView360Export,
    summary="RiskView360-compatible JSON export",
)
def export_riskview360(session_id: str) -> RiskView360Export:
    state = _load_session(session_id)
    if not state.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="session is still in progress; complete the playbook before exporting",
        )
    return report_generator.build_riskview360_export(state)


@router.get(
    "/{session_id}/comparison",
    response_model=ComparisonResult,
    summary="Compare two completed runs of the same playbook",
)
def compare(
    session_id: str,
    compare_with: str = Query(
        ...,
        max_length=26,
        description="Session id of the other completed run to compare against.",
    ),
) -> ComparisonResult:
    """Side-by-side delta between two runs.

    ``session_id`` is treated as run 1 and ``compare_with`` as run 2, so the
    improvement delta reads as "run 2 minus run 1".
    """
    run_1 = _load_session(session_id)
    run_2 = _load_session(compare_with)

    if run_1.session_id == run_2.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="a session cannot be compared with itself",
        )
    if run_1.playbook_id != run_2.playbook_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="only runs of the same playbook can be compared",
        )
    if not (run_1.completed and run_2.completed):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="both runs must be complete before they can be compared",
        )

    return report_generator.build_comparison(run_1, run_2)
