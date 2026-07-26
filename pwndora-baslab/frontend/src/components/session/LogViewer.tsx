import { Braces, Check, ChevronDown, Copy, FileTerminal, Globe, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import type { LogChannel, LogEntry } from '@/types/baslab';

/** Official Windows / Sysmon event descriptions, so the summary line reads like a SIEM. */
const EVENT_TITLES: Record<string, string> = {
  'Security:4624': 'An account was successfully logged on.',
  'Security:4625': 'An account failed to log on.',
  'Security:4656': 'A handle to an object was requested.',
  'Security:4663': 'An attempt was made to access an object.',
  'Security:4672': 'Special privileges assigned to new logon.',
  'Security:4688': 'A new process has been created.',
  'Security:4769': 'A Kerberos service ticket was requested.',
  'Security:5140': 'A network share object was accessed.',
  'Security:7045': 'A new service was installed in the system.',
  'Sysmon:1': 'Process creation.',
  'Sysmon:3': 'Network connection detected.',
  'Sysmon:7': 'Image loaded.',
  'Sysmon:8': 'CreateRemoteThread detected.',
  'Sysmon:10': 'Process accessed.',
  'Sysmon:11': 'File created.',
  'Sysmon:13': 'Registry value set.',
};

/** Severity tone per event, matching how a SOC console colours its stream. */
const EVENT_TONE: Record<string, 'info' | 'warn' | 'crit'> = {
  'Security:4624': 'info',
  'Security:4625': 'crit',
  'Security:4656': 'crit',
  'Security:4663': 'warn',
  'Security:4672': 'warn',
  'Security:4688': 'info',
  'Security:4769': 'warn',
  'Security:5140': 'warn',
  'Security:7045': 'crit',
  'Sysmon:1': 'info',
  'Sysmon:3': 'warn',
  'Sysmon:7': 'info',
  'Sysmon:8': 'crit',
  'Sysmon:10': 'crit',
  'Sysmon:11': 'warn',
  'Sysmon:13': 'warn',
};

const TONE_CLASS = {
  info: 'bg-emerald-500/20 text-emerald-400',
  warn: 'bg-yellow-500/20 text-yellow-400',
  crit: 'bg-red-500/20 text-red-400',
} as const;

/** Fields worth surfacing on the collapsed summary line, in priority order. */
const SUMMARY_FIELDS = [
  'CommandLine',
  'TargetImage',
  'TargetFilename',
  'TargetObject',
  'ObjectName',
  'ShareName',
  'ServiceName',
  'TargetUserName',
  'SubjectUserName',
  'DestinationIp',
  'GrantedAccess',
  'LogonType',
  'uri',
  'src_ip',
  'Image',
  'User',
];

const CRITICAL_FIELDS = new Set([
  'CommandLine',
  'ParentCommandLine',
  'ParentImage',
  'ParentProcessName',
  'TargetImage',
  'TargetFilename',
  'TargetObject',
  'GrantedAccess',
  'DestinationIp',
  'DestinationPort',
  'CallTrace',
  'NewProcessName',
  'Image',
  'ObjectName',
  'AccessMask',
  'ShareName',
  'ServiceName',
  'ImagePath',
  'LogonType',
  'AuthenticationPackageName',
  'TicketEncryptionType',
  'uri',
  'user_agent',
  'src_ip',
]);

const SUSPICIOUS_PATTERNS: RegExp[] = [
  /-enc\b/i,
  /-encodedcommand/i,
  /executionpolicy\s+bypass/i,
  /-w\s+hidden/i,
  /lsass\.exe/i,
  /0x1fffff|0x1010|0x1f3fff/i,
  /unknown\(/i,
  /vssadmin|bcdedit|delete\s+shadows/i,
  /\.locked\b/i,
  /lockbit/i,
  /cmd\.aspx|\.aspx$/i,
  /web\.config/i,
  /connectionstring/i,
  /whoami|ipconfig\s+\/all/i,
  /python-requests|sqlmap|curl\//i,
  /admin\$/i,
  /psexesvc/i,
  /file\.io|transfer\.sh/i,
  /--exfil/i,
  /select\s+\*\s+from/i,
  /disableantispyware/i,
  /\\currentversion\\run\\/i,
  /winword\.exe/i,
  /w3wp\.exe/i,
  /\\programdata\\/i,
  /\\appdata\\local\\temp\\/i,
  /\bntlm\b/i,
  /createremotethread/i,
  /dump\.csv|lsass\.dmp/i,
  /185\.220\.101\.47|203\.0\.113\.45|198\.51\.100\.77|45\.33\.32\.156/,
];

const CHANNEL_LABEL: Record<LogChannel, string> = {
  Security: 'WINDOWS SECURITY',
  'Microsoft-Windows-Sysmon/Operational': 'SYSMON',
  'Microsoft-IIS-Logging/Logs': 'NETWORK TRAFFIC',
};

const CHANNEL_ORDER: LogChannel[] = [
  'Security',
  'Microsoft-Windows-Sysmon/Operational',
  'Microsoft-IIS-Logging/Logs',
];

const CHANNEL_ICON: Record<LogChannel, typeof ShieldAlert> = {
  Security: ShieldAlert,
  'Microsoft-Windows-Sysmon/Operational': FileTerminal,
  'Microsoft-IIS-Logging/Logs': Globe,
};

function eventKey(entry: LogEntry): string {
  if (entry.channel === 'Security') return `Security:${entry.event_id}`;
  if (entry.channel === 'Microsoft-Windows-Sysmon/Operational') return `Sysmon:${entry.event_id}`;
  return 'IIS';
}

function eventTitle(entry: LogEntry): string {
  if (entry.channel === 'Microsoft-IIS-Logging/Logs') {
    const method = entry.fields.method ?? 'GET';
    const status = entry.fields.status ?? '';
    return `HTTP ${method} request served with status ${status}.`;
  }
  return EVENT_TITLES[eventKey(entry)] ?? 'Event recorded.';
}

function eventBadge(entry: LogEntry): { label: string; tone: 'info' | 'warn' | 'crit' } {
  if (entry.channel === 'Microsoft-IIS-Logging/Logs') {
    const status = entry.fields.status ?? '';
    return { label: 'W3SVC ACCESS', tone: status.startsWith('2') ? 'warn' : 'info' };
  }
  return { label: `EVENT ${entry.event_id}`, tone: EVENT_TONE[eventKey(entry)] ?? 'info' };
}

function summaryLine(entry: LogEntry): string {
  const parts: string[] = [];
  for (const field of SUMMARY_FIELDS) {
    const value = entry.fields[field];
    if (!value) continue;
    parts.push(`${field}: ${value.length > 64 ? `${value.slice(0, 63)}…` : value}`);
    if (parts.length === 3) break;
  }
  return parts.join('  |  ');
}

function isSuspicious(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value));
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toISOString().replace('T', ' ').replace('Z', '');
}

