import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Cog,
  FileText,
  FolderOpen,
  GitBranch,
  Globe,
  KeyRound,
  LogIn,
  Package,
  Pause,
  Play,
  RotateCcw,
  Server,
  Settings,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ControlStatusBadge, TacticBadge } from '@/components/ui/CyberBadge';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/cn';
import type { AttackReplay as AttackReplayData, EdgeKind, ReplayEdge } from '@/types/baslab';

/** Seconds each stage holds before autoplay advances. */
const STEP_DURATION_MS = 5200;

const EDGE_META: Record<EdgeKind, { icon: typeof GitBranch; verb: string; tone: string }> = {
  spawn: { icon: GitBranch, verb: 'spawned', tone: 'text-cyan-300 border-cyan-500/35 bg-cyan-500/8' },
  inject: { icon: Zap, verb: 'injected into', tone: 'text-violet-300 border-violet-500/35 bg-violet-500/8' },
  access: { icon: KeyRound, verb: 'accessed', tone: 'text-amber-300 border-amber-500/35 bg-amber-500/8' },
  file: { icon: FileText, verb: 'wrote', tone: 'text-blue-300 border-blue-500/35 bg-blue-500/8' },
  registry: { icon: Settings, verb: 'set', tone: 'text-indigo-300 border-indigo-500/35 bg-indigo-500/8' },
  network: { icon: Globe, verb: 'connected to', tone: 'text-fuchsia-300 border-fuchsia-500/35 bg-fuchsia-500/8' },
  logon: { icon: LogIn, verb: 'authenticated to', tone: 'text-orange-300 border-orange-500/35 bg-orange-500/8' },
  share: { icon: FolderOpen, verb: 'mounted', tone: 'text-teal-300 border-teal-500/35 bg-teal-500/8' },
  service: { icon: Cog, verb: 'installed', tone: 'text-rose-300 border-rose-500/35 bg-rose-500/8' },
  load: { icon: Package, verb: 'loaded', tone: 'text-slate-700 dark:text-slate-300 border-slate-500/35 bg-slate-500/8' },
};

function clockOf(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toISOString().slice(11, 19);
}

function EdgeRow({ edge, index }: { edge: ReplayEdge; index: number }) {
  const meta = EDGE_META[edge.kind];
  const Icon = meta.icon;
  return (
    <motion.li
      initial={{ x: -18 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.32, delay: 0.12 + index * 0.14, ease: 'easeOut' }}
      className={cn('rounded-lg border px-3 py-2.5', meta.tone)}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="log-mono text-xs font-semibold text-slate-900 dark:text-slate-100">{edge.source}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider opacity-90">
          {meta.verb}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
        <span className="log-mono break-all text-xs font-semibold text-slate-900 dark:text-slate-100">{edge.target}</span>
      </div>
      {edge.detail ? (
        <p className="mt-1 break-all pl-5 log-mono text-[11px] text-slate-600 dark:text-slate-400">{edge.detail}</p>
      ) : null}
      <p className="mt-1 pl-5 text-[10px] uppercase tracking-wider text-slate-600">
        {edge.channel === 'Security'
          ? `Security EID ${edge.event_id}`
          : edge.channel.includes('Sysmon')
            ? `Sysmon EID ${edge.event_id}`
            : 'IIS access log'}
      </p>
    </motion.li>
  );
}

/**
 * Read-only kill-chain walkthrough shown after a run is graded.
 *
 * Every hop rendered here is read straight out of the log evidence the learner
 * already worked through — process ancestry, cross-process access, host-to-host
 * movement. Nothing is predicted, and nothing here affects any score.
 */
