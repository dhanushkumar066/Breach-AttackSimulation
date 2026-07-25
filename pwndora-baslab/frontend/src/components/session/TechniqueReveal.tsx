import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';

import { TacticBadge } from '@/components/ui/CyberBadge';
import type { StepResult } from '@/types/baslab';

/**
 * The moment of reveal: the technique that was hidden throughout the step slides
 * in once the learner has committed to an answer.
 */
export function TechniqueReveal({ result }: { result: StepResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
      className="rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-transparent px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Crosshair className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
        <span className="section-label">Technique revealed</span>
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="log-mono text-base font-bold text-cyan-300 text-glow-cyan"
        >
          {result.technique_id}
        </motion.span>
        <span className="text-base font-semibold text-slate-100">{result.technique_name}</span>
        <TacticBadge tactic={result.tactic} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{result.technique_description}</p>
    </motion.div>
  );
}
