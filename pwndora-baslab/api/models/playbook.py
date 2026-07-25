"""Data-layer models: the bundled BAS playbooks and the ATT&CK reference catalog.

These models mirror ``api/data/playbooks.json`` and
``api/data/enterprise-attack-techniques.json`` exactly. They are validated once at
application startup so that a malformed data file fails fast instead of surfacing
as a confusing 500 in the middle of a learner's run.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

#: Windows log channels that the simulated evidence is drawn from.
#: ``Microsoft-IIS-Logging/Logs`` carries W3SVC access-log records, which have no
#: Windows Event ID; those entries use ``event_id: 0`` and are rendered as access
#: log lines rather than EVTX records.
LogChannel = Literal[
    "Security",
    "Microsoft-Windows-Sysmon/Operational",
    "Microsoft-IIS-Logging/Logs",
]

Difficulty = Literal["Easy", "Moderate", "Hard"]


class LogEntry(BaseModel):
    """A single simulated log record shown to the learner."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    channel: LogChannel
    event_id: int = Field(ge=0, le=65535)
    timestamp: str = Field(min_length=1)
    computer: str = Field(min_length=1)
    fields: dict[str, str] = Field(min_length=1)


class Technique(BaseModel):
    """One kill-chain step inside a playbook.

    ``technique_id``, ``technique_name``, ``tactic``, ``reference_indicators``,
    ``correct_response_action`` and ``sigma_rule_yaml`` are the answer key: they are
    never serialised to the client until the learner has submitted a decision for
    the step.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    technique_id: str = Field(pattern=r"^T\d{4}(\.\d{3})?$")
    technique_name: str = Field(min_length=1)
    tactic: str = Field(min_length=1)
    description: str = Field(min_length=1)
    log_evidence: list[LogEntry] = Field(min_length=1)
    reference_indicators: list[str] = Field(min_length=3)
    red_herring_indicators: list[str] = Field(min_length=2)
    correct_response_action: str = Field(min_length=1)
    sigma_rule_yaml: str = Field(min_length=1)

    @property
    def sigma_rule_title(self) -> str:
        """The ``title:`` line of the bundled Sigma rule, without parsing YAML."""
        for line in self.sigma_rule_yaml.splitlines():
            if line.startswith("title:"):
                return line.split(":", 1)[1].strip()
        return f"Detection rule for {self.technique_id}"


class Playbook(BaseModel):
    """A complete attack simulation: ordered techniques plus campaign metadata."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    playbook_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    threat_actor: str = Field(min_length=1)
    difficulty: Difficulty
    description: str = Field(min_length=1)
    techniques: list[Technique] = Field(min_length=1)


class PlaybookMeta(BaseModel):
    """Playbook summary for the selection screen. Carries no answer key."""

    model_config = ConfigDict(extra="forbid")

    playbook_id: str
    name: str
    threat_actor: str
    difficulty: Difficulty
    description: str
    technique_count: int
    tactics: list[str]

    @classmethod
    def from_playbook(cls, playbook: Playbook) -> "PlaybookMeta":
        """Project a full playbook down to its safe, learner-visible summary.

        Tactic names are kill-chain phases, not technique identities, so exposing
        them ahead of the run is intentional: it frames the scenario without
        revealing which ATT&CK technique any individual step maps to.
        """
        ordered_tactics: list[str] = []
        for technique in playbook.techniques:
            if technique.tactic not in ordered_tactics:
                ordered_tactics.append(technique.tactic)
        return cls(
            playbook_id=playbook.playbook_id,
            name=playbook.name,
            threat_actor=playbook.threat_actor,
            difficulty=playbook.difficulty,
            description=playbook.description,
            technique_count=len(playbook.techniques),
            tactics=ordered_tactics,
        )


class MitreTechnique(BaseModel):
    """One entry of the ATT&CK Enterprise catalog backing the Part A dropdown."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(pattern=r"^T\d{4}(\.\d{3})?$")
    name: str = Field(min_length=1)
    tactic: str = Field(min_length=1)
    description: str = Field(min_length=1)


class PlaybookLibrary(BaseModel):
    """Root document of ``api/data/playbooks.json``."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: str
    source: str
    response_actions: list[str] = Field(min_length=1)
    playbooks: list[Playbook] = Field(min_length=1)
