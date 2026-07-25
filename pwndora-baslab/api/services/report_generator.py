"""Control Effectiveness Report, RiskView360 export and run-over-run comparison.

Like the scoring engine these builders are pure: given the same completed session
they emit the same document every time, apart from the export timestamp, which is
explicitly passed in by the caller for the report and stamped at request time for
the export envelope.
"""

from __future__ import annotations

from datetime import datetime, timezone

from api.models.playbook import Playbook
from api.models.report import (
    ComparisonResult,
    ControlEffectivenessReport,
    ControlGap,
    RiskView360Coverage,
    RiskView360Export,
    SigmaRecommendation,
    TechniqueDelta,
    TechniqueResult,
)
from api.models.session import SessionState, StepResult
from api.services.scoring_engine import aggregate_session_score, control_status

#: Remediation guidance keyed by ATT&CK technique. Bundled offline: the module
#: makes no outbound calls at runtime.
RECOMMENDED_CONTROLS: dict[str, str] = {
    "T1566.001": (
        "Block macro execution for files originating from the internet via ASR rule "
        "D4F940AB-401B-4EFC-AADC-AD5F3C50688A; alert on Office binaries spawning script hosts."
    ),
    "T1059.001": (
        "Enable PowerShell Script Block Logging (EID 4104) and Module Logging; enforce "
        "Constrained Language Mode and block -EncodedCommand for non-admin users."
    ),
    "T1055.001": (
        "Deploy Sysmon EID 8 and EID 10 alerting for cross-process access to shell processes; "
        "enable Attack Surface Reduction rules for process injection."
    ),
    "T1003.001": (
        "Enable Credential Guard and LSA Protection (RunAsPPL); deploy Sysmon EID 10 alerting "
        "for handles to lsass.exe with GrantedAccess 0x1010 or 0x1fffff."
    ),
    "T1078": (
        "Disable NTLM where feasible and alert on privileged accounts authenticating from "
        "workstation or DMZ subnets; enforce tiered administration and PAW usage."
    ),
    "T1021.002": (
        "Restrict administrative shares to jump hosts via host firewall; alert on Security "
        "EID 7045 service installs and EID 5140 ADMIN$ access from non-management subnets."
    ),
    "T1190": (
        "Place a WAF in front of internet-facing applications, patch the exposed component, "
        "and alert on non-browser user agents posting to administrative endpoints."
    ),
    "T1059.003": (
        "Alert on any child process of w3wp.exe; apply application-pool least privilege and "
        "block cmd.exe execution from web tier identities via AppLocker."
    ),
    "T1112": (
        "Monitor autorun registry locations with Sysmon EID 13 and enable Defender tamper "
        "protection so DisableAntiSpyware writes are rejected and alerted."
    ),
    "T1490": (
        "Alert on vssadmin, wbadmin and bcdedit recovery tampering; store backups offline or "
        "in immutable storage outside the production identity boundary."
    ),
    "T1486": (
        "Enable Controlled Folder Access, deploy canary files in user profile shares, and "
        "alert on high-rate file rename or extension-change activity per process."
    ),
    "T1041": (
        "Egress-filter outbound traffic to allowlisted destinations, inspect TLS at the "
        "perimeter, and alert on non-browser binaries initiating port 443 connections."
    ),
    "T1505.003": (
        "Enable file integrity monitoring on web roots, block write access for the application "
        "pool identity, and alert on server-side script files created by w3wp.exe."
    ),
    "T1552.001": (
        "Encrypt connection strings with aspnet_regiis or move them to a managed secret store; "
        "audit read access to web.config and alert on credential keyword searches."
    ),
    "T1005": (
        "Enable SQL audit for bulk SELECT operations, restrict service account permissions to "
        "the minimum required tables, and alert on database exports to local staging paths."
    ),
    "T1048.003": (
        "Block public file-sharing categories at the proxy and alert on curl or wget upload "
        "flags targeting external hosts from server workloads."
    ),
}

