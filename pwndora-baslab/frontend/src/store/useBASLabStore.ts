/**
 * Single Zustand store (with Immer) for the whole BASLab session lifecycle.
 *
 * The store never derives an answer locally: technique identity, indicator
 * correctness and Sigma rules all arrive from the backend after submission.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import * as api from '@/api/client';
import { ApiError } from '@/api/client';
import type {
  ComparisonResult,
  ControlEffectivenessReport,
  LogEntry,
  MitreTechnique,
  PlaybookMeta,
  StepResult,
} from '@/types/baslab';

export type StepPhase = 'idle' | 'loading' | 'awaiting_input' | 'submitted' | 'advancing';

interface BASLabState {
  // Playbook selection
  playbooks: PlaybookMeta[];
  playbooksLoading: boolean;
  selectedPlaybookId: string | null;

  // Active session
  sessionId: string | null;
  playbookName: string;
  threatActor: string;
  currentStepIndex: number;
  totalSteps: number;
  currentLogEvidence: LogEntry[];
  currentCheckboxOptions: string[];
  responseActions: string[];
  stepStatus: StepPhase;
  startedAt: number | null;
  runningScore: number;

  // Form state
  selectedTechniqueId: string;
  selectedIndicators: string[];
  selectedResponseAction: string;

  // Feedback
  lastStepResult: StepResult | null;
  /** Every step graded so far this run, in order. Drives the progress rail. */
  stepHistory: StepResult[];
  feedbackVisible: boolean;

  // Completion
  sessionComplete: boolean;
  report: ControlEffectivenessReport | null;
  reportLoading: boolean;

  // ATT&CK techniques for the Part A dropdown
  mitreOptions: MitreTechnique[];
  mitreLoading: boolean;

  // Comparison
  /** The most recently completed run — the default base for "Run Again". */
  previousSessionId: string | null;
  /** Run 1 of an in-flight comparison pair, carried for the whole second run. */
  baseSessionId: string | null;
  comparisonData: ComparisonResult | null;
  comparisonLoading: boolean;

  // Cross-cutting
  error: string | null;
  submitting: boolean;

  // Actions
  loadPlaybooks: () => Promise<void>;
  loadMitreTechniques: () => Promise<void>;
  startSession: (playbookId: string, baseSessionId?: string | null) => Promise<boolean>;
  setSelectedTechnique: (techniqueId: string) => void;
  toggleIndicator: (indicator: string) => void;
  setResponseAction: (action: string) => void;
  submitDetection: () => Promise<void>;
  advanceStep: () => Promise<'next' | 'completed' | 'error'>;
  loadReport: () => Promise<void>;
  loadComparison: (sessionId: string, compareWith: string) => Promise<void>;
  hideFeedback: () => void;
  clearError: () => void;
  resetSession: () => void;
}

const emptyFormState = {
  selectedTechniqueId: '',
  selectedIndicators: [] as string[],
  selectedResponseAction: '',
};

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

