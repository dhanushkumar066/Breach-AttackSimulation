import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useBASLabStore } from '@/store/useBASLabStore';

function markerTone(score: number): string {
  if (score >= 0.75) return 'border-emerald-400/70 bg-emerald-500/25 text-emerald-300';
  if (score > 0) return 'border-amber-400/70 bg-amber-500/25 text-amber-300';
  return 'border-red-400/70 bg-red-500/25 text-red-300';
}

/**
 * Horizontal kill-chain rail: filled for graded steps, ringed for the current
 * one, hollow for what is still locked.
 *
 * Tactic labels only appear for steps that have already been graded — printing
 * the tactic of the current step would narrow the answer before submission.
 */
export function StepProgress() {
  const totalSteps = useBASLabStore((s) => s.totalSteps);
  const currentStepIndex = useBASLabStore((s) => s.currentStepIndex);
  const stepHistory = useBASLabStore((s) => s.stepHistory);
  const runningScore = useBASLabStore((s) => s.runningScore);

  if (totalSteps === 0) return null;

  const graded = stepHistory.length;
  const percent = (graded / totalSteps) * 100;

  return (
    <div className="glass-panel px-4 py-3 sm:px-5">
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/70">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          {Array.from({ length: totalSteps }, (_, index) => {
            const result = stepHistory[index];
            const isCurrent = index === currentStepIndex && !result;
            return (
              <li key={index} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold',
                    result
                      ? markerTone(result.step_score)
                      : isCurrent
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 animate-pulse-glow'
                        : 'border-slate-700 bg-slate-800/50 text-slate-600',
                  )}
                  aria-label={
                    result
                      ? `Step ${index + 1} graded, ${(result.step_score * 100).toFixed(0)} percent`
                      : isCurrent
                        ? `Step ${index + 1}, current`
                        : `Step ${index + 1}, locked`
                  }
                >
                  {index + 1}
                </span>
                <span className="text-[11px] font-medium">
                  {result ? (
                    <span className="text-slate-400">{result.tactic}</span>
                  ) : isCurrent ? (
                    <span className="text-cyan-400">Analysing…</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      <Lock className="h-3 w-3" aria-hidden />
                      Locked
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="shrink-0 text-right">
          <div className="section-label">Session score</div>
          <div className="font-mono text-lg font-bold tabular-nums text-emerald-300">
            {runningScore.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
