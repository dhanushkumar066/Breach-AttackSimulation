"""Detection Coach — explains the mistake, not just the mark.

The scorer answers *what* was wrong. This module answers *why it happened* and
*what to change*, which is the part a learner can actually act on.

No model is involved, and that is a design choice rather than a limitation. The
mistake space here is closed and fully observable: the API knows the exact technique
the learner chose, every indicator they missed, every decoy they took and the
containment action they picked. Diagnosis is therefore a lookup plus a comparison,
which keeps it deterministic (the scoring guarantee holds), offline (no runtime call)
and factually correct about Windows internals — the three things a bundled language
model would have cost.

Two layers of diagnosis:

* **Authored** — for the decoys and the correct response action, where the
  misconception is specific and worth naming precisely. Carried in
  ``playbooks.json`` beside the content it explains.
* **Derived** — for the technique choice, which has 679 possible answers. The
  learner's pick is looked up in the ATT&CK catalog and compared against the real
  one: same tactic, same technique family, wrong kill-chain phase, and so on. That
  covers every wrong answer without pretending to have anticipated it.
"""

from __future__ import annotations

from api.models.playbook import MitreTechnique, Technique
from api.models.session import Coaching, CoachNote, StepResult

#: Containment strength, low to high. Used only to tell an under-response
#: ("you watched while it kept running") from an over-response.
ACTION_STRENGTH: dict[str, int] = {
    "No Action Required": 0,
    "Alert SOC Only": 1,
    "Quarantine File": 2,
    "Kill Process": 2,
    "Block IP/Domain": 3,
    "Revoke Credentials": 4,
    "Isolate Host": 4,
}

#: What each action actually achieves, so a wrong pick can be contrasted with the
#: right one rather than merely marked wrong.
ACTION_EFFECT: dict[str, str] = {
    "No Action Required": "leaves the activity running and unreported",
    "Alert SOC Only": "creates a ticket but changes nothing on the host",
    "Quarantine File": "removes one artefact from disk",
    "Kill Process": "stops the running process but leaves anything persistent behind",
    "Block IP/Domain": "cuts the network path but leaves local execution intact",
    "Revoke Credentials": "invalidates stolen authentication material everywhere it is valid",
    "Isolate Host": "cuts the host off entirely while preserving it for forensics",
}

#: Signal families an indicator can belong to, matched on the vocabulary the
#: indicator text already uses. Used to name a learner's blind spot.
SIGNAL_FAMILIES: dict[str, tuple[str, ...]] = {
    "process ancestry": ("parentimage", "parentprocessname", "parentcommandline", "spawn", "4688", "eid 1"),
    "command-line content": ("commandline", "-enc", "-w hidden", "bypass", "whoami", "sqlcmd", "curl", "vssadmin", "type "),
    "network telemetry": ("destinationip", "destinationport", "outbound", "eid 3", "connection", "egress", "src_ip", "user_agent"),
    "file activity": ("targetfilename", "file created", "eid 11", ".dmp", ".locked", ".aspx", ".php", "dump.csv", "wrote"),
    "registry activity": ("targetobject", "registry", "eid 13", "run\\", "setvalue"),
    "authentication": ("logontype", "ntlm", "4624", "4769", "kerberos", "ticket", "privilege", "4672", "logon"),
    "cross-process access": ("grantedaccess", "eid 10", "eid 8", "createremotethread", "calltrace", "4656"),
    "share and service": ("sharename", "admin$", "7045", "service", "5140"),
}


def _families(indicators: list[str]) -> set[str]:
    """Which signal families a set of indicator strings draws on."""
    found: set[str] = set()
    for indicator in indicators:
        lowered = indicator.lower()
        for family, needles in SIGNAL_FAMILIES.items():
            if any(needle in lowered for needle in needles):
                found.add(family)
    return found


