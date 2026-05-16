import { AppPageIntro, AppPageLayout, ToolbarButton } from '@personal-agent/extensions/ui';
import type React from 'react';

export type RuntimeStatusTone = 'ready' | 'running' | 'warning' | 'muted';

export function RuntimeDot({ tone }: { tone: RuntimeStatusTone }) {
  const className = tone === 'running' ? 'bg-success' : tone === 'ready' ? 'bg-accent' : tone === 'warning' ? 'bg-warning' : 'bg-dim';
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} aria-hidden="true" />;
}

export function RuntimePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
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
    <header className="space-y-6">
      <AppPageIntro title={title} summary={summary} actions={actions} />
      <div className="space-y-3 border-y border-border-subtle/65 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary">
          <span className="inline-flex items-center gap-2 font-medium text-primary">
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
          <div className="h-1 overflow-hidden rounded-full bg-border-subtle" aria-label={`Setup progress ${clampedProgress}%`}>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${clampedProgress}%` }} />
          </div>
        ) : null}
        {message ? (
          <div className="text-sm text-secondary" aria-live="polite">
            {message}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function RuntimeWorkspace({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <section className="grid gap-10 lg:grid-cols-[minmax(18rem,22rem)_1fr] lg:items-start">
      <aside className="min-w-0 space-y-6">{left}</aside>
      <main className="min-w-0 space-y-6">{right}</main>
    </section>
  );
}

export function RuntimePanel({ children }: { children: React.ReactNode }) {
  return <section className="space-y-5 border-t border-border-subtle/65 pt-6">{children}</section>;
}

export function TerminalBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="min-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle/80 bg-surface/55 p-4 text-xs leading-relaxed text-secondary">
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
    <footer className="border-t border-border-subtle/65 pt-4 text-sm text-secondary">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{summary}</span>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </footer>
  );
}

export { ToolbarButton };
