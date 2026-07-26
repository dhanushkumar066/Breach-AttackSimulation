import {
  ArrowRight,
  Ban,
  BellRing,
  Check,
  CircleSlash,
  FileWarning,
  KeyRound,
  Search,
  ShieldCheck,
  Skull,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import Select, { components, type StylesConfig } from 'react-select';

import { cn } from '@/lib/cn';
import { useBASLabStore } from '@/store/useBASLabStore';

interface TechniqueOption {
  value: string;
  label: string;
  tactic: string;
  name: string;
}

const ACTION_ICONS: Record<string, typeof Ban> = {
  'Isolate Host': Ban,
  'Block IP/Domain': ShieldCheck,
  'Kill Process': Skull,
  'Revoke Credentials': KeyRound,
  'Alert SOC Only': BellRing,
  'Quarantine File': FileWarning,
  'No Action Required': CircleSlash,
};

/** Containment actions that take the host or an identity offline read as destructive. */
const DESTRUCTIVE = new Set(['Isolate Host', 'Revoke Credentials']);

/** react-select renders its own DOM, so the console theme is applied through styles. */
const selectStyles: StylesConfig<TechniqueOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'transparent',
    border: 0,
    borderRadius: 0,
    borderBottom: `1px solid ${state.isFocused ? 'rgb(6 182 212)' : 'rgba(148,163,184,0.35)'}`,
    boxShadow: 'none',
    paddingLeft: '2rem',
    minHeight: '48px',
    ':hover': { borderBottomColor: 'rgba(6,182,212,0.6)' },
  }),
  valueContainer: (base) => ({ ...base, paddingLeft: 0 }),
  input: (base) => ({ ...base, color: 'inherit' }),
  placeholder: (base) => ({ ...base, color: 'rgb(100 116 139)', fontSize: '14px' }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'rgba(12, 16, 29, 0.98)',
    border: '1px solid rgba(6, 182, 212, 0.25)',
    backdropFilter: 'blur(16px)',
    zIndex: 60,
  }),
  menuList: (base) => ({ ...base, maxHeight: 260 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '13px',
  }),
  indicatorsContainer: (base) => ({ ...base, display: 'none' }),
  noOptionsMessage: (base) => ({ ...base, color: '#64748b', fontSize: '13px' }),
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="label-caps mb-3 block text-slate-500 dark:text-slate-400">{children}</label>
  );
}

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
      <h2 className="label-caps flex shrink-0 items-center gap-2 border-b border-slate-200 px-6 py-4 text-brand-blue dark:border-white/10 dark:text-brand-cyan">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        TRIAGE CONSOLE
      </h2>

      <div className="scrollbar-hidden min-h-0 flex-grow overflow-y-auto p-6">
        {/* Part A — technique */}
        <div className="mb-8">
          <SectionLabel>IDENTIFIED MITRE TECHNIQUE</SectionLabel>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-3.5 z-10 h-5 w-5 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
            <Select<TechniqueOption, false>
              inputId="technique-select"
              classNamePrefix="baslab-select"
              className="text-slate-900 dark:text-white"
              options={options}
              value={selectedOption}
              onChange={(option) => setSelectedTechnique(option?.value ?? '')}
              isDisabled={locked}
              isLoading={mitreLoading}
              controlShouldRenderValue={false}
              placeholder="Search techniques..."
              styles={selectStyles}
              components={{ DropdownIndicator: null, IndicatorSeparator: null }}
              noOptionsMessage={() => 'No matching ATT&CK technique'}
            />
          </div>

          {selectedOption ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded border border-brand-blue/20 bg-brand-blue/10 px-3 py-1 text-[10px] font-bold text-brand-blue dark:border-brand-cyan/30 dark:bg-brand-cyan/10 dark:text-brand-cyan">
                <span>
                  {selectedOption.value} ({selectedOption.name})
                </span>
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTechnique('')}
                    aria-label="Clear selected technique"
                    className="transition-colors hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Part B — indicators */}
        <div className="mb-8">
          <SectionLabel>CONFIRMED IOCS ({selectedIndicators.length} selected)</SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            {checkboxOptions.map((option) => {
              const checked = selectedIndicators.includes(option);
              return (
                <label
                  key={option}
                  className={cn(
                    'group flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all',
                    checked
                      ? 'border-brand-blue/30 bg-brand-blue/5 dark:border-brand-cyan/50 dark:bg-brand-cyan/10'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10',
                    locked && 'cursor-not-allowed opacity-70',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggleIndicator(option)}
                  />
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                      checked
                        ? 'border-brand-blue/50 bg-brand-blue/10 dark:border-brand-cyan/50 dark:bg-brand-cyan/10'
                        : 'border-slate-300 group-hover:border-brand-blue dark:border-white/20 dark:group-hover:border-brand-cyan',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 text-brand-blue transition-opacity dark:text-brand-cyan',
                        checked ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                  </span>
                  <span className="font-mono text-xs leading-snug text-slate-900 dark:text-slate-200">
                    {option}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Part C — response */}
        <div>
          <SectionLabel>RECOMMENDED ACTIONS</SectionLabel>
          <div role="radiogroup" aria-label="Response action" className="grid grid-cols-2 gap-3">
            {responseActions.map((action) => {
              const Icon = ACTION_ICONS[action] ?? BellRing;
              const checked = selectedResponseAction === action;
              const destructive = DESTRUCTIVE.has(action);
              return (
                <label
                  key={action}
                  className={cn(
                    'interaction-scale flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-center text-xs font-bold transition-all',
                    checked
                      ? destructive
                        ? 'border-red-500/60 bg-red-500/15 text-red-600 dark:text-red-300'
                        : 'border-brand-blue bg-brand-blue/15 text-brand-blue dark:border-brand-cyan dark:text-brand-cyan'
                      : destructive
                        ? 'border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 dark:text-red-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-blue/30 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10',
                    locked && 'cursor-not-allowed opacity-70',
                  )}
                >
                  <input
                    type="radio"
                    name="response-action"
                    className="sr-only"
                    checked={checked}
                    disabled={locked}
                    onChange={() => setResponseAction(action)}
                  />
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="uppercase">{action}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 p-6 dark:border-white/10">
        <button
          type="button"
          onClick={submitDetection}
          disabled={!complete || locked || submitting}
          className={cn(
            'interaction-scale hover-lift group flex w-full items-center justify-center gap-3 rounded-xl py-4 font-bold transition-all',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none',
            'bg-brand-blue text-white shadow-[0_4px_15px_rgba(2,132,199,0.3)] dark:bg-brand-cyan dark:text-slate-900',
          )}
        >
          {submitting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          <span className="label-caps text-base tracking-widest">
            {locked ? 'DETECTION SUBMITTED' : 'SUBMIT DETECTION'}
          </span>
          {!submitting && !locked ? (
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
          ) : null}
        </button>
        <p className="label-caps mt-3 text-center text-[10px] text-slate-500 dark:text-slate-400">
          {complete || locked
            ? 'PROCEED TO NEXT STAGE IN FILTRATION DEFENSE'
            : 'ALL THREE PARTS REQUIRED BEFORE SUBMISSION'}
        </p>
      </div>
    </section>
  );
}

/** Re-exported so the bundler keeps react-select's internals reachable for theming. */
export const SelectComponents = components;
