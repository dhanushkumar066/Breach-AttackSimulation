import { Bell, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useBASLabStore } from '@/store/useBASLabStore';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** Top telemetry header for a live run: scenario, progress, timer, live score. */
export function Header() {
  const playbookName = useBASLabStore((s) => s.playbookName);
  const currentStepIndex = useBASLabStore((s) => s.currentStepIndex);
  const totalSteps = useBASLabStore((s) => s.totalSteps);
  const runningScore = useBASLabStore((s) => s.runningScore);
  const startedAt = useBASLabStore((s) => s.startedAt);
  const sessionComplete = useBASLabStore((s) => s.sessionComplete);
  const stepHistory = useBASLabStore((s) => s.stepHistory);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || sessionComplete) return;
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, sessionComplete]);

  const stepNumber = Math.min(currentStepIndex + 1, totalSteps || 1);
  const progress = totalSteps > 0 ? (stepHistory.length / totalSteps) * 100 : 0;

  return (
    <header className="z-50 flex w-full shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-[#0c101d]/75 sm:px-8">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="label-caps text-slate-500 dark:text-slate-400">SCENARIO</span>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {playbookName || 'Active Simulation'}
          </span>
        </div>

        <div className="hidden h-8 w-px bg-slate-200 dark:bg-white/10 sm:block" />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1 dark:border-brand-cyan/30 dark:bg-brand-cyan/10">
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-brand-blue dark:bg-brand-cyan" />
            <span className="label-caps text-[10px] text-brand-blue dark:text-brand-cyan">
              {sessionComplete ? 'SESSION COMPLETE' : 'LIVE SESSION'}
            </span>
          </div>

          {totalSteps > 0 ? (
            <div className="flex flex-col">
              <span className="label-caps text-[10px] text-slate-500 dark:text-slate-400">
                PROGRESS
              </span>
              <div className="flex items-center gap-2">
                <span className="label-caps text-slate-900 dark:text-white">
                  Step {stepNumber} of {totalSteps}
                </span>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-brand-blue transition-all duration-500 dark:bg-brand-cyan dark:shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-10">
        {startedAt ? (
          <div className="flex flex-col items-end">
            <span className="label-caps text-[10px] text-slate-500 dark:text-slate-400">
              ELAPSED TIME
            </span>
            <span className="font-mono text-xl tracking-widest text-slate-900 dark:text-white">
              {formatElapsed(elapsed)}
            </span>
          </div>
        ) : null}

        <div className="flex flex-col items-end">
          <span className="label-caps text-[10px] text-slate-500 dark:text-slate-400">
            SESSION SCORE
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-glow-cyan text-3xl font-semibold tabular-nums text-brand-blue dark:text-brand-cyan">
              {runningScore.toFixed(1)}
            </span>
            <span className="label-caps text-slate-500 dark:text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <Bell className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-blue/40 bg-brand-blue/10 text-brand-blue dark:border-brand-cyan/50 dark:bg-brand-cyan/10 dark:text-brand-cyan">
            <User className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </div>
    </header>
  );
}
