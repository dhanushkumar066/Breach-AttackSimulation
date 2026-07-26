import { useCallback, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** How far the button drifts toward the cursor, as a fraction of the offset. */
  strength?: number;
}

/**
 * Button that drifts toward the pointer. The transform is written directly to the
 * node, so tracking the cursor costs no renders. Disabled for coarse pointers and
 * reduced-motion users.
 */
export function MagneticButton({
  children,
  className,
  strength = 0.25,
  ...rest
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const node = ref.current;
      if (!node) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      node.style.transform = `translate3d(${(x * strength).toFixed(1)}px, ${(y * strength).toFixed(1)}px, 0)`;
    },
    [strength],
  );

  const onLeave = useCallback(() => {
    const node = ref.current;
    if (node) node.style.transform = 'translate3d(0, 0, 0)';
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn('btn-magnetic', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
