import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, FileCode2 } from 'lucide-react';
import { useState } from 'react';

import { SigmaViewer } from '@/components/ui/SigmaViewer';
import { cn } from '@/lib/cn';
import type { SigmaRecommendation } from '@/types/baslab';

/** Expandable list of Sigma rules to deploy, gaps first. */
export function SigmaRecommendations({ rules }: { rules: SigmaRecommendation[] }) {
  const [openId, setOpenId] = useState<string | null>(rules[0]?.technique_id ?? null);

  if (rules.length === 0) {
    return <p className="text-xs text-slate-500">No Sigma content to recommend for this run.</p>;
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => {
        const open = openId === rule.technique_id;
        return (
          <div
            key={rule.technique_id}
            className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/40"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : rule.technique_id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
            >
              <FileCode2 className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
              <span className="log-mono text-xs font-bold text-cyan-300">{rule.technique_id}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{rule.title}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200',
                  open && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <div className="px-3 pb-3">
                    <SigmaViewer yaml={rule.sigma_yaml} title={rule.title} maxHeight={360} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