#: Follow-on PWNDORA labs recommended when a technique is missed.
RECOMMENDED_TRAINING: dict[str, str] = {
    "T1566.001": "PWNDORA Lab: Phishing Payload Triage",
    "T1059.001": "PWNDORA Lab: PowerShell Attack Forensics",
    "T1055.001": "PWNDORA Lab: Process Injection Detection",
    "T1003.001": "PWNDORA Lab: LSASS Forensics",
    "T1078": "PWNDORA Lab: Credential Dumping Detection",
    "T1021.002": "PWNDORA Lab: Lateral Movement Hunting",
    "T1190": "PWNDORA Lab: Web Exploitation Triage",
    "T1059.003": "PWNDORA Lab: Command Shell Abuse Analysis",
    "T1112": "PWNDORA Lab: Registry Persistence Hunting",
    "T1490": "PWNDORA Lab: Ransomware Pre-Encryption Signals",
    "T1486": "PWNDORA Lab: Ransomware Impact Analysis",
    "T1041": "PWNDORA Lab: C2 Beacon Detection",
    "T1505.003": "PWNDORA Lab: Web Shell Hunting",
    "T1552.001": "PWNDORA Lab: Secrets Sprawl Discovery",
    "T1005": "PWNDORA Lab: Database Exfiltration Analysis",
    "T1048.003": "PWNDORA Lab: Egress Anomaly Detection",
}

DEFAULT_CONTROL = (
    "Extend log source coverage for this tactic and deploy the bundled Sigma rule to the SIEM."
)
DEFAULT_TRAINING = "PWNDORA Lab: ATT&CK Detection Fundamentals"


def _gap_reason(result: StepResult) -> str:
    """Human-readable explanation of exactly which parts of the decision failed."""
    faults: list[str] = []
    if not result.technique_correct:
        faults.append(
            f"technique not identified (submitted {result.learner_technique_id}, "
            f"actual {result.technique_id})"
        )
    if result.indicator_jaccard < 1.0:
        missed = len(result.missed_indicators)
        total = len(result.correct_indicators)
        detail = f"{missed} of {total} indicators missed"
        herrings = len(result.false_positive_indicators)
        if herrings:
            detail += f", {herrings} red herring{'' if herrings == 1 else 's'} selected"
        faults.append(detail)
    if not result.response_correct:
        faults.append(
            f"response action incorrect (chose {result.learner_response_action}, "
            f"expected {result.correct_response_action})"
        )
    if not faults:
        return "Step fully detected; retained for coverage evidence."
    reason = "; ".join(faults)
    # Only the leading character is raised: str.capitalize() would lowercase the
    # rest, mangling ATT&CK ids and response action names further along the line.
    return reason[0].upper() + reason[1:]


def _technique_results(state: SessionState) -> list[TechniqueResult]:
    return [
        TechniqueResult(
            step=index + 1,
            technique_id=result.technique_id,
            technique_name=result.technique_name,
            tactic=result.tactic,
            learner_technique_id=result.learner_technique_id,
            detected=result.technique_correct,
            indicator_jaccard=result.indicator_jaccard,
            response_correct=result.response_correct,
            step_score=result.step_score,
            missed_indicators=list(result.missed_indicators),
            sigma_rule_title=result.sigma_rule_title,
            control_status=control_status(result),
        )
        for index, result in enumerate(state.step_results)
    ]


def _control_gaps(state: SessionState) -> list[ControlGap]:
    """Every step whose control was not fully effective, with remediation."""
    gaps: list[ControlGap] = []
    for result in state.step_results:
        if control_status(result) == "DETECTED":
            continue
        gaps.append(
            ControlGap(
                technique_id=result.technique_id,
                technique_name=result.technique_name,
                tactic=result.tactic,
                gap_reason=_gap_reason(result),
                recommended_control=RECOMMENDED_CONTROLS.get(result.technique_id, DEFAULT_CONTROL),
                sigma_rule_title=result.sigma_rule_title,
            )
        )
    return gaps