export function AttackReplay({ replay }: { replay: AttackReplayData }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const total = replay.steps.length;
  const step = replay.steps[index];

  const next = useCallback(() => {
    setIndex((current) => {
      if (current >= total - 1) {
        setPlaying(false);
        return current;
      }
      return current + 1;
    });
  }, [total]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(next, STEP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, next]);

  if (!step) return null;

  const atEnd = index >= total - 1;

  return (
    <GlassPanel className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-sm font-bold tracking-wide text-slate-900 dark:text-slate-100">Attack Replay</h3>
          <p className="text-[11px] text-slate-500">
            How {replay.threat_actor} moved through the estate · {clockOf(replay.first_seen)} →{' '}
            {clockOf(replay.last_seen)} · {replay.hosts.length} hosts
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setIndex((i) => Math.max(0, i - 1));
            }}
            disabled={index === 0}
            aria-label="Previous stage"
            className="rounded-md border border-slate-600/60 p-1.5 text-slate-700 dark:text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => {
              if (atEnd && !playing) {
                setIndex(0);
                setPlaying(true);
                return;
              }
              setPlaying((p) => !p);
            }}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/25"
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            ) : atEnd ? (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
            {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
          </button>

          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              next();
            }}
            disabled={atEnd}
            aria-label="Next stage"
            className="rounded-md border border-slate-600/60 p-1.5 text-slate-700 dark:text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Stage rail */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-700/50 px-4 py-2.5 sm:px-5">
        {replay.steps.map((s, i) => (
          <button
            key={s.step}
            type="button"
            onClick={() => {
              setPlaying(false);
              setIndex(i);
            }}
            aria-label={`Stage ${s.step}: ${s.technique_id}`}
            aria-current={i === index}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition-all',
              i === index
                ? 'scale-110 border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-glow-cyan'
                : s.detected
                  ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-300 hover:scale-105'
                  : 'border-red-500/50 bg-red-500/12 text-red-300 hover:scale-105',
            )}
          >
            {s.step}
          </button>
        ))}
        <span className="ml-auto log-mono text-[11px] text-slate-500">
          stage {index + 1} / {total}
        </span>
      </div>

      {/* Autoplay progress */}
      <div className="h-0.5 w-full bg-slate-800/70">
        <motion.div
          key={`${index}-${playing}`}
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
          initial={{ width: playing ? '0%' : '100%' }}
          animate={{ width: '100%' }}
          transition={{ duration: playing ? STEP_DURATION_MS / 1000 : 0, ease: 'linear' }}
        />
      </div>

      {/* Stage body.
          Deliberately not wrapped in AnimatePresence: `mode="wait"` holds the
          incoming stage until the outgoing one finishes exiting, and if that exit
          ever stalls (a backgrounded tab throttles rAF, for instance) the panel
          would keep rendering a stage that disagrees with its own counter. Keying
          a plain motion.div remounts on every change, so the body can never drift
          out of step with `index`. */}
      <div>
        <motion.div
          key={step.step}
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="px-4 py-4 sm:px-5"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="log-mono text-xs text-slate-500">{clockOf(step.timestamp)}</span>
            <span className="log-mono text-sm font-bold text-cyan-300">{step.technique_id}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{step.technique_name}</span>
            <TacticBadge tactic={step.tactic} />
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
                step.detected
                  ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-300'
                  : 'border-red-500/45 bg-red-500/12 text-red-300',
              )}
            >
              {step.detected ? (
                <Check className="h-3 w-3" aria-hidden />
              ) : (
                <X className="h-3 w-3" aria-hidden />
              )}
              {step.detected ? 'you caught this' : 'you missed this'}
            </span>
            <ControlStatusBadge status={step.control_status} />
          </div>

          <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{step.narrative}</p>

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {step.hosts.map((host) => (
              <span
                key={host}
                className="inline-flex items-center gap-1 rounded-md border border-slate-600/50 bg-slate-800/40 px-2 py-0.5 log-mono text-[11px] text-slate-700 dark:text-slate-300"
              >
                <Server className="h-3 w-3 text-slate-500" aria-hidden />
                {host}
              </span>
            ))}
          </div>

          <ul className="space-y-2">
            {step.edges.map((edge, i) => (
              <EdgeRow key={`${edge.kind}-${edge.source}-${edge.target}-${i}`} edge={edge} index={i} />
            ))}
          </ul>

          <motion.div
            transition={{ delay: 0.25 + step.edges.length * 0.14 }}
            className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <span className="section-label text-emerald-300">What would have stopped this</span>
            </div>
            <p className="text-xs leading-relaxed text-emerald-100">{step.countermeasure}</p>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Detection content: <span className="text-slate-600 dark:text-slate-400">{step.sigma_rule_title}</span>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </GlassPanel>
  );
}
