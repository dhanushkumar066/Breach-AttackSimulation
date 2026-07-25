import { motion } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { StepProgress } from '@/components/layout/StepProgress';
import { DetectionForm } from '@/components/session/DetectionForm';
import { LogViewer } from '@/components/session/LogViewer';
import { StepFeedback } from '@/components/session/StepFeedback';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { useBASLabStore } from '@/store/useBASLabStore';

/** The four-panel execution view: header, log console, decision form, progress rail. */
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
    if (!sessionId) navigate('/', { replace: true });
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      {error ? (
        <div className="px-4 pt-3 sm:px-6">
          <GlassPanel tone="danger" className="flex items-center gap-3 px-4 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <p className="flex-1 text-xs text-red-200">{error}</p>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </GlassPanel>
        </div>
      ) : null}

      <main className="grid min-h-0 flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <motion.div
          key={`logs-${currentStepIndex}`}
          initial={{ opacity: 0, x: -22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="min-h-0"
        >
          <LogViewer logEvidence={logEvidence} stepNumber={currentStepIndex + 1} />
        </motion.div>

        <motion.div
          key={`form-${currentStepIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="min-h-0"
        >
          <DetectionForm />
        </motion.div>
      </main>

      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <StepProgress />
      </div>

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