def _join(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " and " + items[-1]


def _technique_note(
    result: StepResult,
    technique: Technique,
    picked: MitreTechnique | None,
) -> CoachNote:
    """Diagnose the Part A choice against the real technique."""
    if result.technique_correct:
        return CoachNote(
            part="technique",
            severity="correct",
            headline=f"Correctly classified as {technique.technique_id}.",
            why=(
                f"The evidence for this stage is {technique.tactic.lower()} activity, and you "
                "read it as such."
            ),
            fix="Keep anchoring on the discriminating field rather than the process name alone.",
        )

    discriminator = technique.reference_indicators[0] if technique.reference_indicators else ""
    chosen = result.learner_technique_id

    # Same base technique, wrong sub-technique — a precision error, not a reading error.
    base_correct = technique.technique_id.split(".")[0]
    base_chosen = chosen.split(".")[0]
    if base_correct == base_chosen:
        return CoachNote(
            part="technique",
            severity="partial",
            headline=f"Right technique family, wrong level of detail: you chose {chosen}, the answer is {technique.technique_id}.",
            why=(
                f"Both sit under {base_correct}, so your reading of the activity was sound. "
                "What separates the sub-techniques is the specific mechanism in the evidence: "
                f"{discriminator}."
            ),
            fix=(
                "Once you have the family, scan for the one field that names the mechanism, then "
                "pick the sub-technique that field describes."
            ),
        )

    if picked is None:
        return CoachNote(
            part="technique",
            severity="error",
            headline=f"{chosen} is not the technique in this evidence — the answer is {technique.technique_id} ({technique.technique_name}).",
            why=f"The deciding signal here is: {discriminator}.",
            fix="Anchor on the single field that only one technique explains, then search the catalog for it.",
        )

    # Same tactic — the kill-chain phase was read correctly.
    if picked.tactic.lower() == technique.tactic.lower():
        return CoachNote(
            part="technique",
            severity="partial",
            headline=f"Right tactic, wrong technique: you chose {chosen} ({picked.name}); the answer is {technique.technique_id} ({technique.technique_name}).",
            why=(
                f"You placed this correctly in {technique.tactic}, so the kill-chain reading was "
                f"right. {picked.name} would leave different traces; what this evidence actually "
                f"shows is: {discriminator}."
            ),
            fix=(
                "When two techniques share a tactic, ask which one the *specific artefacts* "
                "require — not which one the scenario sounds like."
            ),
        )

    # Different tactic — the phase itself was misread.
    return CoachNote(
        part="technique",
        severity="error",
        headline=f"Wrong kill-chain phase: {chosen} ({picked.name}) is {picked.tactic}; this stage is {technique.tactic}.",
        why=(
            f"You read this as {picked.tactic.lower()}, but the evidence is about "
            f"{technique.tactic.lower()}: {discriminator}. Techniques that look similar often sit "
            "in different phases, and the phase is what the response depends on."
        ),
        fix=(
            "Before naming a technique, name the phase: what is the adversary trying to achieve "
            "at this moment — get in, run code, stay, steal, move, or act on the objective?"
        ),
    )


def _indicator_note(result: StepResult, technique: Technique) -> CoachNote:
    """Diagnose Part B: what was missed, what was a decoy, and the pattern behind it."""
    missed = result.missed_indicators
    decoys = result.false_positive_indicators
    total = len(result.correct_indicators)
    matched = len(result.matched_indicators)

    if not missed and not decoys:
        return CoachNote(
            part="indicators",
            severity="correct",
            headline=f"All {total} indicators identified, no decoys taken.",
            why="You separated the fields that carry signal from the ones that only look like they do.",
            fix="Keep asking of every field: would this look different on a clean host?",
        )

    reasons: list[str] = []

    # Blind-spot analysis: which telemetry did the learner simply not read?
    if missed:
        missed_families = _families(missed)
        caught_families = _families(result.matched_indicators)
        blind = sorted(missed_families - caught_families)
        if blind:
            reasons.append(
                f"Everything you missed sits in {_join(blind)}"
                + (f", while you did read {_join(sorted(caught_families))}" if caught_families else "")
                + " — the gap is a whole class of telemetry, not a detail"
            )
        else:
            reasons.append(
                f"You read the right telemetry but stopped at {matched} of {total} signals"
            )

    # Decoys: name the misconception behind each, from the authored explanations.
    decoy_explanations = [
        technique.red_herring_explanations[decoy]
        for decoy in decoys
        if decoy in technique.red_herring_explanations
    ]
    if decoy_explanations:
        reasons.append(decoy_explanations[0].rstrip("."))

    severity = "error" if result.indicator_jaccard == 0 else "partial"
    headline_parts = []
    if missed:
        headline_parts.append(f"{len(missed)} of {total} indicators missed")
    if decoys:
        headline_parts.append(f"{len(decoys)} decoy{'' if len(decoys) == 1 else 's'} selected")

    if decoys:
        fix = (
            "For each option ask whether the parenthetical claim is actually true of Windows. "
            "Most decoys here state a real field with a wrong interpretation attached."
        )
    else:
        fix = (
            "Work the tabs in order — process, then file, then network, then authentication — "
            "so no channel goes unread before you submit."
        )

    headline = _join(headline_parts)
    # Raise only the first character: str.capitalize() would lowercase the rest and
    # mangle any field name or ATT&CK id that appears later in the line.
    headline = (headline[0].upper() + headline[1:]) if headline else "Indicator selection"

    return CoachNote(
        part="indicators",
        severity=severity,
        headline=headline + ".",
        why=". ".join(reasons) + "." if reasons else "Some signals were left unselected.",
        fix=fix,
    )


def _response_note(result: StepResult, technique: Technique) -> CoachNote:
    """Diagnose Part C, distinguishing under-response from the wrong control surface."""
    chosen = result.learner_response_action
    correct = result.correct_response_action

    if result.response_correct:
        return CoachNote(
            part="response",
            severity="correct",
            headline=f"{correct} was the right call.",
            why=technique.response_rationale,
            fix="Keep matching the action to what the adversary has already achieved, not to how alarming it feels.",
        )

    chosen_strength = ACTION_STRENGTH.get(chosen, 0)
    correct_strength = ACTION_STRENGTH.get(correct, 0)
    chosen_effect = ACTION_EFFECT.get(chosen, "does not address this activity")

    if chosen_strength < correct_strength:
        why = (
            f"{chosen} {chosen_effect}, which is not enough here. {technique.response_rationale}"
        )
        fix = (
            "Ask what the adversary keeps if you take your action. If they keep code execution, "
            "credentials or a foothold, the action is too light."
        )
    elif chosen_strength > correct_strength:
        why = (
            f"{chosen} {chosen_effect} — heavier than this stage needs, and it costs availability "
            f"you did not have to spend. {technique.response_rationale}"
        )
        fix = "Choose the least disruptive action that still removes what the adversary gained."
    else:
        why = (
            f"{chosen} {chosen_effect}, which addresses a different surface to the one under "
            f"attack here. {technique.response_rationale}"
        )
        fix = (
            "Match the control surface to the artefact: process for execution, file for "
            "persistence on disk, network for egress, credentials for stolen identity."
        )

    return CoachNote(
        part="response",
        severity="error",
        headline=f"You chose {chosen}; the stage called for {correct}.",
        why=why,
        fix=fix,
    )


def _takeaway(result: StepResult, notes: list[CoachNote]) -> str:
    """A single rule of thumb, chosen from whichever part cost the most marks."""
    if all(note.severity == "correct" for note in notes):
        return (
            f"Clean sweep on {result.technique_id}. Carry the same discipline into the next stage: "
            "name the phase, then the mechanism, then the containment."
        )

    losses = {
        "technique": 0.40 - result.weighted_breakdown.technique_contribution,
        "indicators": 0.35 - result.weighted_breakdown.indicator_contribution,
        "response": 0.25 - result.weighted_breakdown.response_contribution,
    }
    worst = max(losses, key=losses.__getitem__)
    return {
        "technique": (
            "Biggest loss was the classification. Read the kill-chain phase off the evidence "
            "first — it narrows 679 techniques to a handful before you open the dropdown."
        ),
        "indicators": (
            "Biggest loss was indicator selection. Precision counts as much as recall here: "
            "every decoy you tick costs you as much as a signal you miss."
        ),
        "response": (
            "Biggest loss was the response. Decide from what the adversary already holds, "
            "not from how severe the technique sounds."
        ),
    }[worst]


def build_coaching(
    result: StepResult,
    technique: Technique,
    picked_technique: MitreTechnique | None,
) -> Coaching:
    """Diagnose all three parts of a graded decision."""
    notes = [
        _technique_note(result, technique, picked_technique),
        _indicator_note(result, technique),
        _response_note(result, technique),
    ]
    return Coaching(notes=notes, takeaway=_takeaway(result, notes))
