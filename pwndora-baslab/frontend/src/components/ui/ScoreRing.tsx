import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';

import { cn } from '@/lib/cn';

interface ScoreRingProps {
  /** 0–100. */
  value: number;
  label?: string;
  suffix?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function ringColor(value: number): string {
  if (value >= 75) return '#10b981';
  if (value >= 40) return '#f59e0b';
  return '#ef4444';
}

/** SVG circular progress with an animated stroke and a counting-up number. */
export function ScoreRing({
  value,
  label,
  suffix = '',
  size = 148,
  strokeWidth = 10,
  className,
}: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = ringColor(clamped);

  const progress = useMotionValue(0);
  const dashOffset = useTransform(progress, (p) => circumference * (1 - p / 100));
  const display = useTransform(progress, (p) => p.toFixed(clamped % 1 === 0 ? 0 : 2));

  useEffect(() => {
    const controls = animate(progress, clamped, { duration: 1.1, ease: 'easeOut' });
    return () => controls.stop();
  }, [clamped, progress]);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label ?? 'Score'}: ${clamped}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.15)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset, filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-0.5">
          <motion.span className="text-3xl font-bold tabular-nums" style={{ color }}>
            {display}
          </motion.span>
          {suffix ? (
            <span className="text-sm font-semibold" style={{ color }}>
              {suffix}
            </span>
          ) : null}
        </div>
        {label ? <span className="mt-1 section-label">{label}</span> : null}
      </div>
    </div>
  );
}
