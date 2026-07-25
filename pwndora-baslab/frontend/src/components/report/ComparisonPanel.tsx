import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/cn';
import type { ComparisonResult } from '@/types/baslab';

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />↑ +{(delta * 100).toFixed(1)}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-red-300">
        <TrendingDown className="h-3.5 w-3.5" aria-hidden />↓ {(delta * 100).toFixed(1)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-bold text-slate-400">
      <Minus className="h-3.5 w-3.5" aria-hidden />→ 0.0
    </span>
  );
}

/** Side-by-side run comparison with a grouped per-technique bar chart. */
export function ComparisonPanel({ comparison }: { comparison: ComparisonResult }) {
  const chartData = comparison.per_technique_delta.map((d) => ({
    technique: d.technique_id,
    'Run 1': Number((d.run_1_score * 100).toFixed(1)),
    'Run 2': Number((d.run_2_score * 100).toFixed(1)),
  }));

  const improved = comparison.improvement_delta > 0;
  const flat = comparison.improvement_delta === 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassPanel className="p-5 text-center">
          <div className="section-label">Run 1</div>
          <div className="mt-1 log-mono text-3xl font-bold tabular-nums text-slate-200">
            {comparison.run_1_score.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            detection {comparison.run_1_detection_rate.toFixed(2)}%
          </div>
        </GlassPanel>

        <GlassPanel
          tone={flat ? 'default' : improved ? 'success' : 'danger'}
          className="flex flex-col items-center justify-center p-5 text-center"
        >
          <div className="section-label">Improvement</div>
          <div
            className={cn(
              'mt-1 log-mono text-3xl font-bold tabular-nums',
              flat ? 'text-slate-300' : improved ? 'text-emerald-300' : 'text-red-300',
            )}
          >
            {improved ? '+' : ''}
            {comparison.improvement_delta.toFixed(2)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            run 1 <ArrowRight className="h-3 w-3" aria-hidden /> run 2
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 text-center">
          <div className="section-label">Run 2</div>
          <div className="mt-1 log-mono text-3xl font-bold tabular-nums text-cyan-300">
            {comparison.run_2_score.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            detection {comparison.run_2_detection_rate.toFixed(2)}%
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-4 sm:p-5">
        <h3 className="section-label mb-3">Per-technique score, run 1 vs run 2</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
              <XAxis
                dataKey="technique"
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                cursor={{ fill: 'rgba(6,182,212,0.08)' }}
                contentStyle={{
                  background: 'rgba(15,23,42,0.96)',
                  border: '1px solid rgba(6,182,212,0.3)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Run 1" fill="#64748b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Run 2" fill="#06b6d4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-700/70 bg-slate-900/50">
                <th className="px-3 py-2.5 text-left section-label">Technique</th>
                <th className="px-3 py-2.5 text-right section-label">Run 1</th>
                <th className="px-3 py-2.5 text-right section-label">Run 2</th>
                <th className="px-3 py-2.5 text-right section-label">Delta</th>
              </tr>
            </thead>
            <tbody>
              {comparison.per_technique_delta.map((row) => (
                <tr
                  key={row.technique_id}
                  className="border-b border-slate-800/70 transition-colors hover:bg-slate-800/30"
                >
                  <td className="px-3 py-2.5">
                    <span className="log-mono text-xs font-semibold text-cyan-300">
                      {row.technique_id}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{row.technique_name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right log-mono text-xs tabular-nums text-slate-300">
                    {(row.run_1_score * 100).toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right log-mono text-xs tabular-nums text-slate-100">
                    {(row.run_2_score * 100).toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right log-mono text-xs tabular-nums">
                    <DeltaIndicator delta={row.delta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
