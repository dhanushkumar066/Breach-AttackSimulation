import { User } from 'lucide-react';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';

const LINKS = ['Dashboard', 'Playbooks', 'Simulations', 'Settings'] as const;

/**
 * Product chrome for the library screens.
 *
 * Only "Playbooks" is a live destination in this module — the other entries are
 * the surrounding PWNDORA shell's navigation, shown so the module reads as part
 * of the platform. They are rendered as disabled controls rather than links, so
 * nothing invites a click that goes nowhere.
 */
export function TopNav({ active = 'Playbooks' }: { active?: (typeof LINKS)[number] }) {
  return (
    <nav className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-xl transition-colors duration-300 dark:border-white/5 dark:bg-[#05080F]/60 sm:px-8">
      <div className="flex items-center gap-2">
        <span className="border-b-2 border-brand-blue pb-0.5 text-xl font-bold tracking-tight text-slate-900 dark:border-brand-cyan dark:text-white">
          PWNDORA BASLab
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden gap-8 md:flex">
          {LINKS.map((link) => (
            <span
              key={link}
              aria-current={link === active ? 'page' : undefined}
              className={cn(
                'text-[11px] font-bold uppercase tracking-widest',
                link === active
                  ? 'text-brand-blue dark:text-brand-cyan'
                  : 'cursor-default text-slate-400 dark:text-slate-500',
              )}
            >
              {link}
            </span>
          ))}
        </div>

        <div className="hidden h-4 w-px bg-slate-200 dark:bg-white/10 md:block" />

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 sm:inline">
              Analyst: <span className="text-brand-blue dark:text-brand-cyan">Guest</span>
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 bg-brand-blue/10 text-brand-blue dark:border-brand-cyan/20 dark:bg-brand-cyan/10 dark:text-brand-cyan">
              <User className="h-4 w-4" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
