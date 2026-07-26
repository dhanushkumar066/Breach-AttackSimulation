"""Attack Replay — reconstruct how the intrusion unfolded, for post-run teaching.

This is **not** a model and makes no prediction. Every edge below is read directly out
of fields already present in the log evidence: ``ParentImage``/``Image`` gives process
ancestry, ``SourceIp``/``DestinationIp`` gives host-to-host movement, ``TargetImage``
plus ``GrantedAccess`` gives cross-process access, and so on. The same session always
produces the same replay, so it cannot disturb the determinism the scoring engine
guarantees.

Scope note: the replay is generated only for a **completed** session and is purely
descriptive. The learner never builds or orders anything here and nothing on this path
contributes to a score — it is per-step feedback, not a reconstruction mechanic.
"""

from __future__ import annotations

from api.models.playbook import LogEntry, Playbook, Technique
from api.models.report import AttackReplay, ReplayEdge, ReplayStep
from api.models.session import SessionState, StepResult
from api.services.report_generator import DEFAULT_CONTROL, RECOMMENDED_CONTROLS
from api.services.scoring_engine import control_status

SYSMON = "Microsoft-Windows-Sysmon/Operational"
SECURITY = "Security"
IIS = "Microsoft-IIS-Logging/Logs"

#: Command lines get long; the replay shows intent, the log viewer shows the full text.
MAX_DETAIL = 120


def _basename(path: str) -> str:
    """``C:\\Windows\\System32\\lsass.exe`` → ``lsass.exe``."""
    cleaned = path.strip().strip('"')
    for separator in ("\\", "/"):
        if separator in cleaned:
            cleaned = cleaned.rsplit(separator, 1)[-1]
    return cleaned or path


def _clip(text: str, limit: int = MAX_DETAIL) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _edges_for_entry(entry: LogEntry) -> list[ReplayEdge]:
    """Translate one log record into the causal edges it evidences."""
    f = entry.fields
    channel, eid = entry.channel, entry.event_id
    edges: list[ReplayEdge] = []

    def add(kind: str, source: str, target: str, detail: str = "") -> None:
        if not source or not target:
            return
        edges.append(
            ReplayEdge(
                kind=kind,
                source=source,
                target=target,
                detail=_clip(detail),
                channel=channel,
                event_id=eid,
            )
        )

    if channel == SYSMON:
        if eid == 1:
            add(
                "spawn",
                _basename(f.get("ParentImage", "")),
                _basename(f.get("Image", "")),
                f.get("CommandLine", ""),
            )
        elif eid == 3:
            destination = f.get("DestinationIp", "")
            port = f.get("DestinationPort", "")
            hostname = f.get("DestinationHostname", "")
            label = f"{destination}:{port}" if port else destination
            if hostname and hostname != "-":
                label = f"{hostname} ({label})"
            add(
                "network",
                _basename(f.get("Image", "")),
                label,
                f"outbound {f.get('Protocol', 'tcp')} from {f.get('SourceIp', 'host')}",
            )
        elif eid == 7:
            add(
                "load",
                _basename(f.get("Image", "")),
                _basename(f.get("ImageLoaded", "")),
                "unsigned module" if f.get("Signed") == "false" else "module loaded",
            )
        elif eid == 8:
            add(
                "inject",
                _basename(f.get("SourceImage", "")),
                _basename(f.get("TargetImage", "")),
                f"CreateRemoteThread at {f.get('StartAddress', 'unknown address')}",
            )
        elif eid == 10:
            add(
                "access",
                _basename(f.get("SourceImage", "")),
                _basename(f.get("TargetImage", "")),
                f"GrantedAccess {f.get('GrantedAccess', '')}",
            )
        elif eid == 11:
            add(
                "file",
                _basename(f.get("Image", "")),
                f.get("TargetFilename", ""),
                "file created",
            )
        elif eid == 13:
            add(
                "registry",
                _basename(f.get("Image", "")),
                f.get("TargetObject", ""),
                f"{f.get('EventType', 'SetValue')} = {f.get('Details', '')}",
            )

    elif channel == SECURITY:
        if eid == 4688:
            add(
                "spawn",
                _basename(f.get("ParentProcessName", "")),
                _basename(f.get("NewProcessName", "")),
                f.get("CommandLine", ""),
            )
        elif eid == 4624:
            workstation = f.get("WorkstationName", "")
            origin = f.get("IpAddress", "")
            source = f"{workstation} ({origin})" if workstation and origin else origin or workstation
            add(
                "logon",
                source,
                entry.computer,
                f"type {f.get('LogonType', '')} {f.get('AuthenticationPackageName', '')} "
                f"as {f.get('TargetUserName', '')}",
            )
        elif eid == 4769:
            add(
                "logon",
                f.get("ClientAddress", ""),
                f"{f.get('ServiceName', 'service')} ticket",
                f"encryption {f.get('TicketEncryptionType', '')} for {f.get('TargetUserName', '')}",
            )
        elif eid in (4656, 4663):
            add(
                "access",
                _basename(f.get("ProcessName", "")),
                f.get("ObjectName", ""),
                f"AccessMask {f.get('AccessMask', '')} as {f.get('SubjectUserName', '')}",
            )
        elif eid == 5140:
            add(
                "share",
                f.get("IpAddress", ""),
                f"{f.get('ShareName', '')} on {entry.computer}",
                f"{f.get('SubjectUserName', '')} → {f.get('ShareLocalPath', '')}",
            )
        elif eid == 7045:
            add(
                "service",
                entry.computer,
                f.get("ServiceName", ""),
                f"installed {f.get('ImagePath', '')} as {f.get('AccountName', '')}",
            )

    elif channel == IIS:
        add(
            "network",
            f.get("src_ip", ""),
            f"{f.get('method', '')} {f.get('uri', '')}".strip(),
            f"status {f.get('status', '')} · {f.get('user_agent', '')}",
        )

    return edges


