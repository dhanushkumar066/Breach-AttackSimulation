import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, CloudCog, Radio, Shield, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TopNav } from '@/components/layout/TopNav';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { TiltCard } from '@/components/ui/TiltCard';
import { cn } from '@/lib/cn';
import { useBASLabStore } from '@/store/useBASLabStore';
import type { Difficulty, PlaybookMeta } from '@/types/baslab';

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Easy: 'text-emerald-600 dark:text-emerald-400 bg-emerald-600/10 dark:bg-emerald-400/10 border-emerald-600/20 dark:border-emerald-400/20',
  Moderate:
    'text-emerald-600 dark:text-emerald-400 bg-emerald-600/10 dark:bg-emerald-400/10 border-emerald-600/20 dark:border-emerald-400/20',
  Hard: 'text-orange-500 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-400/10 border-orange-500/20 dark:border-orange-400/20',
};

const DIFFICULTY_DOT: Record<Difficulty, string> = {
  Easy: 'bg-emerald-600 dark:bg-emerald-400',
  Moderate: 'bg-emerald-600 dark:bg-emerald-400',
  Hard: 'bg-orange-500 dark:bg-orange-400',
};

/** A distinct glyph per campaign so the three cards are separable at a glance. */
const PLAYBOOK_ICON: Record<string, typeof Shield> = {
  'pb-apt29-midnight-strike': Shield,
  'pb-lockbit-killchain': ShieldAlert,
  'pb-silent-web-breach': CloudCog,
};

