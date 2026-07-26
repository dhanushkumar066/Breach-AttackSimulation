/**
 * TypeScript mirrors of the FastAPI response models.
 * Keep in sync with api/models/*.py — the names match one-for-one.
 */

export type LogChannel =
  | 'Security'
  | 'Microsoft-Windows-Sysmon/Operational'
  | 'Microsoft-IIS-Logging/Logs';

export type Difficulty = 'Easy' | 'Moderate' | 'Hard';

export type StepStatus = 'pending' | 'submitted';

export type ControlStatus = 'DETECTED' | 'PARTIALLY_DETECTED' | 'MISSED';

export type ResponseAction =
  | 'Isolate Host'
  | 'Block IP/Domain'
  | 'Kill Process'
  | 'Revoke Credentials'
  | 'Alert SOC Only'
  | 'Quarantine File'
  | 'No Action Required';

export interface LogEntry {
  channel: LogChannel;
  event_id: number;
  timestamp: string;
  computer: string;
  fields: Record<string, string>;
}

export interface PlaybookMeta {
  playbook_id: string;
  name: string;
  threat_actor: string;
  difficulty: Difficulty;
  description: string;
  technique_count: number;
  tactics: string[];
}

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
}

export interface WeightedBreakdown {
  technique_contribution: number;
  indicator_contribution: number;
  response_contribution: number;
}

export type CoachPart = 'technique' | 'indicators' | 'response';
export type CoachSeverity = 'correct' | 'partial' | 'error';

export interface CoachNote {
  part: CoachPart;
  severity: CoachSeverity;
  headline: string;
  why: string;
  fix: string;
}

export interface Coaching {
  notes: CoachNote[];
  takeaway: string;
}

export interface StepResult {
  step_index: number;
  step_score: number;
  technique_correct: boolean;
  indicator_jaccard: number;
  response_correct: boolean;
  weighted_breakdown: WeightedBreakdown;
  technique_id: string;
  technique_name: string;
  tactic: string;
  technique_description: string;
  learner_technique_id: string;
  learner_response_action: string;
  correct_response_action: string;
  correct_indicators: string[];
  matched_indicators: string[];
  missed_indicators: string[];
  false_positive_indicators: string[];
  sigma_rule_yaml: string;
  sigma_rule_title: string;
  coaching: Coaching | null;
}

export interface StepResponse {
  session_id: string;
  step_index: number;
  step_number: number;
  total_steps: number;
  step_status: StepStatus;
  log_evidence: LogEntry[];
  checkbox_options: string[];
  response_actions: string[];
  completed: boolean;
}

export interface StartSessionResponse {
  session_id: string;
  playbook_id: string;
  playbook_name: string;
  threat_actor: string;
  total_steps: number;
  step: StepResponse;
}

export interface EvaluateRequest {
  technique_id: string;
  indicators: string[];
  response_action: string;
}

export interface EvaluateResponse {
  session_id: string;
  result: StepResult;
  running_score: number;
  steps_evaluated: number;
  total_steps: number;
  is_final_step: boolean;
}

export interface AdvanceResponse {
  session_id: string;
  completed: boolean;
  step: StepResponse | null;
}

export interface TechniqueResult {
  step: number;
  technique_id: string;
  technique_name: string;
  tactic: string;
  learner_technique_id: string;
  detected: boolean;
  indicator_jaccard: number;
  response_correct: boolean;
  step_score: number;
  missed_indicators: string[];
  sigma_rule_title: string;
  control_status: ControlStatus;
}

export interface ControlGap {
  technique_id: string;
  technique_name: string;
  tactic: string;
  gap_reason: string;
  recommended_control: string;
  sigma_rule_title: string;
}

export interface SigmaRecommendation {
  technique_id: string;
  title: string;
  sigma_yaml: string;
}

export interface ControlEffectivenessReport {
  session_id: string;
  playbook_id: string;
  playbook_name: string;
  threat_actor: string;
  completed_at: string;
  overall_detection_rate: number;
  session_score: number;
  techniques_detected: number;
  total_techniques: number;
  technique_results: TechniqueResult[];
  security_control_gaps: ControlGap[];
  sigma_recommendations: SigmaRecommendation[];
  riskview360_compatible: boolean;
  riskview360_export_url: string;
}

export interface RiskView360Coverage {
  technique_id: string;
  tactic: string;
  detected: boolean;
  control_status: ControlStatus;
}

export interface RiskView360Export {
  schema_version: string;
  source: string;
  export_timestamp: string;
  session_reference: string;
  playbook_name: string;
  overall_detection_rate: number;
  session_score: number;
  attack_coverage: RiskView360Coverage[];
  control_gaps: ControlGap[];
  recommended_training: string[];
}

export type EdgeKind =
  | 'spawn'
  | 'inject'
  | 'access'
  | 'file'
  | 'registry'
  | 'network'
  | 'logon'
  | 'share'
  | 'service'
  | 'load';

export interface ReplayEdge {
  kind: EdgeKind;
  source: string;
  target: string;
  detail: string;
  channel: string;
  event_id: number;
}

export interface ReplayStep {
  step: number;
  technique_id: string;
  technique_name: string;
  tactic: string;
  narrative: string;
  timestamp: string;
  hosts: string[];
  edges: ReplayEdge[];
  detected: boolean;
  control_status: ControlStatus;
  countermeasure: string;
  sigma_rule_title: string;
}

export interface AttackReplay {
  session_id: string;
  playbook_id: string;
  playbook_name: string;
  threat_actor: string;
  total_steps: number;
  techniques_detected: number;
  first_seen: string;
  last_seen: string;
  hosts: string[];
  steps: ReplayStep[];
}

export interface TechniqueDelta {
  technique_id: string;
  technique_name: string;
  run_1_score: number;
  run_2_score: number;
  delta: number;
  improved: boolean;
}

export interface ComparisonResult {
  run_1_session_id: string;
  run_2_session_id: string;
  playbook_name: string;
  run_1_score: number;
  run_2_score: number;
  improvement_delta: number;
  run_1_detection_rate: number;
  run_2_detection_rate: number;
  per_technique_delta: TechniqueDelta[];
}

export interface HealthResponse {
  status: string;
  version: string;
  problem_statement: string;
  playbooks: number;
  techniques: number;
  mitre_techniques: number;
  active_sessions: number;
}