def _edges_for_technique(technique: Technique) -> list[ReplayEdge]:
    """All edges for a step, de-duplicated and in log order."""
    seen: set[tuple[str, str, str, str]] = set()
    edges: list[ReplayEdge] = []
    for entry in technique.log_evidence:
        for edge in _edges_for_entry(entry):
            key = (edge.kind, edge.source, edge.target, edge.detail)
            if key in seen:
                continue
            seen.add(key)
            edges.append(edge)
    return edges


def _build_step(index: int, technique: Technique, result: StepResult | None) -> ReplayStep:
    timestamps = sorted(entry.timestamp for entry in technique.log_evidence)
    hosts: list[str] = []
    for entry in technique.log_evidence:
        if entry.computer not in hosts:
            hosts.append(entry.computer)

    detected = bool(result and result.technique_correct)
    status = control_status(result) if result else "MISSED"

    return ReplayStep(
        step=index + 1,
        technique_id=technique.technique_id,
        technique_name=technique.technique_name,
        tactic=technique.tactic,
        narrative=technique.description,
        timestamp=timestamps[0] if timestamps else "",
        hosts=hosts,
        edges=_edges_for_technique(technique),
        detected=detected,
        control_status=status,
        countermeasure=RECOMMENDED_CONTROLS.get(technique.technique_id, DEFAULT_CONTROL),
        sigma_rule_title=technique.sigma_rule_title,
    )


def build_attack_replay(state: SessionState, playbook: Playbook) -> AttackReplay:
    """Assemble the full kill-chain replay for a completed run."""
    steps: list[ReplayStep] = []
    for index, technique in enumerate(playbook.techniques):
        result = state.step_results[index] if index < len(state.step_results) else None
        steps.append(_build_step(index, technique, result))

    hosts: list[str] = []
    for step in steps:
        for host in step.hosts:
            if host not in hosts:
                hosts.append(host)

    stamps = sorted(step.timestamp for step in steps if step.timestamp)

    return AttackReplay(
        session_id=state.session_id,
        playbook_id=state.playbook_id,
        playbook_name=state.playbook_name,
        threat_actor=state.threat_actor,
        total_steps=len(steps),
        techniques_detected=sum(1 for step in steps if step.detected),
        first_seen=stamps[0] if stamps else "",
        last_seen=stamps[-1] if stamps else "",
        hosts=hosts,
        steps=steps,
    )