function LogRecord({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);
  const badge = eventBadge(entry);

  async function copyRaw(event: React.MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'group flex cursor-pointer flex-col rounded border p-2 transition-all',
        expanded
          ? 'border-brand-cyan/20 bg-brand-cyan/5 shadow-[0_0_15px_rgba(6,182,212,0.05)]'
          : 'border-transparent hover:border-white/10 hover:bg-white/5',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-[#849495]">[{formatTimestamp(entry.timestamp)}]</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', TONE_CLASS[badge.tone])}>
            {badge.label}
          </span>
          <span className="font-bold text-white">{eventTitle(entry)}</span>
        </div>

        {expanded ? (
          <button
            type="button"
            onClick={copyRaw}
            className="flex shrink-0 items-center gap-1 rounded bg-brand-cyan/20 px-2 py-1 text-[10px] font-bold text-brand-cyan transition-all hover:bg-brand-cyan/30 active:scale-95"
          >
            {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
            {copied ? 'COPIED' : 'COPY RAW'}
          </button>
        ) : (
          <ChevronDown
            className="h-4 w-4 shrink-0 text-[#849495] transition-colors group-hover:text-brand-cyan"
            aria-hidden
          />
        )}
      </div>

      {expanded ? (
        <div className="mt-1 overflow-x-auto rounded border border-white/5 bg-black/40 p-3">
          <div className="space-y-0.5">
            <div>
              <span className="log-key-critical">Computer</span>
              <span className="text-[#849495]">: </span>
              <span className="log-value">{entry.computer}</span>
            </div>
            <div>
              <span className="log-key-critical">Channel</span>
              <span className="text-[#849495]">: </span>
              <span className="log-value">{entry.channel}</span>
            </div>
            {Object.entries(entry.fields).map(([key, value]) => (
              <div key={key} className="flex flex-wrap">
                <span className={CRITICAL_FIELDS.has(key) ? 'log-key-critical' : 'log-key'}>{key}</span>
                <span className="text-[#849495]">:&nbsp;</span>
                <span className={isSuspicious(value) ? 'log-value-suspicious' : 'log-value'}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="ml-2 border-l border-white/10 py-1 pl-4 text-[#849495]">
          {summaryLine(entry) || entry.computer}
        </div>
      )}
    </div>
  );
}

interface LogViewerProps {
  logEvidence: LogEntry[];
  stepNumber: number;
}

/** Forensic log terminal: channel tabs, expandable records, raw JSON. */
export function LogViewer({ logEvidence, stepNumber }: LogViewerProps) {
  const channels = useMemo(
    () => CHANNEL_ORDER.filter((channel) => logEvidence.some((e) => e.channel === channel)),
    [logEvidence],
  );

  type Tab = LogChannel | 'raw';
  const [tab, setTab] = useState<Tab>(channels[0] ?? 'raw');
  const [expanded, setExpanded] = useState<number | null>(0);

  // A new step can carry a different mix of channels; keep the tab valid and
  // re-open the first record so the analyst always lands on readable detail.
  useEffect(() => {
    setTab(channels[0] ?? 'raw');
    setExpanded(0);
  }, [channels, stepNumber]);

  const visible = tab === 'raw' ? logEvidence : logEvidence.filter((e) => e.channel === tab);

  return (
    <section className="glass-panel flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex flex-wrap gap-4">
          {channels.map((channel) => {
            const Icon = CHANNEL_ICON[channel];
            const count = logEvidence.filter((e) => e.channel === channel).length;
            return (
              <button
                key={channel}
                type="button"
                role="tab"
                aria-selected={tab === channel}
                onClick={() => setTab(channel)}
                className={cn(
                  'label-caps flex items-center gap-1.5 pb-2 transition-all',
                  tab === channel
                    ? 'tab-active'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {CHANNEL_LABEL[channel]}
                <span className="text-[10px] opacity-60">({count})</span>
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'raw'}
            onClick={() => setTab('raw')}
            className={cn(
              'label-caps flex items-center gap-1.5 pb-2 transition-all',
              tab === 'raw'
                ? 'tab-active'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            <Braces className="h-3.5 w-3.5" aria-hidden />
            RAW JSON
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-caps text-[10px] text-slate-500 dark:text-slate-400">FILTER:</span>
          <div className="label-caps rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
            ALL EVENTS
          </div>
        </div>
      </div>

      {/* The stream stays obsidian in both themes — analysts read telemetry on dark. */}
      <div className="terminal-bg relative flex min-h-0 flex-grow flex-col overflow-hidden rounded-xl p-4 font-mono text-xs">
        <div key={`${stepNumber}-${tab}`} className="scrollbar-hidden min-h-0 flex-grow space-y-2 overflow-y-auto pr-2">
          {tab === 'raw' ? (
            <pre className="whitespace-pre text-[11px] leading-relaxed text-brand-cyan/80">
              {JSON.stringify(logEvidence, null, 2)}
            </pre>
          ) : (
            visible.map((entry, index) => (
              <LogRecord
                key={`${entry.channel}-${entry.event_id}-${index}`}
                entry={entry}
                expanded={expanded === index}
                onToggle={() => setExpanded(expanded === index ? null : index)}
              />
            ))
          )}
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-[#05070b] to-transparent" />
      </div>
    </section>
  );
}
