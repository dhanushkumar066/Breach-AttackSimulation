import { motion } from 'framer-motion';
import { AlertCircle, Layers, Play, Radar, ShieldHalf, Target } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { DifficultyBadge, TacticBadge } from '@/components/ui/CyberBadge';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GlowButton } from '@/components/ui/GlowButton';
import { useBASLabStore } from '@/store/useBASLabStore';

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

  return (
    <div className="relative min-h-screen grid-noise">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-10 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/8 px-4 py-1.5">
            <Radar className="h-4 w-4 animate-pulse-glow text-cyan-400" aria-hidden />
            <span className="text-xs font-semibold tracking-[0.2em] text-cyan-300">
              BLACKPERL DFIR · PWNDORA
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
            BAS<span className="text-cyan-400 text-glow-cyan">Lab</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            Breach &amp; Attack Simulation training. Each playbook replays a real adversary kill
            chain one technique at a time. You see only the telemetry — identify the technique,
            pick out the true indicators, and choose the right containment action.
          </p>
        </motion.header>

        {error ? (
          <GlassPanel tone="danger" className="mb-6 flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
            <p className="text-sm text-red-200">{error}</p>
          </GlassPanel>
        ) : null}

        {loading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <GlassPanel key={i} className="h-72 animate-pulse p-6">
                <div className="h-4 w-1/2 rounded bg-slate-700/50" />
                <div className="mt-4 h-3 w-full rounded bg-slate-800/60" />
                <div className="mt-2 h-3 w-4/5 rounded bg-slate-800/60" />
              </GlassPanel>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {playbooks.map((playbook, index) => (
              <motion.div
                key={playbook.playbook_id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="h-full"
              >
                <GlassPanel className="flex h-full flex-col p-5 transition-shadow hover:shadow-glow-cyan">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                      <span className="text-xs font-bold tracking-wider text-amber-300">
                        {playbook.threat_actor}
                      </span>
                    </div>
                    <DifficultyBadge difficulty={playbook.difficulty} />
                  </div>

                  <h2 className="text-lg font-bold leading-snug text-slate-50">{playbook.name}</h2>

                  <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">
                    {playbook.description}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                    <Layers className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
                    <span className="font-semibold text-slate-200">{playbook.technique_count}</span>
                    techniques
                    <ShieldHalf className="ml-2 h-3.5 w-3.5 text-cyan-400" aria-hidden />
                    <span className="font-semibold text-slate-200">{playbook.tactics.length}</span>
                    tactics
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {playbook.tactics.map((tactic) => (
                      <TacticBadge key={tactic} tactic={tactic} />
                    ))}
                  </div>

                  <GlowButton
                    className="mt-5 w-full"
                    onClick={() => void launch(playbook.playbook_id)}
                    loading={stepStatus === 'loading' && selectedPlaybookId === playbook.playbook_id}
                    icon={<Play className="h-4 w-4" aria-hidden />}
                  >
                    Start Simulation
                  </GlowButton>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-[11px] text-slate-600">
          Track T-03 EPME · Problem Statement BSCDS26-EPME-02 · BrewingSec CyberDev Summit 2026
        </footer>
      </div>
    </div>
  );
}
