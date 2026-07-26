import { motion } from 'framer-motion';
import {
  AlertCircle,
  Download,
  FileJson,
  Film,
  GitCompareArrows,
  Home,
  RefreshCw,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AttackReplay } from '@/components/report/AttackReplay';
import { GapSummary } from '@/components/report/GapSummary';
import { SigmaRecommendations } from '@/components/report/SigmaRecommendations';
import { TechniqueResultRow } from '@/components/report/TechniqueResultRow';
import { CyberBadge } from '@/components/ui/CyberBadge';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GlowButton } from '@/components/ui/GlowButton';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { getRiskView360Export } from '@/api/client';
import { useBASLabStore } from '@/store/useBASLabStore';

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function ReportPage() {
  const navigate = useNavigate();
  const sessionId = useBASLabStore((s) => s.sessionId);
  const report = useBASLabStore((s) => s.report);
  const reportLoading = useBASLabStore((s) => s.reportLoading);
  const replay = useBASLabStore((s) => s.replay);
  const error = useBASLabStore((s) => s.error);
  const baseSessionId = useBASLabStore((s) => s.baseSessionId);
  const loadReport = useBASLabStore((s) => s.loadReport);
  const loadReplay = useBASLabStore((s) => s.loadReplay);
  const startSession = useBASLabStore((s) => s.startSession);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      navigate('/playbooks', { replace: true });
      return;
    }
    void loadReport();
    void loadReplay();
  }, [sessionId, loadReport, loadReplay, navigate]);

  async function downloadRiskView360() {
    if (!sessionId) return;
    setExporting(true);
    try {
      const payload = await getRiskView360Export(sessionId);
      downloadJson(`riskview360-${sessionId}.json`, payload);
    } finally {
      setExporting(false);
    }
  }

  async function runAgain() {
    if (!report) return;
    const started = await startSession(report.playbook_id, sessionId);
    if (started) navigate('/session');
  }

  if (reportLoading || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <GlassPanel className="p-8 text-center">
          {error ? (
            <>
              <AlertCircle className="mx-auto h-6 w-6 text-red-400" aria-hidden />
              <p className="mt-3 text-sm text-red-200">{error}</p>
              <GlowButton className="mt-4" variant="ghost" onClick={() => navigate('/playbooks')}>
                Back to playbooks
              </GlowButton>
            </>
          ) : (
            <p className="animate-pulse text-sm text-slate-600 dark:text-slate-400">
              Generating Control Effectiveness Report…
            </p>
          )}
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-noise">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="section-label">Control Effectiveness Report</div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">{report.playbook_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <CyberBadge tone="amber">
              <Target className="h-3 w-3" aria-hidden />
              {report.threat_actor}
            </CyberBadge>
            <span className="log-mono">{report.session_id}</span>
            <span className="text-slate-600">·</span>
            <span>{new Date(report.completed_at).toLocaleString()}</span>
          </div>
        </motion.header>

        {/* Stats row */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GlassPanel className="flex items-center justify-center p-5">
            <ScoreRing value={report.session_score} label="Session score" />
          </GlassPanel>
          <GlassPanel className="flex items-center justify-center p-5">
            <ScoreRing value={report.overall_detection_rate} suffix="%" label="Detection rate" />
          </GlassPanel>
          <GlassPanel className="flex flex-col items-center justify-center p-5 text-center">
            <div className="log-mono text-4xl font-bold tabular-nums text-cyan-300">
              {report.techniques_detected}
              <span className="text-2xl text-slate-600">/{report.total_techniques}</span>
            </div>
            <div className="mt-2 section-label">Techniques detected</div>
          </GlassPanel>
          <GlassPanel
            tone={report.security_control_gaps.length > 0 ? 'danger' : 'success'}
            className="flex flex-col items-center justify-center p-5 text-center"
          >
            <div
              className={
                report.security_control_gaps.length > 0
                  ? 'log-mono text-4xl font-bold tabular-nums text-red-300'
                  : 'log-mono text-4xl font-bold tabular-nums text-emerald-300'
              }
            >
              {report.security_control_gaps.length}
            </div>
            <div className="mt-2 section-label">Control gaps</div>
          </GlassPanel>
        </div>

        {/* Actions */}
        <div className="mb-8 flex flex-wrap gap-3">
          <GlowButton
            onClick={() => void downloadRiskView360()}
            loading={exporting}
            icon={<FileJson className="h-4 w-4" aria-hidden />}
          >
            Export RiskView360 JSON
          </GlowButton>
          <GlowButton
            variant="ghost"
            onClick={() => downloadJson(`baslab-report-${report.session_id}.json`, report)}
            icon={<Download className="h-4 w-4" aria-hidden />}
          >
            Download full report
          </GlowButton>
          <GlowButton
            variant="secondary"
            onClick={() => void runAgain()}
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
          >
            Run Again
          </GlowButton>
          {baseSessionId ? (
            <GlowButton
              variant="secondary"
              onClick={() => navigate('/comparison')}
              icon={<GitCompareArrows className="h-4 w-4" aria-hidden />}
            >
              Compare with previous run
            </GlowButton>
          ) : null}
          <GlowButton
            variant="ghost"
            onClick={() => navigate('/playbooks')}
            icon={<Home className="h-4 w-4" aria-hidden />}
          >
            Playbook library
          </GlowButton>
        </div>

        {/* Technique table */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            Technique-by-technique results
          </h2>
          <GlassPanel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700/70 bg-slate-900/50">
                    <th className="px-3 py-2.5 text-center section-label">#</th>
                    <th className="px-3 py-2.5 text-left section-label">Technique</th>
                    <th className="px-3 py-2.5 text-left section-label">Tactic</th>
                    <th className="px-3 py-2.5 text-center section-label">ID</th>
                    <th className="px-3 py-2.5 text-center section-label">Jaccard</th>
                    <th className="px-3 py-2.5 text-center section-label">Response</th>
                    <th className="px-3 py-2.5 text-right section-label">Score</th>
                    <th className="px-3 py-2.5 text-center section-label">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {report.technique_results.map((result) => (
                    <TechniqueResultRow key={`${result.step}-${result.technique_id}`} result={result} />
                  ))}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </section>

        {/* Attack replay */}
        {replay ? (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <Film className="h-5 w-5 text-cyan-400" aria-hidden />
              How the attack unfolded
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              A step-by-step walkthrough rebuilt from the same telemetry you just worked
              through &mdash; process ancestry, cross-process access and host-to-host movement.
              Read-only: nothing here changed your score.
            </p>
            <AttackReplay replay={replay} />
          </section>
        ) : null}

        {/* Gaps */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <ShieldAlert className="h-5 w-5 text-red-400" aria-hidden />
            Security control gaps
          </h2>
          <GapSummary gaps={report.security_control_gaps} />
        </section>

        {/* Sigma */}
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Sigma rules to deploy</h2>
          <SigmaRecommendations rules={report.sigma_recommendations} />
        </section>

        <footer className="border-t border-slate-800 pt-4 text-center text-[11px] text-slate-600">
          RiskView360 compatible · {report.riskview360_export_url}
        </footer>
      </div>
    </div>
  );
}
