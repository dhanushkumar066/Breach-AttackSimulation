import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getHealth } from '@/api/client';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';
import { PROJECT, TEAM, type TeamMember } from '@/data/team';

function MemberCard({ member, index }: { member: TeamMember; index: number }) {
  const connectClasses =
    'mt-auto flex w-full items-center justify-center gap-2 rounded-xl border py-3 label-caps transition-colors';

  return (
    <motion.div
      initial={{ y: 18 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <div className="glass-card group flex h-full flex-col items-center p-8 text-center">
        <div className="cyan-ring mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/10 dark:bg-brand-cyan/10">
          <span className="text-lg font-bold text-brand-blue dark:text-brand-cyan">
            {member.initials}
          </span>
        </div>

        <h3 className="mb-1 text-lg font-medium text-slate-900 dark:text-white">{member.name}</h3>
        <p className="label-caps mb-4 text-brand-blue dark:text-brand-cyan">{member.role}</p>
        <p className="mb-8 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {member.blurb}
        </p>

        {member.profileUrl ? (
          <a
            href={member.profileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              connectClasses,
              'border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10',
              'dark:border-brand-cyan/30 dark:text-brand-cyan dark:hover:bg-brand-cyan/10',
            )}
          >
            CONNECT
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="Add this member's profile URL in src/data/team.ts to enable the link"
            className={cn(
              connectClasses,
              'cursor-not-allowed border-slate-300 text-slate-400 opacity-70',
              'dark:border-white/10 dark:text-slate-500',
            )}
          >
            CONNECT
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** Executive welcome — the front door to the module. */
export function WelcomePage() {
  const navigate = useNavigate();
  const [online, setOnline] = useState<boolean | null>(null);

  // The ONLINE pip reflects a real API probe rather than a decorative constant.
  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => {
        if (!cancelled) setOnline(true);
      })
      .catch(() => {
        if (!cancelled) setOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col p-6 sm:p-10 xl:p-14">
      <div className="slide-grid" />
      {/* Soft cyan blooms, matching the reference lighting. */}
      <div className="pointer-events-none fixed right-0 top-0 -z-10 h-1/3 w-1/3 rounded-full bg-brand-cyan/5 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-1/4 w-1/4 rounded-full bg-brand-cyan/5 blur-[100px]" />

      {/* Header */}
      <header className="z-10 mb-auto flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-2 bg-brand-blue shadow-[0_0_15px_rgba(2,132,199,0.6)] dark:bg-brand-cyan dark:shadow-[0_0_15px_rgba(0,219,231,0.6)]" />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            PWNDORA <span className="text-brand-blue dark:text-brand-cyan">BASLab</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-slate-200 bg-white/60 px-4 py-1.5 backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:block">
            <span className="label-caps text-slate-500 dark:text-slate-400">
              SLIDE 01 // EXECUTIVE WELCOME
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="z-10 mx-auto mb-16 flex max-w-5xl flex-col items-center py-14 text-center">
        <motion.span
          initial={{ y: -10 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="neon-glow label-caps mb-6 tracking-[0.3em] text-brand-blue dark:text-brand-cyan"
        >
          — WELCOME TO BASLAB // {PROJECT.codename.toUpperCase()}
        </motion.span>

        <motion.h1
          initial={{ y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 text-4xl font-bold leading-[1.1] tracking-tighter text-slate-900 dark:text-white sm:text-5xl xl:text-[64px]"
        >
          Breach &amp; Attack
          <br />
          <span className="text-brand-blue dark:text-brand-cyan">Simulation Engine</span>
        </motion.h1>

        <p className="max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400">
          Revolutionizing enterprise resilience through continuous, automated adversarial emulation.
          PWNDORA orchestrates sophisticated threat landscapes to validate detection integrity and
          fortify systemic defenses in real-time.
        </p>

        <motion.button
          type="button"
          onClick={() => navigate('/playbooks')}
          initial={{ y: 12 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="interaction-scale group mt-10 flex items-center gap-3 rounded-xl bg-brand-blue px-8 py-4 label-caps text-base tracking-widest text-white shadow-[0_4px_20px_rgba(2,132,199,0.35)] transition-all hover:brightness-110 dark:bg-brand-cyan dark:text-slate-900 dark:shadow-[0_4px_20px_rgba(6,182,212,0.35)]"
        >
          ENTER THE LAB
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
        </motion.button>
      </main>

      {/* Team */}
      <section className="z-10 mb-auto grid w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TEAM.map((member, index) => (
          <MemberCard key={member.name} member={member} index={index} />
        ))}
      </section>

      {/* Footer */}
      <footer className="z-10 mt-auto flex w-full flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8 dark:border-white/5">
        <div className="flex items-center gap-4">
          <span className="label-caps text-slate-400 dark:text-slate-500">
            {PROJECT.department.toUpperCase()}
          </span>
          <span className="text-slate-300 dark:text-white/10">●</span>
          <span className="label-caps text-brand-blue dark:text-brand-cyan">
            {PROJECT.codename.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <span className="font-mono text-sm text-slate-400 dark:text-slate-500">
            {PROJECT.problemStatement}
          </span>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                online === false
                  ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                  : 'bg-emerald-400 shadow-[0_0_8px_#4edea3]',
                online === null && 'animate-pulse-glow',
              )}
            />
            <span
              className={cn(
                'label-caps',
                online === false ? 'text-red-500' : 'text-emerald-500 dark:text-emerald-400',
              )}
            >
              {online === false ? 'OFFLINE' : online === null ? 'CONNECTING' : 'ONLINE'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
