import { AnimatePresence, motion } from 'framer-motion';
import { Braces, FileTerminal, Globe, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { cn } from '@/lib/cn';
import type { LogChannel, LogEntry } from '@/types/baslab';

// See SigmaViewer: only the grammars actually used are registered.
SyntaxHighlighter.registerLanguage('json', json);

/** Field names worth pulling the eye to first. */
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

/** Substrings that mark a value as adversary-relevant rather than routine. */
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
  Security: 'Windows Security',
  'Microsoft-Windows-Sysmon/Operational': 'Sysmon',
  'Microsoft-IIS-Logging/Logs': 'IIS / Web Access',
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

function isSuspicious(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value));
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toISOString().replace('T', ' ').replace('Z', 'Z');
}

function EventBadge({ entry }: { entry: LogEntry }) {
  if (entry.channel === 'Microsoft-IIS-Logging/Logs') {
    return (
      <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-fuchsia-300">
        W3SVC ACCESS
      </span>
    );
  }
  return (
    <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-300">
      EID {entry.event_id}
    </span>
  );
}

function LogCard({ entry, startLine }: { entry: LogEntry; startLine: number }) {
  const rows = Object.entries(entry.fields);
  return (
    <article className="rounded-lg border border-slate-700/50 bg-slate-950/50 transition-colors hover:border-cyan-500/30">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-700/50 px-3 py-2">
        <EventBadge entry={entry} />
        <span className="log-mono text-[11px] text-slate-400">{formatTimestamp(entry.timestamp)}</span>
        <span className="ml-auto log-mono text-[11px] font-semibold text-slate-300">
          {entry.computer}
        </span>
      </header>
      <div className="log-mono px-2 py-2">
        {rows.map(([key, value], index) => (
          <div key={key} className="flex items-start hover:bg-slate-800/40">
            <span className="log-line-number">{startLine + index}</span>
            <span
              className={cn(
                'shrink-0 pr-2',
                CRITICAL_FIELDS.has(key) ? 'log-key-critical' : 'log-key',
              )}
            >
              {key}:
            </span>
            <span className={cn(isSuspicious(value) ? 'log-value-suspicious' : 'log-value')}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

interface LogViewerProps {
  logEvidence: LogEntry[];
  stepNumber: number;
}

/** Three-way log console: Windows Security, Sysmon (plus IIS when present) and Raw JSON. */
export function LogViewer({ logEvidence, stepNumber }: LogViewerProps) {
  const channels = useMemo(
    () => CHANNEL_ORDER.filter((channel) => logEvidence.some((e) => e.channel === channel)),
    [logEvidence],
  );

  type Tab = LogChannel | 'raw';
  const [tab, setTab] = useState<Tab>(channels[0] ?? 'raw');

  // A new step can carry a different mix of channels; keep the tab valid.
  useEffect(() => {
    setTab(channels[0] ?? 'raw');
  }, [channels, stepNumber]);

  const visible = tab === 'raw' ? logEvidence : logEvidence.filter((e) => e.channel === tab);

  let lineCursor = 1;

  return (
    <section className="glass-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-cyan-500/15 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-slate-100">Log Evidence</h2>
          <p className="text-[11px] text-slate-500">
            {logEvidence.length} record{logEvidence.length === 1 ? '' : 's'} captured for this stage
          </p>
        </div>
        <span className="rounded-md border border-slate-600/50 px-2 py-1 log-mono text-[11px] text-slate-400">
          STEP {stepNumber}
        </span>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-700/50 px-3 py-2" role="tablist">
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
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
                tab === channel
                  ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {CHANNEL_LABEL[channel]}
              <span className="text-[10px] text-slate-500">({count})</span>
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'raw'}
          onClick={() => setTab('raw')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
            tab === 'raw'
              ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
          )}
        >
          <Braces className="h-3.5 w-3.5" aria-hidden />
          Raw JSON
        </button>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${stepNumber}-${tab}`}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-3"
          >
            {tab === 'raw' ? (
              <SyntaxHighlighter
                language="json"
                style={oneDark}
                showLineNumbers
                customStyle={{
                  margin: 0,
                  borderRadius: '0.5rem',
                  background: 'rgba(2, 6, 23, 0.75)',
                  fontSize: '12px',
                }}
                lineNumberStyle={{ color: '#334155', minWidth: '2.25rem' }}
              >
                {JSON.stringify(logEvidence, null, 2)}
              </SyntaxHighlighter>
            ) : (
              visible.map((entry, index) => {
                const start = lineCursor;
                lineCursor += Object.keys(entry.fields).length;
                return <LogCard key={`${entry.channel}-${index}`} entry={entry} startLine={start} />;
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
