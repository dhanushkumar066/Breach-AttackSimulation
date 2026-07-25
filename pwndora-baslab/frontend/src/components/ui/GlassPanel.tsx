import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type GlassTone = 'default' | 'amber' | 'success' | 'danger';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  tone?: GlassTone;
  children: ReactNode;
}

const toneClass: Record<GlassTone, string> = {
  default: '',
  amber: 'glass-panel-amber',
  success: 'glass-panel-success',
  danger: 'glass-panel-danger',
};

/** The standard glassmorphism container used by every surface in the app. */
export function GlassPanel({ tone = 'default', className, children, ...rest }: GlassPanelProps) {
  return (
    <div className={cn('glass-panel', toneClass[tone], className)} {...rest}>
      {children}
    </div>
  );
}
