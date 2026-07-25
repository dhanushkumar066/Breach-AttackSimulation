"""Session-layer models: learner decisions, per-step results and the request/response
DTOs used by the step-by-step execution engine.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from api.models.playbook import LogEntry

ResponseAction = Literal[
    "Isolate Host",
    "Block IP/Domain",
    "Kill Process",
    "Revoke Credentials",
    "Alert SOC Only",
    "Quarantine File",
    "No Action Required",
]

#: Ordered tuple of the seven valid Part C response actions, exposed to the client
#: so the radio group and the backend can never drift apart.
RESPONSE_ACTIONS: tuple[str, ...] = (
    "Isolate Host",
    "Block IP/Domain",
    "Kill Process",
    "Revoke Credentials",
    "Alert SOC Only",
    "Quarantine File",
    "No Action Required",
)

StepStatus = Literal["pending", "submitted"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Decision(BaseModel):
    """The learner's three-part detection decision for a single step."""

    model_config = ConfigDict(extra="forbid")

    technique_id: str = Field(pattern=r"^T\d{4}(\.\d{3})?$")
    indicators: list[str] = Field(default_factory=list, max_length=64)
    response_action: ResponseAction


class WeightedBreakdown(BaseModel):
    """Per-part contribution to the composite step score."""

    model_config = ConfigDict(extra="forbid")

    technique_contribution: float
    indicator_contribution: float
    response_contribution: float


class StepResult(BaseModel):
    """Deterministic evaluation of one step, including the revealed answer key."""

    model_config = ConfigDict(extra="forbid")

    step_index: int
    step_score: float
    technique_correct: bool
    indicator_jaccard: float
    response_correct: bool
    weighted_breakdown: WeightedBreakdown

    # --- Revealed only after submission -------------------------------------
    technique_id: str
    technique_name: str
    tactic: str
    technique_description: str
    learner_technique_id: str
    learner_response_action: str
    correct_response_action: str
    correct_indicators: list[str]
    matched_indicators: list[str]
    missed_indicators: list[str]
    false_positive_indicators: list[str]
    sigma_rule_yaml: str
    sigma_rule_title: str


class SessionState(BaseModel):
    """Server-side state for one BAS run. Held in memory only."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    playbook_id: str
    playbook_name: str
    threat_actor: str
    total_steps: int
    current_step_index: int = 0
    step_status: StepStatus = "pending"
    step_results: list[StepResult] = Field(default_factory=list)
    completed: bool = False
    started_at: datetime = Field(default_factory=_utcnow)
    completed_at: datetime | None = None
    base_session_id: str | None = None


# ---------------------------------------------------------------------------
# Request / response DTOs
# ---------------------------------------------------------------------------


class StartSessionRequest(BaseModel):
    """POST /api/session/start"""

    model_config = ConfigDict(extra="forbid")

    playbook_id: str = Field(min_length=1, max_length=128)
    base_session_id: str | None = Field(default=None, max_length=26)


class StepResponse(BaseModel):
    """The learner-visible view of a step: evidence only, never the technique."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    step_index: int
    step_number: int
    total_steps: int
    step_status: StepStatus
    log_evidence: list[LogEntry]
    checkbox_options: list[str]
    response_actions: list[str]
    completed: bool = False


class StartSessionResponse(BaseModel):
    """POST /api/session/start — session handle plus the first step."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    playbook_id: str
    playbook_name: str
    threat_actor: str
    total_steps: int
    step: StepResponse


class EvaluateRequest(BaseModel):
    """POST /api/session/{session_id}/evaluate"""

    model_config = ConfigDict(extra="forbid")

    technique_id: str = Field(pattern=r"^T\d{4}(\.\d{3})?$")
    indicators: list[str] = Field(default_factory=list, max_length=64)
    response_action: ResponseAction


class EvaluateResponse(BaseModel):
    """The graded step plus the running session score."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    result: StepResult
    running_score: float
    steps_evaluated: int
    total_steps: int
    is_final_step: bool


class AdvanceResponse(BaseModel):
    """POST /api/session/{session_id}/advance"""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    completed: bool
    step: StepResponse | None = None
