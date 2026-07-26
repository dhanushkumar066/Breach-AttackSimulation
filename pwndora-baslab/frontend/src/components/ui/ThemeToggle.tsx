import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/theme';

/** Theme switch. Shows the icon of the theme it will switch *to*. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const goingDark = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={goingDark ? 'Switch to dark theme' : 'Switch to light theme'}
      title={goingDark ? 'Switch to dark theme' : 'Switch to light theme'}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-300',
        'border-slate-200 bg-slate-100 text-slate-600 hover:border-brand-blue/40 hover:text-brand-blue',
        'dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-brand-cyan/40 dark:hover:text-brand-cyan',
        'active:scale-95',
        className,
      )}
    >
      {goingDark ? <Moon className="h-5 w-5" aria-hidden /> : <Sun className="h-5 w-5" aria-hidden />}
    </button>
  );
}
