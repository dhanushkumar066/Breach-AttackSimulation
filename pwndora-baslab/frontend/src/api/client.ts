/**
 * Typed fetch wrappers for the BASLab API.
 *
 * All requests are same-origin: in dev the Vite proxy forwards /api to the
 * FastAPI process, in the container nginx does the same. That keeps the browser
 * on one origin, so no credentials or API base URL ever ship in the bundle.
 */

import type {
  AdvanceResponse,
  AttackReplay,
  ComparisonResult,
  ControlEffectivenessReport,
  EvaluateRequest,
  EvaluateResponse,
  HealthResponse,
  MitreTechnique,
  PlaybookMeta,
  RiskView360Export,
  StartSessionResponse,
  StepResponse,
} from '@/types/baslab';

const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the BASLab API. Is the backend running on port 8000?');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorDetail(response));
  }

  return (await response.json()) as T;
}

/** FastAPI reports errors as {detail: string} or {detail: [{msg, loc}]}. */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d: { msg?: string }) => d?.msg ?? 'invalid input').join('; ');
    }
  } catch {
    /* fall through to the status text */
  }
  return `${response.status} ${response.statusText}`.trim();
}

/** 1. Liveness and bundled-content check. */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

/** 2. All playbooks (metadata only — no answer key). */
export function getPlaybooks(): Promise<PlaybookMeta[]> {
  return request<PlaybookMeta[]>('/playbooks');
}

/** 3. ATT&CK Enterprise catalog for the Part A dropdown. */
export function getMitreTechniques(search?: string): Promise<MitreTechnique[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<MitreTechnique[]>(`/mitre/techniques${query}`);
}

/** 4. Start a run; returns the session handle and the first step. */
export function startSession(
  playbookId: string,
  baseSessionId?: string | null,
): Promise<StartSessionResponse> {
  return request<StartSessionResponse>('/session/start', {
    method: 'POST',
    body: JSON.stringify({
      playbook_id: playbookId,
      ...(baseSessionId ? { base_session_id: baseSessionId } : {}),
    }),
  });
}

/** 5. Re-read the current step (technique identity withheld). */
export function getCurrentStep(sessionId: string): Promise<StepResponse> {
  return request<StepResponse>(`/session/${encodeURIComponent(sessionId)}/current-step`);
}

/** 6. Submit the three-part detection decision. */
export function evaluateStep(
  sessionId: string,
  decision: EvaluateRequest,
): Promise<EvaluateResponse> {
  return request<EvaluateResponse>(`/session/${encodeURIComponent(sessionId)}/evaluate`, {
    method: 'POST',
    body: JSON.stringify(decision),
  });
}

/** 7. Advance to the next technique (403 until the current step is submitted). */
export function advanceStep(sessionId: string): Promise<AdvanceResponse> {
  return request<AdvanceResponse>(`/session/${encodeURIComponent(sessionId)}/advance`, {
    method: 'POST',
  });
}

/** 8. Control Effectiveness Report for a completed run. */
export function getReport(sessionId: string): Promise<ControlEffectivenessReport> {
  return request<ControlEffectivenessReport>(`/session/${encodeURIComponent(sessionId)}/report`);
}

/** 9. RiskView360 integration export. */
export function getRiskView360Export(sessionId: string): Promise<RiskView360Export> {
  return request<RiskView360Export>(
    `/session/${encodeURIComponent(sessionId)}/export/riskview360`,
  );
}

/** 10. Kill-chain replay of how the intrusion unfolded (completed runs only). */
export function getAttackReplay(sessionId: string): Promise<AttackReplay> {
  return request<AttackReplay>(`/session/${encodeURIComponent(sessionId)}/replay`);
}

/** 11. Compare two completed runs of the same playbook. */
export function getComparison(
  sessionId: string,
  compareWith: string,
): Promise<ComparisonResult> {
  return request<ComparisonResult>(
    `/session/${encodeURIComponent(sessionId)}/comparison?compare_with=${encodeURIComponent(
      compareWith,
    )}`,
  );
}
