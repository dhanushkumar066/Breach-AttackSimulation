import { Check, Copy, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { cn } from '@/lib/cn';

// PrismLight ships no grammars by default; registering only what the module
// renders keeps ~700 kB of unused language definitions out of the bundle.
SyntaxHighlighter.registerLanguage('yaml', yaml);

interface SigmaViewerProps {
  yaml: string;
  title?: string;
  className?: string;
  maxHeight?: number;
}

/** Syntax-highlighted Sigma rule with a copy-to-clipboard control. */
export function SigmaViewer({ yaml, title, className, maxHeight = 420 }: SigmaViewerProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be blocked; the rule stays selectable either way.
      setCopied(false);
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-950/70', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-cyan-500/15 bg-slate-900/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
          <span className="truncate text-xs font-semibold text-slate-200">
            {title ?? 'Sigma detection rule'}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-600/60 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy YAML'}
        </button>
      </div>
      <div style={{ maxHeight }} className="overflow-auto">
        <SyntaxHighlighter
          language="yaml"
          style={oneDark}
          showLineNumbers
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            background: 'transparent',
            fontSize: '12px',
            padding: '0.85rem 0.5rem',
          }}
          lineNumberStyle={{ color: '#334155', minWidth: '2.25rem' }}
        >
          {yaml}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