export const useBASLabStore = create<BASLabState>()(
  immer((set, get) => ({
    playbooks: [],
    playbooksLoading: false,
    selectedPlaybookId: null,

    sessionId: null,
    playbookName: '',
    threatActor: '',
    currentStepIndex: 0,
    totalSteps: 0,
    currentLogEvidence: [],
    currentCheckboxOptions: [],
    responseActions: [],
    stepStatus: 'idle',
    startedAt: null,
    runningScore: 0,

    ...emptyFormState,

    lastStepResult: null,
    stepHistory: [],
    feedbackVisible: false,

    sessionComplete: false,
    report: null,
    reportLoading: false,

    mitreOptions: [],
    mitreLoading: false,

    previousSessionId: null,
    baseSessionId: null,
    comparisonData: null,
    comparisonLoading: false,

    error: null,
    submitting: false,

    async loadPlaybooks() {
      set((s) => {
        s.playbooksLoading = true;
        s.error = null;
      });
      try {
        const playbooks = await api.getPlaybooks();
        set((s) => {
          s.playbooks = playbooks;
          s.playbooksLoading = false;
        });
      } catch (error) {
        set((s) => {
          s.playbooksLoading = false;
          s.error = describe(error);
        });
      }
    },

    async loadMitreTechniques() {
      if (get().mitreOptions.length > 0 || get().mitreLoading) return;
      set((s) => {
        s.mitreLoading = true;
      });
      try {
        const techniques = await api.getMitreTechniques();
        set((s) => {
          s.mitreOptions = techniques;
          s.mitreLoading = false;
        });
      } catch (error) {
        set((s) => {
          s.mitreLoading = false;
          s.error = describe(error);
        });
      }
    },

    async startSession(playbookId, baseSessionId = null) {
      set((s) => {
        s.stepStatus = 'loading';
        s.error = null;
        s.selectedPlaybookId = playbookId;
      });
      try {
        const session = await api.startSession(playbookId, baseSessionId);
        set((s) => {
          s.sessionId = session.session_id;
          s.baseSessionId = baseSessionId;
          s.playbookName = session.playbook_name;
          s.threatActor = session.threat_actor;
          s.totalSteps = session.total_steps;
          s.currentStepIndex = session.step.step_index;
          s.currentLogEvidence = session.step.log_evidence;
          s.currentCheckboxOptions = session.step.checkbox_options;
          s.responseActions = session.step.response_actions;
          s.stepStatus = 'awaiting_input';
          s.startedAt = Date.now();
          s.runningScore = 0;
          s.selectedTechniqueId = '';
          s.selectedIndicators = [];
          s.selectedResponseAction = '';
          s.lastStepResult = null;
          s.stepHistory = [];
          s.feedbackVisible = false;
          s.sessionComplete = false;
          s.report = null;
          s.comparisonData = null;
        });
        return true;
      } catch (error) {
        set((s) => {
          s.stepStatus = 'idle';
          s.error = describe(error);
        });
        return false;
      }
    },

    setSelectedTechnique(techniqueId) {
      set((s) => {
        s.selectedTechniqueId = techniqueId;
      });
    },

    toggleIndicator(indicator) {
      set((s) => {
        const index = s.selectedIndicators.indexOf(indicator);
        if (index >= 0) s.selectedIndicators.splice(index, 1);
        else s.selectedIndicators.push(indicator);
      });
    },

    setResponseAction(action) {
      set((s) => {
        s.selectedResponseAction = action;
      });
    },

    async submitDetection() {
      const { sessionId, selectedTechniqueId, selectedIndicators, selectedResponseAction } = get();
      if (!sessionId || !selectedTechniqueId || !selectedResponseAction) return;

      set((s) => {
        s.submitting = true;
        s.error = null;
      });
      try {
        const evaluation = await api.evaluateStep(sessionId, {
          technique_id: selectedTechniqueId,
          indicators: selectedIndicators,
          response_action: selectedResponseAction,
        });
        set((s) => {
          s.lastStepResult = evaluation.result;
          s.stepHistory.push(evaluation.result);
          s.runningScore = evaluation.running_score;
          s.feedbackVisible = true;
          s.stepStatus = 'submitted';
          s.submitting = false;
        });
      } catch (error) {
        set((s) => {
          s.submitting = false;
          s.error = describe(error);
        });
      }
    },

    async advanceStep() {
      const { sessionId } = get();
      if (!sessionId) return 'error';

      set((s) => {
        s.stepStatus = 'advancing';
        s.error = null;
      });
      try {
        const advance = await api.advanceStep(sessionId);
        if (advance.completed || !advance.step) {
          set((s) => {
            s.sessionComplete = true;
            s.feedbackVisible = false;
            s.stepStatus = 'idle';
            s.previousSessionId = s.sessionId;
          });
          return 'completed';
        }
        set((s) => {
          s.currentStepIndex = advance.step!.step_index;
          s.currentLogEvidence = advance.step!.log_evidence;
          s.currentCheckboxOptions = advance.step!.checkbox_options;
          s.responseActions = advance.step!.response_actions;
          s.selectedTechniqueId = '';
          s.selectedIndicators = [];
          s.selectedResponseAction = '';
          s.lastStepResult = null;
          s.feedbackVisible = false;
          s.stepStatus = 'awaiting_input';
        });
        return 'next';
      } catch (error) {
        set((s) => {
          s.stepStatus = 'submitted';
          s.error = describe(error);
        });
        return 'error';
      }
    },

    async loadReport() {
      const { sessionId } = get();
      if (!sessionId) return;
      set((s) => {
        s.reportLoading = true;
        s.error = null;
      });
      try {
        const report = await api.getReport(sessionId);
        set((s) => {
          s.report = report;
          s.reportLoading = false;
        });
      } catch (error) {
        set((s) => {
          s.reportLoading = false;
          s.error = describe(error);
        });
      }
    },

    async loadComparison(sessionId, compareWith) {
      set((s) => {
        s.comparisonLoading = true;
        s.error = null;
      });
      try {
        const comparison = await api.getComparison(sessionId, compareWith);
        set((s) => {
          s.comparisonData = comparison;
          s.comparisonLoading = false;
        });
      } catch (error) {
        set((s) => {
          s.comparisonLoading = false;
          s.error = describe(error);
        });
      }
    },

    hideFeedback() {
      set((s) => {
        s.feedbackVisible = false;
      });
    },

    clearError() {
      set((s) => {
        s.error = null;
      });
    },

    resetSession() {
      set((s) => {
        // previousSessionId, playbooks and the ATT&CK catalog deliberately survive
        // a reset: they are what make "Run Again" and the comparison view possible.
        s.sessionId = null;
        s.playbookName = '';
        s.threatActor = '';
        s.currentStepIndex = 0;
        s.totalSteps = 0;
        s.currentLogEvidence = [];
        s.currentCheckboxOptions = [];
        s.responseActions = [];
        s.stepStatus = 'idle';
        s.startedAt = null;
        s.runningScore = 0;
        s.selectedTechniqueId = '';
        s.selectedIndicators = [];
        s.selectedResponseAction = '';
        s.lastStepResult = null;
        s.stepHistory = [];
        s.feedbackVisible = false;
        s.sessionComplete = false;
        s.report = null;
        s.comparisonData = null;
        s.error = null;
        s.submitting = false;
      });
    },
  })),
);
