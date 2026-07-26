import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileBarChart,
  GraduationCap,
  Lightbulb,
  X,
} from 'lucide-react';

import { TechniqueReveal } from '@/components/session/TechniqueReveal';
import { GlassPanel, type GlassTone } from '@/components/ui/GlassPanel';
import { GlowButton } from '@/components/ui/GlowButton';
import { SigmaViewer } from '@/components/ui/SigmaViewer';
import { cn } from '@/lib/cn';
import type { StepResult } from '@/types/baslab';

interface StepFeedbackProps {
  result: StepResult | null;
  visible: boolean;
  isFinalStep: boolean;
  advancing: boolean;
  onAdvance: () => void;
}

function toneFor(score: number): GlassTone {
  if (score >= 0.75) return 'success';
  if (score > 0) return 'amber';
  return 'danger';
}

function PartRow({
  label,
  state,
  detail,
  points,
}: {
  label: string;
  state: 'correct' | 'partial' | 'wrong';
  detail: string;
  points: number;
}) {
  const config = {
    correct: { icon: Check, cls: 'text-emerald-400', border: 'border-emerald-500/35 bg-emerald-500/8' },
    partial: { icon: AlertTriangle, cls: 'text-amber-400', border: 'border-amber-500/35 bg-amber-500/8' },
    wrong: { icon: X, cls: 'text-red-400', border: 'border-red-500/35 bg-red-500/8' },
  }[state];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5', config.border)}>
      <Icon className={cn('h-4 w-4 shrink-0', config.cls)} aria-hidden />
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</span>
      <span className="text-xs text-slate-600 dark:text-slate-400">{detail}</span>
      <span className={cn('ml-auto log-mono text-sm font-bold tabular-nums', config.cls)}>
        +{points.toFixed(1)} pts
      </span>
    </div>
  );
}

/** Animated per-step verdict: score breakdown, missed evidence and the Sigma rule. */
export function StepFeedback({
  result,
  visible,
  isFinalStep,
  advancing,
  onAdvance,
}: StepFeedbackProps) {
  return (
    <AnimatePresence>
      {visible && result ? (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Step result"
        >
          <motion.div
            initial={{ y: 60, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="w-full max-w-3xl"
          >
            <GlassPanel
              tone={toneFor(result.step_score)}
              className="max-h-[92vh] overflow-y-auto p-5 sm:p-6"
            >
              <TechniqueReveal result={result} />

              <div className="mt-4 space-y-2">
                <PartRow
                  label="Technique"
                  state={result.technique_correct ? 'correct' : 'wrong'}
                  detail={
                    result.technique_correct
                      ? 'Classified correctly'
                      : `You submitted ${result.learner_technique_id}`
                  }
                  points={result.weighted_breakdown.technique_contribution * 100}
                />
                <PartRow
                  label="Indicators"
                  state={
                    result.indicator_jaccard >= 1
                      ? 'correct'
                      : result.indicator_jaccard > 0
                        ? 'partial'
                        : 'wrong'
                  }
                  detail={`Jaccard ${result.indicator_jaccard.toFixed(4)} · ${result.matched_indicators.length}/${result.correct_indicators.length} matched${
                    result.false_positive_indicators.length > 0
                      ? ` · ${result.false_positive_indicators.length} false positive${result.false_positive_indicators.length === 1 ? '' : 's'}`
                      : ''
                  }`}
                  points={result.weighted_breakdown.indicator_contribution * 100}
                />
                <PartRow
                  label="Response"
                  state={result.response_correct ? 'correct' : 'wrong'}
                  detail={
                    result.response_correct
                      ? result.correct_response_action
                      : `You chose ${result.learner_response_action}; correct was ${result.correct_response_action}`
                  }
                  points={result.weighted_breakdown.response_contribution * 100}
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-600/50 bg-slate-900/60 px-4 py-3">
                <span className="section-label">Step score</span>
                <motion.span
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="log-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100"
                >
                  {(result.step_score * 100).toFixed(1)}
                  <span className="text-base text-slate-500"> / 100</span>
                </motion.span>
              </div>

              {result.coaching ? (
                <motion.div
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-5"
                >
                  <h4 className="section-label mb-2 flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
                    Detection coach
                  </h4>
                  <div className="space-y-2">
                    {result.coaching.notes.map((note) => {
                      const style = {
                        correct: {
                          icon: Check,
                          box: 'border-emerald-500/30 bg-emerald-500/8',
                          chip: 'text-emerald-300',
                        },
                        partial: {
                          icon: AlertTriangle,
                          box: 'border-amber-500/30 bg-amber-500/8',
                          chip: 'text-amber-300',
                        },
                        error: { icon: X, box: 'border-red-500/30 bg-red-500/8', chip: 'text-red-300' },
                      }[note.severity];
                      const NoteIcon = style.icon;
                      return (
                        <div
                          key={note.part}
                          className={cn('rounded-lg border px-3 py-2.5', style.box)}
                        >
                          <div className="flex items-start gap-2">
                            <NoteIcon
                              className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', style.chip)}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <span
                                className={cn(
                                  'mr-2 text-[10px] font-bold uppercase tracking-wider',
                                  style.chip,
                                )}
                              >
                                {note.part}
                              </span>
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {note.headline}
                              </span>
                              <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                {note.why}
                              </p>
                              <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                <Lightbulb
                                  className="mt-0.5 h-3 w-3 shrink-0 text-amber-400"
                                  aria-hidden
                                />
                                <span>{note.fix}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {result.coaching.takeaway ? (
                    <div className="mt-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/8 px-3 py-2.5">
                      <span className="section-label text-cyan-300">
                        Take this into the next stage
                      </span>
                      <p className="mt-1 text-xs leading-relaxed text-cyan-100">
                        {result.coaching.takeaway}
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              ) : null}

              <div className="mt-5">
                <h4 className="section-label mb-2">What you should have detected</h4>
                <ul className="space-y-1.5">
                  {result.correct_indicators.map((indicator) => {
                    const matched = result.matched_indicators.includes(indicator);
                    return (
                      <li
                        key={indicator}
                        className={cn(
                          'flex items-start gap-2 rounded-md border px-3 py-2 log-mono text-xs',
                          matched
                            ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-200'
                            : 'border-red-500/30 bg-red-500/8 text-red-200',
                        )}
                      >
                        {matched ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        <span>
                          {indicator}
                          {matched ? '' : '  (you missed this)'}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {result.false_positive_indicators.length > 0 ? (
                  <>
                    <h4 className="section-label mb-2 mt-4">Red herrings you selected</h4>
                    <ul className="space-y-1.5">
                      {result.false_positive_indicators.map((indicator) => (
                        <li
                          key={indicator}
                          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 log-mono text-xs text-amber-200"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{indicator}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>

              <div className="mt-5">
                <h4 className="section-label mb-2">Sigma rule that catches this</h4>
                <SigmaViewer yaml={result.sigma_rule_yaml} title={result.sigma_rule_title} maxHeight={300} />
              </div>

              <div className="mt-5 flex justify-end">
                <GlowButton
                  onClick={onAdvance}
                  loading={advancing}
                  variant={isFinalStep ? 'secondary' : 'primary'}
                  icon={
                    isFinalStep ? (
                      <FileBarChart className="h-4 w-4" aria-hidden />
                    ) : (
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    )
                  }
                >
                  {isFinalStep ? 'View Control Effectiveness Report' : 'Advance to Next Technique'}
                </GlowButton>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
