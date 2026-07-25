import { motion } from 'framer-motion';
import { Activity, Radar, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CyberBadge } from '@/components/ui/CyberBadge';
import { useBASLabStore } from '@/store/useBASLabStore';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

/** Session chrome: product mark, playbook, step counter, timer and live score. */
export function Header() {
  const playbookName = useBASLabStore((s) => s.playbookName);
  const threatActor = useBASLabStore((s) => s.threatActor);
  const currentStepIndex = useBASLabStore((s) => s.currentStepIndex);
  const totalSteps = useBASLabStore((s) => s.totalSteps);
  const runningScore = useBASLabStore((s) => s.runningScore);
  const startedAt = useBASLabStore((s) => s.startedAt);
  const sessionComplete = useBASLabStore((s) => s.sessionComplete);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || sessionComplete) return;
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, sessionComplete]);

  return (
    <header className="glass-panel sticky top-0 z-30 rounded-none border-x-0 border-t-0 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10">
            <Radar className="h-5 w-5 text-cyan-400" aria-hidden />
            <span className="absolute inset-0 animate-pulse-glow rounded-lg bg-cyan-500/10" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-[0.18em] text-cyan-300 text-glow-cyan">
              PWNDORA BASLab
            </div>
            <div className="text-[11px] text-slate-500">Breach &amp; Attack Simulation</div>
          </div>
        </div>

        {playbookName ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-200">{playbookName}</span>
            <CyberBadge tone="amber">{threatActor}</CyberBadge>
          </div>
        ) : null}

        <div className="flex items-center gap-4">
          {totalSteps > 0 ? (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="section-label">Step</span>
              <span className="font-mono font-bold text-cyan-300">
                {Math.min(currentStepIndex + 1, totalSteps)}
              </span>
              <span className="text-slate-600">/</span>
              <span className="font-mono text-slate-400">{totalSteps}</span>
            </div>
          ) : null}

          {startedAt ? (
            <div className="flex items-center gap-1.5 text-sm text-slate-300">
              <Timer className="h-4 w-4 text-slate-500" aria-hidden />
              <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-emerald-400" aria-hidden />
            <span className="section-label">Score</span>
            <motion.span
              key={runningScore}
              initial={{ opacity: 0.35, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="font-mono text-sm font-bold tabular-nums text-emerald-300"
            >
              {runningScore.toFixed(2)}
            </motion.span>
          </div>
        </div>
      </div>
    </header>
  );
}
