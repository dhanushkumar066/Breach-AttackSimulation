import { Check, X } from 'lucide-react';

import { ControlStatusBadge, TacticBadge } from '@/components/ui/CyberBadge';
import { cn } from '@/lib/cn';
import type { TechniqueResult } from '@/types/baslab';

function scoreColor(score: number): string {
  if (score >= 0.75) return 'text-emerald-300';
  if (score > 0) return 'text-amber-300';
  return 'text-red-300';
}

/** One kill-chain step as a row of the report table. */
export function TechniqueResultRow({ result }: { result: TechniqueResult }) {
  return (
    <tr className="border-b border-slate-800/70 transition-colors hover:bg-slate-800/30">
      <td className="px-3 py-3 text-center log-mono text-xs text-slate-500">{result.step}</td>
      <td className="px-3 py-3">
        <div className="log-mono text-sm font-semibold text-cyan-300">{result.technique_id}</div>
        <div className="text-xs text-slate-300">{result.technique_name}</div>
        {!result.detected ? (
          <div className="mt-1 log-mono text-[11px] text-red-400">
            you answered {result.learner_technique_id}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <TacticBadge tactic={result.tactic} />
      </td>
      <td className="px-3 py-3 text-center">
        {result.detected ? (
          <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="detected" />
        ) : (
          <X className="mx-auto h-4 w-4 text-red-400" aria-label="missed" />
        )}
      </td>
      <td className="px-3 py-3 text-center log-mono text-xs text-slate-300">
        {result.indicator_jaccard.toFixed(4)}
      </td>
      <td className="px-3 py-3 text-center">
        {result.response_correct ? (
          <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="correct response" />
        ) : (
          <X className="mx-auto h-4 w-4 text-red-400" aria-label="incorrect response" />
        )}
      </td>
      <td
        className={cn(
          'px-3 py-3 text-right log-mono text-sm font-bold tabular-nums',
          scoreColor(result.step_score),
        )}
      >
        {(result.step_score * 100).toFixed(1)}
      </td>
      <td className="px-3 py-3 text-center">
        <ControlStatusBadge status={result.control_status} />
      </td>
    </tr>
  );
}
