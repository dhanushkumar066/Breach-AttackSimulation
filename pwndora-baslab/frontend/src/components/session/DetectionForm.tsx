import {
  Ban,
  BellRing,
  Check,
  CircleSlash,
  FileWarning,
  KeyRound,
  ScanSearch,
  Send,
  ServerCrash,
  Skull,
} from 'lucide-react';
import { useMemo } from 'react';
import Select, { type StylesConfig } from 'react-select';

import { GlowButton } from '@/components/ui/GlowButton';
import { cn } from '@/lib/cn';
import { useBASLabStore } from '@/store/useBASLabStore';

interface TechniqueOption {
  value: string;
  label: string;
  tactic: string;
  name: string;
}

const ACTION_ICONS: Record<string, typeof Ban> = {
  'Isolate Host': ServerCrash,
  'Block IP/Domain': Ban,
  'Kill Process': Skull,
  'Revoke Credentials': KeyRound,
  'Alert SOC Only': BellRing,
  'Quarantine File': FileWarning,
  'No Action Required': CircleSlash,
};

/** react-select has its own DOM, so the glass theme is applied through styles. */
const selectStyles: StylesConfig<TechniqueOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderColor: state.isFocused ? 'rgba(6, 182, 212, 0.65)' : 'rgba(71, 85, 105, 0.6)',
    boxShadow: state.isFocused ? '0 0 0 1px rgba(6, 182, 212, 0.45)' : 'none',
    ':hover': { borderColor: 'rgba(6, 182, 212, 0.5)' },
  }),
  input: (base) => ({ ...base, color: '#f8fafc' }),
  singleValue: (base) => ({ ...base, color: '#f8fafc' }),
  placeholder: (base) => ({ ...base, color: '#64748b' }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    backdropFilter: 'blur(16px)',
  }),
  menuList: (base) => ({ ...base, maxHeight: 280 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'rgba(6, 182, 212, 0.22)'
      : state.isFocused
        ? 'rgba(30, 41, 59, 0.9)'
        : 'transparent',
    color: '#e2e8f0',
    cursor: 'pointer',
  }),
  dropdownIndicator: (base) => ({ ...base, color: '#64748b' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgba(71, 85, 105, 0.5)' }),
  noOptionsMessage: (base) => ({ ...base, color: '#64748b' }),
};

function PartHeading({
  letter,
  title,
  hint,
  done,
}: {
  letter: string;
  title: string;
  hint: string;
  done: boolean;
}) {
  return (
    <div className="mb-2.5 flex items-start gap-2.5">
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold',
          done
            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
            : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : letter}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="text-[11px] leading-snug text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

/** Part A / B / C detection decision form. */
export function DetectionForm() {
  const mitreOptions = useBASLabStore((s) => s.mitreOptions);
  const mitreLoading = useBASLabStore((s) => s.mitreLoading);
  const checkboxOptions = useBASLabStore((s) => s.currentCheckboxOptions);
  const responseActions = useBASLabStore((s) => s.responseActions);
  const selectedTechniqueId = useBASLabStore((s) => s.selectedTechniqueId);
  const selectedIndicators = useBASLabStore((s) => s.selectedIndicators);
  const selectedResponseAction = useBASLabStore((s) => s.selectedResponseAction);
  const stepStatus = useBASLabStore((s) => s.stepStatus);
  const submitting = useBASLabStore((s) => s.submitting);
  const setSelectedTechnique = useBASLabStore((s) => s.setSelectedTechnique);
  const toggleIndicator = useBASLabStore((s) => s.toggleIndicator);
  const setResponseAction = useBASLabStore((s) => s.setResponseAction);
  const submitDetection = useBASLabStore((s) => s.submitDetection);

  const options = useMemo<TechniqueOption[]>(
    () =>
      mitreOptions.map((t) => ({
        value: t.id,
        label: `${t.id} — ${t.name} [${t.tactic}]`,
        tactic: t.tactic,
        name: t.name,
      })),
    [mitreOptions],
  );

  const selectedOption = options.find((o) => o.value === selectedTechniqueId) ?? null;
  const locked = stepStatus === 'submitted' || stepStatus === 'advancing';
  const complete =
    Boolean(selectedTechniqueId) && selectedIndicators.length > 0 && Boolean(selectedResponseAction);

  return (
    <section className="glass-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-cyan-500/15 px-4 py-3">
        <ScanSearch className="h-4 w-4 text-cyan-400" aria-hidden />
        <h2 className="text-sm font-bold tracking-wide text-slate-100">Detection Decision</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {/* Part A */}
        <div>
          <PartHeading
            letter="A"
            title="ATT&CK Technique"
            hint="Which Enterprise technique does this evidence represent?"
            done={Boolean(selectedTechniqueId)}
          />
          <Select<TechniqueOption, false>
            inputId="technique-select"
            classNamePrefix="baslab-select"
            options={options}
            value={selectedOption}
            onChange={(option) => setSelectedTechnique(option?.value ?? '')}
            isDisabled={locked}
            isLoading={mitreLoading}
            isClearable
            placeholder="Search by technique ID, name or tactic…"
            styles={selectStyles}
            noOptionsMessage={() => 'No matching ATT&CK technique'}
          />
        </div>

        {/* Part B */}
        <div>
          <PartHeading
            letter="B"
            title="Detection Indicators"
            hint={`Select every observable that is genuinely suspicious (${selectedIndicators.length} selected).`}
            done={selectedIndicators.length > 0}
          />
          <div className="space-y-1.5">
            {checkboxOptions.map((option) => {
              const checked = selectedIndicators.includes(option);
              return (
                <label
                  key={option}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors',
                    checked
                      ? 'border-cyan-500/45 bg-cyan-500/10 text-slate-100'
                      : 'border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/50',
                    locked && 'cursor-not-allowed opacity-70',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-cyan-500"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggleIndicator(option)}
                  />
                  <span className="log-mono leading-snug">{option}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Part C */}
        <div>
          <PartHeading
            letter="C"
            title="Response Action"
            hint="Pick the single most appropriate containment action."
            done={Boolean(selectedResponseAction)}
          />
          <div
            role="radiogroup"
            aria-label="Response action"
            className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          >
            {responseActions.map((action) => {
              const Icon = ACTION_ICONS[action] ?? BellRing;
              const checked = selectedResponseAction === action;
              return (
                <label
                  key={action}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                    checked
                      ? 'border-amber-500/50 bg-amber-500/12 text-amber-200'
                      : 'border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/50',
                    locked && 'cursor-not-allowed opacity-70',
                  )}
                >
                  <input
                    type="radio"
                    name="response-action"
                    className="h-3.5 w-3.5 shrink-0 accent-amber-500"
                    checked={checked}
                    disabled={locked}
                    onChange={() => setResponseAction(action)}
                  />
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {action}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-cyan-500/15 px-4 py-3">
        <GlowButton
          className="w-full"
          onClick={submitDetection}
          disabled={!complete || locked}
          loading={submitting}
          icon={<Send className="h-4 w-4" aria-hidden />}
        >
          {locked ? 'Detection submitted' : 'Submit Detection'}
        </GlowButton>
        {!complete && !locked ? (
          <p className="mt-2 text-center text-[11px] text-slate-500">
            All three parts are required before you can submit.
          </p>
        ) : null}
      </div>
    </section>
  );
}
