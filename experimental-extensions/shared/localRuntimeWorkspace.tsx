import { AppPageLayout, ToolbarButton } from '@personal-agent/extensions/ui';
import type React from 'react';

export type RuntimeStatusTone = 'ready' | 'running' | 'warning' | 'muted';

export function RuntimeDot({ tone }: { tone: RuntimeStatusTone }) {
  const className = tone === 'running' ? 'bg-success' : tone === 'ready' ? 'bg-accent' : tone === 'warning' ? 'bg-warning' : 'bg-dim';
  return <span className={`mr-2 inline-block h-2 w-2 rounded-full ${className}`} />;
}

export function RuntimePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[76rem]" contentClassName="space-y-5">
        {children}
      </AppPageLayout>
    </div>
  );
}

export function RuntimeHeader({
  title,
  summary,
  status,
  tone,
  metadata,
  message,
  actions,
  progress,
}: {
  title: string;
  summary: string;
  status: string;
  tone: RuntimeStatusTone;
  metadata: string[];
  message?: string | null;
  actions?: React.ReactNode;
  progress?: number | null;
}) {
  const clampedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <header className="border-b border-border-subtle pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-primary">{title}</h1>
          <p className="mt-1 text-sm text-secondary">{summary}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary">
        <span className="font-medium text-primary">
          <RuntimeDot tone={tone} />
          {status}
        </span>
        {metadata.map((item) => (
          <span key={item} className="min-w-0 truncate">
            {item}
          </span>
        ))}
      </div>
      {clampedProgress != null ? (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-border-subtle" aria-label={`Setup progress ${clampedProgress}%`}>
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${clampedProgress}%` }} />
        </div>
      ) : null}
      {message ? (
        <div className="mt-3 text-sm text-secondary" aria-live="polite">
          {message}
        </div>
      ) : null}
    </header>
  );
}

export function RuntimeWorkspace({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <section className="grid min-h-[34rem] overflow-hidden rounded-xl border border-border-subtle bg-surface/40 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
      <aside className="border-b border-border-subtle p-4 lg:border-b-0 lg:border-r">{left}</aside>
      <main className="flex min-w-0 flex-col p-4">{right}</main>
    </section>
  );
}

export function TerminalBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="min-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle bg-[#0f131c] p-4 text-xs leading-relaxed text-secondary">
      {children}
    </pre>
  );
}

export function RuntimeFooter({
  summary,
  open,
  onToggle,
  children,
}: {
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <footer className="rounded-lg border border-border-subtle bg-surface/30 text-sm text-secondary">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{summary}</span>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="border-t border-border-subtle p-4">{children}</div> : null}
    </footer>
  );
}

export { ToolbarButton };