function PlaybookCard({
  playbook,
  index,
  recommended,
  starting,
  onStart,
}: {
  playbook: PlaybookMeta;
  index: number;
  recommended: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  const Icon = PLAYBOOK_ICON[playbook.playbook_id] ?? Shield;

  return (
    <motion.div
      className="h-full"
      initial={{ y: 18, scale: 0.98 }}
      animate={{ y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.15 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
    <TiltCard
      className="h-full"
      innerClassName={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl p-8 transition-all duration-500',
        'backdrop-blur-xl',
        recommended
          ? 'border-2 border-brand-blue/40 bg-white/90 shadow-xl shadow-brand-blue/10 hover:border-brand-blue dark:border-brand-cyan/40 dark:bg-slate-900/60 dark:shadow-none lg:-translate-y-4 card-glow-cyan'
          : 'border border-slate-200 bg-white/80 shadow-xl shadow-slate-200/50 hover:border-brand-blue/50 dark:border-white/10 dark:bg-slate-900/40 dark:shadow-none dark:hover:border-brand-cyan/50',
      )}
    >
      {recommended ? (
        <div className="absolute right-0 top-0 z-20 p-4">
          <div className="rounded-bl-xl rounded-tr-xl bg-brand-blue px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg dark:bg-brand-cyan dark:text-slate-900">
            Recommended
          </div>
        </div>
      ) : null}

      <div className={cn('relative z-20 mb-8 flex items-start justify-between', recommended && 'pt-4')}>
        <div
          className={cn(
            'rounded-xl border p-3 transition-colors',
            recommended
              ? 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue dark:border-brand-cyan/40 dark:bg-brand-cyan/20 dark:text-brand-cyan'
              : 'border-slate-200 bg-slate-100 text-slate-400 group-hover:bg-brand-blue/20 group-hover:text-brand-blue dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:group-hover:bg-brand-cyan/20 dark:group-hover:text-brand-cyan',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>

        <span
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em]',
            DIFFICULTY_STYLE[playbook.difficulty],
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              DIFFICULTY_DOT[playbook.difficulty],
              recommended && 'animate-pulse-glow',
            )}
          />
          {playbook.difficulty}
        </span>
      </div>

      <h3 className="relative z-20 mb-4 text-2xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-brand-blue dark:text-white dark:group-hover:text-brand-cyan">
        {playbook.name}
      </h3>

      <p className="relative z-20 mb-8 flex-grow text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {playbook.description}
      </p>

      <div className="relative z-20 mb-8 space-y-6">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Primary Tactics
          </p>
          <div className="flex flex-wrap gap-2">
            {playbook.tactics.slice(0, 4).map((tactic) => (
              <span
                key={tactic}
                className={cn(
                  'rounded-lg border px-3 py-1.5 font-mono text-[11px]',
                  recommended
                    ? 'border-brand-blue/30 bg-brand-blue/10 font-bold text-brand-blue dark:border-brand-cyan/30 dark:bg-brand-cyan/10 dark:text-brand-cyan'
                    : 'border-slate-200 bg-slate-50 text-brand-blue dark:border-white/5 dark:bg-white/5 dark:text-brand-cyan',
                )}
              >
                {tactic}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Techniques
          </span>
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
            {playbook.technique_count} techniques
          </span>
        </div>
      </div>

      <div className="relative z-20 mt-auto border-t border-slate-200 pt-8 dark:border-white/5">
        <MagneticButton
          onClick={onStart}
          disabled={starting}
          className={cn(
            'flex w-full items-center justify-center gap-3 rounded-xl py-4 text-[11px] font-bold uppercase tracking-widest transition-all duration-300',
            'disabled:cursor-not-allowed disabled:opacity-60',
            recommended
              ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30 hover:brightness-110 dark:bg-brand-cyan dark:text-slate-900'
              : 'border border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white dark:border-brand-cyan dark:text-brand-cyan dark:hover:bg-brand-cyan dark:hover:text-slate-900',
          )}
        >
          {starting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Initializing…
            </>
          ) : (
            <>
              Start Simulation
              {recommended ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
            </>
          )}
        </MagneticButton>
      </div>
    </TiltCard>
    </motion.div>
  );
}

export function PlaybookSelector() {
  const navigate = useNavigate();
  const playbooks = useBASLabStore((s) => s.playbooks);
  const loading = useBASLabStore((s) => s.playbooksLoading);
  const error = useBASLabStore((s) => s.error);
  const stepStatus = useBASLabStore((s) => s.stepStatus);
  const selectedPlaybookId = useBASLabStore((s) => s.selectedPlaybookId);
  const loadPlaybooks = useBASLabStore((s) => s.loadPlaybooks);
  const loadMitreTechniques = useBASLabStore((s) => s.loadMitreTechniques);
  const startSession = useBASLabStore((s) => s.startSession);
  const resetSession = useBASLabStore((s) => s.resetSession);

  useEffect(() => {
    resetSession();
    void loadPlaybooks();
    void loadMitreTechniques();
  }, [loadPlaybooks, loadMitreTechniques, resetSession]);

  async function launch(playbookId: string) {
    const started = await startSession(playbookId);
    if (started) navigate('/session');
  }

  // The middle card carries the recommendation, matching the reference layout.
  const recommendedIndex = playbooks.length > 1 ? 1 : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mesh-gradient" />
      <div className="cyber-grid" />

      <TopNav active="Playbooks" />
      <Sidebar active="Playbooks" />

      <main className="flex-grow px-4 pb-16 pt-32 lg:pl-72 lg:pr-8">
        <motion.header
          className="mb-12 max-w-6xl"
          initial={{ y: 18 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="h-[2px] w-12 bg-brand-blue dark:bg-brand-cyan" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-brand-blue dark:text-brand-cyan">
              Simulation Selection
            </span>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Select a Breach Playbook
          </h1>
          <p className="max-w-2xl text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-400">
            Choose a validated threat profile to begin your blue-team detection training. Each
            playbook simulates real-world adversary behavior mapped to the MITRE ATT&amp;CK
            framework.
          </p>
        </motion.header>

        {error ? (
          <div className="mb-8 flex max-w-3xl items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" aria-hidden />
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <section className="grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white/60 dark:border-white/10 dark:bg-slate-900/40"
              />
            ))}
          </section>
        ) : (
          <section className="grid max-w-7xl grid-cols-1 items-stretch gap-8 md:grid-cols-2 xl:grid-cols-3">
            {playbooks.map((playbook, index) => (
              <PlaybookCard
                key={playbook.playbook_id}
                playbook={playbook}
                index={index}
                recommended={index === recommendedIndex}
                starting={stepStatus === 'loading' && selectedPlaybookId === playbook.playbook_id}
                onStart={() => void launch(playbook.playbook_id)}
              />
            ))}
          </section>
        )}

        <p className="mt-12 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-600">
          <Radio className="h-3 w-3" aria-hidden />
          Track T-03 EPME · Problem Statement BSCDS26-EPME-02 · BrewingSec CyberDev Summit 2026
        </p>
      </main>

      <div className="lg:pl-64">
        <StatusBar connected={!error} stepLabel={`${playbooks.length} PLAYBOOKS LOADED`} />
      </div>
    </div>
  );
}
