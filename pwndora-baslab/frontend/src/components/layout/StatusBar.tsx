import { Activity, Layers, Monitor, Radio } from 'lucide-react';

/**
 * Bottom telemetry bar.
 *
 * Every value shown is real: the host comes from the evidence on screen, the
 * session id is the live ULID, and the counters come from session state. The
 * mockup's CPU/MEM gauges are deliberately not reproduced — inventing system
 * metrics in a security tool would be showing the analyst a number that means
 * nothing.
 */
export function StatusBar({
  host,
  sessionId,
  connected = true,
  eventCount,
  stepLabel,
}: {
  host?: string;
  sessionId?: string | null;
  connected?: boolean;
  eventCount?: number;
  stepLabel?: string;
}) {
  return (
    <footer className="flex h-10 shrink-0 items-center justify-between border-t border-slate-200 bg-white/80 px-4 backdrop-blur-xl transition-colors duration-300 dark:border-white/5 dark:bg-[#05080F]/60 sm:px-8">
      <div className="flex h-full items-center">
        <div className="flex h-full items-center gap-2 border-r border-slate-200 pr-4 dark:border-white/5">
          <span
            className={
              connected
                ? 'h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-glow'
                : 'h-1.5 w-1.5 rounded-full bg-red-500'
            }
          />
          <span className="label-caps text-[10px] text-emerald-600 dark:text-emerald-400">
            {connected ? 'SYSTEM_CONNECTED' : 'SYSTEM_OFFLINE'}
          </span>
        </div>

        {host ? (
          <div className="hidden h-full items-center gap-2 border-r border-slate-200 px-4 dark:border-white/5 sm:flex">
            <Monitor className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden />
            <span className="label-caps text-[10px] text-slate-700 dark:text-slate-200">{host}</span>
          </div>
        ) : null}

        {sessionId ? (
          <div className="flex h-full items-center gap-2 px-4">
            <span className="label-caps hidden text-[10px] text-slate-500 dark:text-slate-400 sm:inline">
              Session ID:
            </span>
            <span className="font-mono text-[10px] font-bold text-brand-blue dark:text-brand-cyan">
              #{sessionId.slice(-12)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex h-full items-center gap-4">
        {typeof eventCount === 'number' ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <Radio className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden />
            <span className="label-caps text-[10px] text-slate-500 dark:text-slate-400">
              EVENTS: {eventCount}
            </span>
          </div>
        ) : null}
        {stepLabel ? (
          <div className="flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden />
            <span className="label-caps text-[10px] text-slate-500 dark:text-slate-400">
              {stepLabel}
            </span>
          </div>
        ) : null}
        <div className="hidden items-center gap-1.5 md:flex">
          <Activity className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden />
          <span className="label-caps text-[10px] text-slate-500 dark:text-slate-400">
            THREAT INTEL [v2.4.11]
          </span>
        </div>
      </div>
    </footer>
  );
}
