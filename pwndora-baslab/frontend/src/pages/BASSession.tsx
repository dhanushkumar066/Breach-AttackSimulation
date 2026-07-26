import { AlertCircle, X } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { StatusBar } from '@/components/layout/StatusBar';
import { StepProgress } from '@/components/layout/StepProgress';
import { DetectionForm } from '@/components/session/DetectionForm';
import { LogViewer } from '@/components/session/LogViewer';
import { StepFeedback } from '@/components/session/StepFeedback';
import { useBASLabStore } from '@/store/useBASLabStore';

/** Live execution view: telemetry header, log terminal, triage console, status bar. */
export function BASSession() {
  const navigate = useNavigate();
  const sessionId = useBASLabStore((s) => s.sessionId);
  const logEvidence = useBASLabStore((s) => s.currentLogEvidence);
  const currentStepIndex = useBASLabStore((s) => s.currentStepIndex);
  const totalSteps = useBASLabStore((s) => s.totalSteps);
  const lastStepResult = useBASLabStore((s) => s.lastStepResult);
  const feedbackVisible = useBASLabStore((s) => s.feedbackVisible);
  const stepStatus = useBASLabStore((s) => s.stepStatus);
  const error = useBASLabStore((s) => s.error);
  const clearError = useBASLabStore((s) => s.clearError);
  const advanceStep = useBASLabStore((s) => s.advanceStep);
  const loadMitreTechniques = useBASLabStore((s) => s.loadMitreTechniques);

  // A hard refresh drops the in-memory session handle; send the learner back to
  // the library rather than rendering an empty console.
  useEffect(() => {
    if (!sessionId) navigate('/playbooks', { replace: true });
  }, [sessionId, navigate]);

  useEffect(() => {
    void loadMitreTechniques();
  }, [loadMitreTechniques]);

  async function handleAdvance() {
    const outcome = await advanceStep();
    if (outcome === 'completed') navigate('/report');
  }

  if (!sessionId) return null;

  const isFinalStep = currentStepIndex === totalSteps - 1;
  const host = logEvidence[0]?.computer;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="mesh-gradient" />
      <div className="cyber-grid" />

      <Header />

      {error ? (
        <div className="shrink-0 px-4 pt-3 sm:px-8">
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
            <p className="flex-1 text-xs text-red-600 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <main className="grid min-h-0 flex-grow gap-6 p-4 sm:p-8 lg:grid-cols-[60%_1fr]">
        <div className="min-h-0">
          <LogViewer logEvidence={logEvidence} stepNumber={currentStepIndex + 1} />
        </div>
        <div className="min-h-0">
          <DetectionForm />
        </div>
      </main>

      <div className="shrink-0 px-4 pb-4 sm:px-8">
        <StepProgress />
      </div>

      <StatusBar
        host={host}
        sessionId={sessionId}
        connected={!error}
        eventCount={logEvidence.length}
        stepLabel={`STAGE ${currentStepIndex + 1} / ${totalSteps}`}
      />

      <StepFeedback
        result={lastStepResult}
        visible={feedbackVisible}
        isFinalStep={isFinalStep}
        advancing={stepStatus === 'advancing'}
        onAdvance={() => void handleAdvance()}
      />
    </div>
  );
}
