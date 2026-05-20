import { AppPageIntro, AppPageLayout, ToolbarButton } from '@neon-pilot/extensions/ui';
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

export function RuntimeHeader({ title, summary, actions }: { title: string; summary: string; actions?: React.ReactNode }) {
  return <AppPageIntro title={title} summary={summary} actions={actions} />;
}

export function RuntimeStrip({
  status,
  tone,
  metadata,
  message,
  children,
  progress,
}: {
  status: string;
  tone: RuntimeStatusTone;
  metadata: string[];
  message?: string | null;
  children: React.ReactNode;
  progress?: number | null;
}) {
  const clampedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <section className="space-y-5 border-y border-border-subtle/65 py-6">
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
      {message ? (
        <div className="text-sm text-secondary" aria-live="polite">
          {message}
        </div>
      ) : null}
      {children}
      {clampedProgress != null ? (
        <div className="h-1 overflow-hidden rounded-full bg-border-subtle" aria-label={`Setup progress ${clampedProgress}%`}>
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${clampedProgress}%` }} />
        </div>
      ) : null}
    </section>
  );
}

export function RuntimeSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 border-t border-border-subtle/65 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {description ? <p className="text-sm text-secondary">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function TerminalBlock({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <pre
      className={`overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle/80 bg-surface/55 p-4 text-xs leading-relaxed text-secondary ${
        compact ? 'min-h-28' : 'min-h-44'
      }`}
    >
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
