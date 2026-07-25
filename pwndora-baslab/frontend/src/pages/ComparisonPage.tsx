import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, GitCompareArrows } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ComparisonPanel } from '@/components/report/ComparisonPanel';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GlowButton } from '@/components/ui/GlowButton';
import { useBASLabStore } from '@/store/useBASLabStore';

export function ComparisonPage() {
  const navigate = useNavigate();
  const sessionId = useBASLabStore((s) => s.sessionId);
  const baseSessionId = useBASLabStore((s) => s.baseSessionId);
  const comparison = useBASLabStore((s) => s.comparisonData);
  const loading = useBASLabStore((s) => s.comparisonLoading);
  const error = useBASLabStore((s) => s.error);
  const loadComparison = useBASLabStore((s) => s.loadComparison);

  useEffect(() => {
    if (!sessionId || !baseSessionId) {
      navigate('/', { replace: true });
      return;
    }
    // Run 1 is the base session, run 2 is the run just completed.
    void loadComparison(baseSessionId, sessionId);
  }, [sessionId, baseSessionId, loadComparison, navigate]);

  return (
    <div className="min-h-screen grid-noise">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <div className="section-label flex items-center gap-2">
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
              Playbook comparison
            </div>
            <h1 className="mt-1 text-3xl font-bold text-slate-50">
              {comparison?.playbook_name ?? 'Run comparison'}
            </h1>
            {comparison ? (
              <p className="mt-2 log-mono text-[11px] text-slate-500">
                run 1 {comparison.run_1_session_id} · run 2 {comparison.run_2_session_id}
              </p>
            ) : null}
          </div>

          <GlowButton
            variant="ghost"
            onClick={() => navigate('/report')}
            icon={<ArrowLeft className="h-4 w-4" aria-hidden />}
          >
            Back to report
          </GlowButton>
        </motion.header>

        {error ? (
          <GlassPanel tone="danger" className="mb-6 flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
            <p className="text-sm text-red-200">{error}</p>
          </GlassPanel>
        ) : null}

        {loading || !comparison ? (
          <GlassPanel className="p-8 text-center">
            <p className="animate-pulse text-sm text-slate-400">Comparing runs…</p>
          </GlassPanel>
        ) : (
          <ComparisonPanel comparison={comparison} />
        )}
      </div>
    </div>
  );
}
