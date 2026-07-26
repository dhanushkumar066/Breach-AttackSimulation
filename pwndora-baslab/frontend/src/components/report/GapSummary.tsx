import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { TacticBadge } from '@/components/ui/CyberBadge';
import type { ControlGap } from '@/types/baslab';

/** Control gaps with the remediation each one calls for. */
export function GapSummary({ gaps }: { gaps: ControlGap[] }) {
  if (gaps.length === 0) {
    return (
      <GlassPanel tone="success" className="flex items-center gap-3 p-5">
        <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-400" aria-hidden />
        <div>
          <h3 className="text-sm font-bold text-emerald-300">No control gaps identified</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Every technique in this playbook was detected with an effective response. Re-run a
            harder playbook to keep pressure-testing your coverage.
          </p>
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-3">
      {gaps.map((gap, index) => (
        <motion.div
          key={`${gap.technique_id}-${index}`}
          initial={{ y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.06 }}
        >
          <GlassPanel tone="danger" className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <span className="log-mono text-sm font-bold text-red-300">{gap.technique_id}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{gap.technique_name}</span>
              <TacticBadge tactic={gap.tactic} />
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="section-label mr-1.5">Gap</span>
              {gap.gap_reason}
            </p>

            <div className="mt-3 flex items-start gap-2 rounded-md border border-cyan-500/25 bg-cyan-500/8 px-3 py-2">
              <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden />
              <p className="text-xs leading-relaxed text-cyan-100">{gap.recommended_control}</p>
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              Detection content: <span className="text-slate-600 dark:text-slate-400">{gap.sigma_rule_title}</span>
            </p>
          </GlassPanel>
        </motion.div>
      ))}
    </div>
  );
}
