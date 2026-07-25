"""In-memory session store and bundled data catalog.

Two collaborators live here:

``PlaybookCatalog``
    Loads and validates ``playbooks.json`` and ``enterprise-attack-techniques.json``
    once at startup, and derives the learner-visible checkbox options for a step.

``SessionManager``
    A process-local ``dict[str, SessionState]``. No database is used; sessions are
    intentionally ephemeral so that nothing a learner submits outlives the process.
    The store is bounded and time-limited so a long-running demo instance cannot be
    grown without limit by repeatedly calling ``/api/session/start``.
"""

from __future__ import annotations

import hashlib
import json
import random
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml
from ulid import ULID

from api.models.playbook import (
    MitreTechnique,
    Playbook,
    PlaybookLibrary,
    PlaybookMeta,
    Technique,
)
from api.models.session import RESPONSE_ACTIONS, SessionState, StepResponse

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PLAYBOOKS_FILE = DATA_DIR / "playbooks.json"
ATTACK_FILE = DATA_DIR / "enterprise-attack-techniques.json"

#: Hard ceiling on concurrently tracked sessions. Oldest-first eviction keeps a
#: public demo deployment from being memory-exhausted by unauthenticated starts.
MAX_SESSIONS = 500
#: Sessions untouched for longer than this are dropped on the next write.
SESSION_TTL = timedelta(hours=6)


class CatalogError(RuntimeError):
    """Raised when the bundled data files are missing or structurally invalid."""


class PlaybookCatalog:
    """Immutable, validated view over the bundled BAS content."""

    def __init__(self, playbooks_file: Path = PLAYBOOKS_FILE, attack_file: Path = ATTACK_FILE) -> None:
        self._playbooks_file = playbooks_file
        self._attack_file = attack_file
        self._playbooks: dict[str, Playbook] = {}
        self._order: list[str] = []
        self._mitre: list[MitreTechnique] = []
        self._loaded = False

    # -- loading -----------------------------------------------------------

    def load(self) -> None:
        """Read and validate both data files. Safe to call more than once."""
        if not self._playbooks_file.exists():
            raise CatalogError(f"playbook library not found: {self._playbooks_file}")
        if not self._attack_file.exists():
            raise CatalogError(f"ATT&CK catalog not found: {self._attack_file}")

        try:
            raw_library = json.loads(self._playbooks_file.read_text(encoding="utf-8"))
            library = PlaybookLibrary.model_validate(raw_library)
        except (json.JSONDecodeError, ValueError) as exc:
            raise CatalogError(f"playbooks.json is invalid: {exc}") from exc

        try:
            raw_attack = json.loads(self._attack_file.read_text(encoding="utf-8"))
            mitre = [MitreTechnique.model_validate(item) for item in raw_attack]
        except (json.JSONDecodeError, ValueError) as exc:
            raise CatalogError(f"enterprise-attack-techniques.json is invalid: {exc}") from exc

        known_ids = {item.id for item in mitre}
        for playbook in library.playbooks:
            for technique in playbook.techniques:
                if technique.correct_response_action not in RESPONSE_ACTIONS:
                    raise CatalogError(
                        f"{playbook.playbook_id}/{technique.technique_id}: "
                        f"unknown response action {technique.correct_response_action!r}"
                    )
                if technique.technique_id not in known_ids:
                    raise CatalogError(
                        f"{playbook.playbook_id}/{technique.technique_id}: "
                        "technique is absent from the ATT&CK catalog, so the learner "
                        "could never select the correct answer"
                    )
                overlap = set(technique.reference_indicators) & set(technique.red_herring_indicators)
                if overlap:
                    raise CatalogError(
                        f"{playbook.playbook_id}/{technique.technique_id}: "
                        f"indicator present in both pools: {sorted(overlap)}"
                    )

                # The whole exercise collapses if the evidence names its own answer.
                # Real Sysmon configs tag rules with ATT&CK ids (RuleName=
                # "technique_id=T1003.001,..."), which would hand the learner the
                # technique for free, so that is rejected here rather than trusted
                # to review.
                for entry in technique.log_evidence:
                    for field, value in entry.fields.items():
                        lowered = value.lower()
                        if technique.technique_id.lower() in lowered:
                            raise CatalogError(
                                f"{playbook.playbook_id}/{technique.technique_id}: "
                                f"log field {field!r} leaks the technique id to the learner"
                            )
                        if "technique_id=" in lowered or "technique_name=" in lowered:
                            raise CatalogError(
                                f"{playbook.playbook_id}/{technique.technique_id}: "
                                f"log field {field!r} carries an ATT&CK rule tag that "
                                "would reveal the answer"
                            )
                try:
                    rule = yaml.safe_load(technique.sigma_rule_yaml)
                except yaml.YAMLError as exc:
                    raise CatalogError(
                        f"{playbook.playbook_id}/{technique.technique_id}: "
                        f"sigma rule is not valid YAML: {exc}"
                    ) from exc
                if not isinstance(rule, dict) or "detection" not in rule or "id" not in rule:
                    raise CatalogError(
                        f"{playbook.playbook_id}/{technique.technique_id}: "
                        "sigma rule is missing a detection block or rule id"
                    )

        self._playbooks = {pb.playbook_id: pb for pb in library.playbooks}
        self._order = [pb.playbook_id for pb in library.playbooks]
        self._mitre = mitre
        self._loaded = True

    def _require_loaded(self) -> None:
        if not self._loaded:
            raise CatalogError("catalog accessed before load() completed")

    # -- accessors ---------------------------------------------------------

    @property
    def playbook_count(self) -> int:
        return len(self._playbooks)

    @property
    def technique_count(self) -> int:
        return sum(len(pb.techniques) for pb in self._playbooks.values())

    @property
    def mitre_count(self) -> int:
        return len(self._mitre)

    def list_playbooks(self) -> list[PlaybookMeta]:
        """Metadata for every playbook, in authored order. No answer key."""
        self._require_loaded()
        return [PlaybookMeta.from_playbook(self._playbooks[pid]) for pid in self._order]

    def get_playbook(self, playbook_id: str) -> Playbook | None:
        self._require_loaded()
        return self._playbooks.get(playbook_id)

    def get_technique(self, playbook_id: str, step_index: int) -> Technique | None:
        playbook = self.get_playbook(playbook_id)
        if playbook is None or not 0 <= step_index < len(playbook.techniques):
            return None
        return playbook.techniques[step_index]

    def list_mitre_techniques(
        self,
        search: str | None = None,
        tactic: str | None = None,
        limit: int = 500,
    ) -> list[MitreTechnique]:
        """Filtered ATT&CK catalog for the Part A dropdown."""
        self._require_loaded()
        results = self._mitre
        if tactic:
            needle = tactic.strip().lower()
            results = [t for t in results if t.tactic.lower() == needle]
        if search:
            needle = search.strip().lower()
            results = [
                t
                for t in results
                if needle in t.id.lower() or needle in t.name.lower() or needle in t.tactic.lower()
            ]
        return results[:limit]

    def list_tactics(self) -> list[str]:
        self._require_loaded()
        return sorted({t.tactic for t in self._mitre})

    # -- learner-facing projection ----------------------------------------

    def build_checkbox_options(self, session_id: str, step_index: int, technique: Technique) -> list[str]:
        """Mix true indicators with red herrings into a single unlabelled list.

        The order is shuffled with a seed derived from the session id and step
        index, so a given learner always sees the same list on refresh while two
        different learners see different orderings. Nothing in the ordering leaks
        which options are correct.
        """
        options = list(technique.reference_indicators) + list(technique.red_herring_indicators)
        digest = hashlib.sha256(f"{session_id}:{step_index}".encode("utf-8")).hexdigest()
        random.Random(int(digest[:16], 16)).shuffle(options)
        return options

    def build_step_response(self, state: SessionState) -> StepResponse:
        """Render the current step for the learner, with the technique withheld."""
        technique = self.get_technique(state.playbook_id, state.current_step_index)
        if technique is None:
            raise CatalogError(
                f"session {state.session_id} points at step {state.current_step_index} "
                f"which does not exist in {state.playbook_id}"
            )
        return StepResponse(
            session_id=state.session_id,
            step_index=state.current_step_index,
            step_number=state.current_step_index + 1,
            total_steps=state.total_steps,
            step_status=state.step_status,
            log_evidence=list(technique.log_evidence),
            checkbox_options=self.build_checkbox_options(
                state.session_id, state.current_step_index, technique
            ),
            response_actions=list(RESPONSE_ACTIONS),
            completed=state.completed,
        )


