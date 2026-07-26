import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'border-brand-blue bg-brand-blue text-white hover:brightness-110 dark:border-cyan-400/50 dark:bg-cyan-500/15 dark:text-cyan-100 dark:hover:bg-cyan-500/25 dark:hover:shadow-glow-cyan',
  secondary:
    'border-amber-400/50 bg-amber-500/12 text-amber-100 hover:bg-amber-500/22 hover:shadow-glow-amber',
  danger: 'border-red-400/50 bg-red-500/12 text-red-100 hover:bg-red-500/22 hover:shadow-glow-red',
  ghost:
    'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-600/60 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-700/50',
};

export function GlowButton({
  variant = 'primary',
  loading = false,
  icon,
  className,
  disabled,
  children,
  ...rest
}: GlowButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5',
        'text-sm font-semibold tracking-wide transition-all duration-200',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