def _sigma_recommendations(state: SessionState) -> list[SigmaRecommendation]:
    """Sigma rules worth deploying, deduplicated, gaps first then full coverage."""
    ordered: list[StepResult] = sorted(
        state.step_results, key=lambda r: (control_status(r) == "DETECTED", r.step_index)
    )
    seen: set[str] = set()
    recommendations: list[SigmaRecommendation] = []
    for result in ordered:
        if result.technique_id in seen:
            continue
        seen.add(result.technique_id)
        recommendations.append(
            SigmaRecommendation(
                technique_id=result.technique_id,
                title=result.sigma_rule_title,
                sigma_yaml=result.sigma_rule_yaml,
            )
        )
    return recommendations


def build_report(state: SessionState) -> ControlEffectivenessReport:
    """Assemble the Control Effectiveness Report for a completed session."""
    score = aggregate_session_score(state.step_results)
    completed_at = state.completed_at or datetime.now(timezone.utc)
    return ControlEffectivenessReport(
        session_id=state.session_id,
        playbook_id=state.playbook_id,
        playbook_name=state.playbook_name,
        threat_actor=state.threat_actor,
        completed_at=completed_at.isoformat(),
        overall_detection_rate=score.detection_rate,
        session_score=score.session_score,
        techniques_detected=score.techniques_detected,
        total_techniques=state.total_steps,
        technique_results=_technique_results(state),
        security_control_gaps=_control_gaps(state),
        sigma_recommendations=_sigma_recommendations(state),
        riskview360_compatible=True,
        riskview360_export_url=f"/api/session/{state.session_id}/export/riskview360",
    )


def build_riskview360_export(state: SessionState) -> RiskView360Export:
    """Assemble the RiskView360-compatible integration payload."""
    score = aggregate_session_score(state.step_results)
    gaps = _control_gaps(state)

    training: list[str] = []
    for gap in gaps:
        lab = RECOMMENDED_TRAINING.get(gap.technique_id, DEFAULT_TRAINING)
        if lab not in training:
            training.append(lab)
    if not training:
        training.append("PWNDORA Lab: Advanced Adversary Emulation")

    return RiskView360Export(
        schema_version="1.0",
        source="PWNDORA BASLab",
        export_timestamp=datetime.now(timezone.utc).isoformat(),
        session_reference=state.session_id,
        playbook_name=state.playbook_name,
        overall_detection_rate=score.detection_rate,
        session_score=score.session_score,
        attack_coverage=[
            RiskView360Coverage(
                technique_id=result.technique_id,
                tactic=result.tactic,
                detected=result.technique_correct,
                control_status=control_status(result),
            )
            for result in state.step_results
        ],
        control_gaps=gaps,
        recommended_training=training,
    )


def build_comparison(run_1: SessionState, run_2: SessionState) -> ComparisonResult:
    """Compare two runs of the same playbook, step by step."""
    score_1 = aggregate_session_score(run_1.step_results)
    score_2 = aggregate_session_score(run_2.step_results)

    deltas: list[TechniqueDelta] = []
    for index in range(max(len(run_1.step_results), len(run_2.step_results))):
        result_1 = run_1.step_results[index] if index < len(run_1.step_results) else None
        result_2 = run_2.step_results[index] if index < len(run_2.step_results) else None
        reference = result_1 or result_2
        if reference is None:
            continue
        run_1_score = result_1.step_score if result_1 else 0.0
        run_2_score = result_2.step_score if result_2 else 0.0
        deltas.append(
            TechniqueDelta(
                technique_id=reference.technique_id,
                technique_name=reference.technique_name,
                run_1_score=round(run_1_score, 4),
                run_2_score=round(run_2_score, 4),
                delta=round(run_2_score - run_1_score, 4),
                improved=run_2_score > run_1_score,
            )
        )

    return ComparisonResult(
        run_1_session_id=run_1.session_id,
        run_2_session_id=run_2.session_id,
        playbook_name=run_1.playbook_name,
        run_1_score=score_1.session_score,
        run_2_score=score_2.session_score,
        improvement_delta=round(score_2.session_score - score_1.session_score, 2),
        run_1_detection_rate=score_1.detection_rate,
        run_2_detection_rate=score_2.detection_rate,
        per_technique_delta=deltas,
    )
