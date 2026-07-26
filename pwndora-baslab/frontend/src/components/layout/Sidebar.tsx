import { LayoutDashboard, Settings, Shield, Terminal } from 'lucide-react';

import { cn } from '@/lib/cn';

const ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Playbooks', icon: Shield },
  { label: 'Simulations', icon: Terminal },
  { label: 'Settings', icon: Settings },
] as const;

/**
 * Rail navigation for the library screens.
 *
 * As with the top nav, only the active entry is a real destination inside this
 * module; the rest belong to the surrounding PWNDORA shell and are inert here.
 */
export function Sidebar({ active = 'Playbooks' }: { active?: string }) {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 flex-col border-r border-slate-200 bg-white pt-24 transition-colors duration-300 dark:border-white/5 dark:bg-transparent lg:flex">
      <nav className="flex flex-col gap-1 px-4">
        {ITEMS.map(({ label, icon: Icon }) => {
          const isActive = label === active;
          return (
            <div
              key={label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-4 rounded-xl px-4 py-3 text-sm transition-all',
                isActive
                  ? 'border border-brand-blue/20 bg-brand-blue/10 text-brand-blue backdrop-blur-md dark:border-brand-cyan/20 dark:bg-brand-cyan/10 dark:text-brand-cyan'
                  : 'cursor-default text-slate-400 dark:text-slate-500',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