class SessionManager:
    """Thread-safe in-memory session store keyed by ULID."""

    def __init__(self, max_sessions: int = MAX_SESSIONS, ttl: timedelta = SESSION_TTL) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._touched: dict[str, datetime] = {}
        self._lock = threading.Lock()
        self._max_sessions = max_sessions
        self._ttl = ttl

    # -- lifecycle ---------------------------------------------------------

    def create_session(self, playbook: Playbook, base_session_id: str | None = None) -> SessionState:
        state = SessionState(
            session_id=str(ULID()),
            playbook_id=playbook.playbook_id,
            playbook_name=playbook.name,
            threat_actor=playbook.threat_actor,
            total_steps=len(playbook.techniques),
            base_session_id=base_session_id,
        )
        with self._lock:
            self._evict_locked()
            self._sessions[state.session_id] = state
            self._touched[state.session_id] = datetime.now(timezone.utc)
        return state

    def get_session(self, session_id: str) -> SessionState | None:
        """Look up a session by its opaque ULID handle.

        Malformed identifiers are rejected before touching the store, so probing
        the API with crafted keys cannot be used to enumerate live sessions.
        """
        if not self.is_valid_session_id(session_id):
            return None
        with self._lock:
            state = self._sessions.get(session_id)
            if state is not None:
                self._touched[session_id] = datetime.now(timezone.utc)
            return state

    def update_session(self, state: SessionState) -> SessionState:
        with self._lock:
            self._sessions[state.session_id] = state
            self._touched[state.session_id] = datetime.now(timezone.utc)
        return state

    def delete_session(self, session_id: str) -> bool:
        with self._lock:
            self._touched.pop(session_id, None)
            return self._sessions.pop(session_id, None) is not None

    # -- helpers -----------------------------------------------------------

    @staticmethod
    def is_valid_session_id(session_id: str) -> bool:
        """True when the string is a syntactically valid ULID."""
        if not session_id or len(session_id) != 26:
            return False
        try:
            ULID.from_str(session_id)
        except (ValueError, TypeError):
            return False
        return True

    @property
    def active_sessions(self) -> int:
        with self._lock:
            return len(self._sessions)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
            self._touched.clear()

    def _evict_locked(self) -> None:
        """Drop expired sessions, then oldest-first until under the ceiling."""
        now = datetime.now(timezone.utc)
        expired = [sid for sid, seen in self._touched.items() if now - seen > self._ttl]
        for sid in expired:
            self._sessions.pop(sid, None)
            self._touched.pop(sid, None)

        while len(self._sessions) >= self._max_sessions:
            oldest = min(self._touched, key=self._touched.__getitem__)
            self._sessions.pop(oldest, None)
            self._touched.pop(oldest, None)


#: Process-wide singletons wired up by ``api.main`` during startup.
catalog = PlaybookCatalog()
session_manager = SessionManager()
