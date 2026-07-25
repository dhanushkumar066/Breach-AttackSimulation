"""Report-layer models: the Control Effectiveness Report, the RiskView360 export
schema and the run-over-run comparison payload.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ControlStatus = Literal["DETECTED", "PARTIALLY_DETECTED", "MISSED"]


class SessionScore(BaseModel):
    """Aggregate outcome across every evaluated step of a run."""

    model_config = ConfigDict(extra="forbid")

    session_score: float
    detection_rate: float
    techniques_detected: int
    total_techniques: int


class TechniqueResult(BaseModel):
    """One row of the report table: what happened on a single kill-chain step."""

    model_config = ConfigDict(extra="forbid")

    step: int
    technique_id: str
    technique_name: str
    tactic: str
    learner_technique_id: str
    detected: bool
    indicator_jaccard: float
    response_correct: bool
    step_score: float
    missed_indicators: list[str]
    sigma_rule_title: str
    control_status: ControlStatus


class ControlGap(BaseModel):
    """A technique the learner's controls failed to catch, with remediation."""

    model_config = ConfigDict(extra="forbid")

    technique_id: str
    technique_name: str
    tactic: str
    gap_reason: str
    recommended_control: str
    sigma_rule_title: str


class SigmaRecommendation(BaseModel):
    """A Sigma rule the learner should deploy, carried with its own YAML."""

    model_config = ConfigDict(extra="forbid")

    technique_id: str
    title: str
    sigma_yaml: str


class ControlEffectivenessReport(BaseModel):
    """GET /api/session/{session_id}/report"""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    playbook_id: str
    playbook_name: str
    threat_actor: str
    completed_at: str
    overall_detection_rate: float
    session_score: float
    techniques_detected: int
    total_techniques: int
    technique_results: list[TechniqueResult]
    security_control_gaps: list[ControlGap]
    sigma_recommendations: list[SigmaRecommendation]
    riskview360_compatible: bool = True
    riskview360_export_url: str


class RiskView360Coverage(BaseModel):
    """One ATT&CK coverage row inside the RiskView360 export."""

    model_config = ConfigDict(extra="forbid")

    technique_id: str
    tactic: str
    detected: bool
    control_status: ControlStatus


class RiskView360Export(BaseModel):
    """GET /api/session/{session_id}/export/riskview360"""

    model_config = ConfigDict(extra="forbid")

    schema_version: str = "1.0"
    source: str = "PWNDORA BASLab"
    export_timestamp: str
    session_reference: str
    playbook_name: str
    overall_detection_rate: float
    session_score: float
    attack_coverage: list[RiskView360Coverage]
    control_gaps: list[ControlGap]
    recommended_training: list[str]


class TechniqueDelta(BaseModel):
    """Per-technique score movement between two runs of the same playbook."""

    model_config = ConfigDict(extra="forbid")

    technique_id: str
    technique_name: str
    run_1_score: float
    run_2_score: float
    delta: float
    improved: bool


class ComparisonResult(BaseModel):
    """GET /api/session/{session_id}/comparison?compare_with={other_session_id}"""

    model_config = ConfigDict(extra="forbid")

    run_1_session_id: str
    run_2_session_id: str
    playbook_name: str
    run_1_score: float
    run_2_score: float
    improvement_delta: float
    run_1_detection_rate: float
    run_2_detection_rate: float
    per_technique_delta: list[TechniqueDelta] = Field(default_factory=list)
