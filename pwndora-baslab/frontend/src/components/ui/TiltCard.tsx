import { useCallback, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Maximum rotation in degrees at the card's edge. */
  maxTilt?: number;
  style?: React.CSSProperties;
}

/**
 * Pointer-tracking 3D tilt with a specular highlight.
 *
 * Values are written straight to CSS custom properties rather than React state,
 * so pointer movement never triggers a re-render. Coarse pointers (touch) and
 * reduced-motion users get a flat card.
 */
export function TiltCard({
  children,
  className,
  innerClassName,
  maxTilt = 5,
  style,
}: TiltCardProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const inner = innerRef.current;
      if (!inner) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rx = ((y - rect.height / 2) / (rect.height / 2)) * -maxTilt;
      const ry = ((x - rect.width / 2) / (rect.width / 2)) * maxTilt;

      inner.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      inner.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      inner.style.setProperty('--mx', `${((x / rect.width) * 100).toFixed(1)}%`);
      inner.style.setProperty('--my', `${((y / rect.height) * 100).toFixed(1)}%`);
    },
    [maxTilt],
  );

  const onLeave = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.setProperty('--rx', '0deg');
    inner.style.setProperty('--ry', '0deg');
  }, []);

  return (
    <div className={cn('tilt-card', className)} style={style} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={innerRef} className={cn('tilt-card-inner', innerClassName)}>
        <div className="specular-highlight" />
        {children}
      </div>
    </div>
  );
}
