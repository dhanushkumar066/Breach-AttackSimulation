import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import type { ControlStatus, Difficulty } from '@/types/baslab';

/** Per-tactic colour so the kill chain is readable at a glance. */
const TACTIC_STYLES: Record<string, string> = {
  Reconnaissance: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  'Resource Development': 'border-teal-500/40 bg-teal-500/10 text-teal-300',
  'Initial Access': 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  Execution: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  Persistence: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  'Privilege Escalation': 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  'Defense Evasion': 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  'Credential Access': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Discovery: 'border-lime-500/40 bg-lime-500/10 text-lime-300',
  'Lateral Movement': 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  Collection: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  'Command and Control': 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300',
  Exfiltration: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  Impact: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Moderate: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Hard: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const STATUS_STYLES: Record<ControlStatus, string> = {
  DETECTED: 'border-emerald-500/45 bg-emerald-500/12 text-emerald-300',
  PARTIALLY_DETECTED: 'border-amber-500/45 bg-amber-500/12 text-amber-300',
  MISSED: 'border-red-500/45 bg-red-500/12 text-red-300',
};

const STATUS_LABELS: Record<ControlStatus, string> = {
  DETECTED: 'DETECTED',
  PARTIALLY_DETECTED: 'PARTIAL',
  MISSED: 'MISSED',
};

const base =
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap';

const neutral = 'border-slate-600/50 bg-slate-700/25 text-slate-300';

export function TacticBadge({ tactic, className }: { tactic: string; className?: string }) {
  return <span className={cn(base, TACTIC_STYLES[tactic] ?? neutral, className)}>{tactic}</span>;
}

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return <span className={cn(base, DIFFICULTY_STYLES[difficulty], className)}>{difficulty}</span>;
}

export function ControlStatusBadge({
  status,
  className,
}: {
  status: ControlStatus;
  className?: string;
}) {
  return <span className={cn(base, STATUS_STYLES[status], className)}>{STATUS_LABELS[status]}</span>;
}

export function CyberBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'cyan' | 'amber' | 'emerald' | 'red';
  className?: string;
}) {
  const tones = {
    neutral,
    cyan: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    red: 'border-red-500/40 bg-red-500/10 text-red-300',
  } as const;
  return <span className={cn(base, tones[tone], className)}>{children}</span>;
}
