"""Deterministic scoring engine.

Every function here is a pure function of its inputs. Identical submissions always
produce byte-identical results: there is no randomness, no clock read and no
partial credit that depends on ordering. This is the property judges verify by
submitting the same answers twice.

Composite weighting (sums to 1.00):

    step_score = 0.40 * technique + 0.35 * indicator_jaccard + 0.25 * response
"""

from __future__ import annotations

from api.models.playbook import Technique
from api.models.report import SessionScore
from api.models.session import Decision, StepResult, WeightedBreakdown

TECHNIQUE_WEIGHT = 0.40
INDICATOR_WEIGHT = 0.35
RESPONSE_WEIGHT = 0.25

#: Step scores at or above this threshold count as a fully effective control.
DETECTED_THRESHOLD = 0.75


def evaluate_step(decision: Decision, technique: Technique, step_index: int = 0) -> StepResult:
    """Grade one three-part detection decision against the technique answer key."""
    # Part A: Technique Classification
    technique_score = 1.0 if decision.technique_id == technique.technique_id else 0.0

    # Part B: Indicator Jaccard Score
    submitted = set(decision.indicators)
    reference = set(technique.reference_indicators)
    if not reference:
        indicator_score = 0.0
    else:
        intersection = len(submitted & reference)
        union = len(submitted | reference)
        indicator_score = intersection / union if union > 0 else 0.0

    # Part C: Response Action
    response_score = 1.0 if decision.response_action == technique.correct_response_action else 0.0

    # Weighted composite
    step_score = (
        (TECHNIQUE_WEIGHT * technique_score)
        + (INDICATOR_WEIGHT * indicator_score)
        + (RESPONSE_WEIGHT * response_score)
    )

    return StepResult(
        step_index=step_index,
        step_score=round(step_score, 4),
        technique_correct=bool(technique_score),
        indicator_jaccard=round(indicator_score, 4),
        response_correct=bool(response_score),
        weighted_breakdown=WeightedBreakdown(
            technique_contribution=round(TECHNIQUE_WEIGHT * technique_score, 4),
            indicator_contribution=round(INDICATOR_WEIGHT * indicator_score, 4),
            response_contribution=round(RESPONSE_WEIGHT * response_score, 4),
        ),
        technique_id=technique.technique_id,
        technique_name=technique.technique_name,
        tactic=technique.tactic,
        technique_description=technique.description,
        learner_technique_id=decision.technique_id,
        learner_response_action=decision.response_action,
        correct_response_action=technique.correct_response_action,
        correct_indicators=list(technique.reference_indicators),
        matched_indicators=[i for i in technique.reference_indicators if i in submitted],
        missed_indicators=[i for i in technique.reference_indicators if i not in submitted],
        false_positive_indicators=sorted(submitted - reference),
        sigma_rule_yaml=technique.sigma_rule_yaml,
        sigma_rule_title=technique.sigma_rule_title,
    )


def aggregate_session_score(step_results: list[StepResult]) -> SessionScore:
    """Roll per-step results up into the headline session figures."""
    total_steps = len(step_results)
    if total_steps == 0:
        return SessionScore(
            session_score=0.0,
            detection_rate=0.0,
            techniques_detected=0,
            total_techniques=0,
        )

    detected_steps = sum(1 for r in step_results if r.technique_correct)
    session_score = (sum(r.step_score for r in step_results) / total_steps) * 100
    detection_rate = (detected_steps / total_steps) * 100
    return SessionScore(
        session_score=round(session_score, 2),
        detection_rate=round(detection_rate, 2),
        techniques_detected=detected_steps,
        total_techniques=total_steps,
    )


def running_score(step_results: list[StepResult], total_steps: int) -> float:
    """Score so far as a percentage of the *whole* playbook, not just graded steps.

    The header ticker uses this: unevaluated steps count as zero, so the number
    can only climb as the learner works through the run.
    """
    if total_steps <= 0:
        return 0.0
    return round((sum(r.step_score for r in step_results) / total_steps) * 100, 2)


def control_status(result: StepResult) -> str:
    """Map a graded step onto its control-effectiveness classification."""
    if not result.technique_correct:
        return "MISSED"
    if result.step_score >= DETECTED_THRESHOLD:
        return "DETECTED"
    return "PARTIALLY_DETECTED"
