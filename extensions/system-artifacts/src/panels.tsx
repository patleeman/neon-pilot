import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ArtifactToolBlock } from './ArtifactToolBlock.js';

type ArtifactKind = 'html' | 'mermaid' | 'latex';

interface ArtifactSummary {
  id: string;
  kind: ArtifactKind;
  title: string;
  revision: number;
  updatedAt: string;
}

interface ArtifactRecord extends ArtifactSummary {
  content: string;
}

const ARTIFACT_PARAM = 'artifact';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readArtifactSummary(value: unknown): ArtifactSummary | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : typeof value.artifactId === 'string' ? value.artifactId : '';
  const kind = value.kind === 'html' || value.kind === 'mermaid' || value.kind === 'latex' ? value.kind : null;
  const title = typeof value.title === 'string' ? value.title : '';
  const revision = typeof value.revision === 'number' && Number.isFinite(value.revision) ? value.revision : 1;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  return id && kind && title ? { id, kind, title, revision, updatedAt } : null;
}

function readArtifactRecord(value: unknown): ArtifactRecord | null {
  const summary = readArtifactSummary(value);
  if (!summary || !isRecord(value) || typeof value.content !== 'string') return null;
  return { ...summary, content: value.content };
}

function readArtifactPresentation(
  block: unknown,
): { artifactId?: string; title?: string; kind?: string; revision?: number; updatedAt?: string } | null {
  if (!isRecord(block)) return null;
  const details = isRecord(block.details) ? block.details : isRecord(block.result) ? block.result : block;
  const artifactId = typeof details.artifactId === 'string' ? details.artifactId : undefined;
  if (!artifactId) return null;
  return {
    artifactId,
    title: typeof details.title === 'string' ? details.title : artifactId,
    kind: typeof details.kind === 'string' ? details.kind : 'artifact',
    revision: typeof details.revision === 'number' ? details.revision : undefined,
    updatedAt: typeof details.updatedAt === 'string' ? details.updatedAt : undefined,
  };
}

function formatDate(value: string): string {
  const date = Date.parse(value);
  return Number.isFinite(date) ? new Date(date).toLocaleString() : value;
}

function buildArtifactDocument(content: string): string {
  const trimmed = content.trim();
  if (/^<!doctype\s+html|<html[\s>]/i.test(trimmed)) return trimmed;
  return [
    '<!doctype html>',
    '<html>',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <style>',
    '      :root { color-scheme: light dark; }',
    '      body { margin: 0; padding: 24px; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    '    </style>',
    '  </head>',
    '  <body>',
    content,
    '  </body>',
    '</html>',
  ].join('\n');
}

function Loading({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">{label}</div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="px-4 py-4 text-[12px] text-danger">{message}</div>;
}

function HtmlArtifactViewer({ artifact }: { artifact: ArtifactRecord }) {
  const srcDoc = useMemo(() => buildArtifactDocument(artifact.content), [artifact.content]);
  return (
    <iframe
      title={artifact.title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      className="h-full w-full border-0 bg-white"
    />
  );
}

function MermaidArtifactViewer({ artifact }: { artifact: ArtifactRecord }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg('');
    setError(null);
    void import('mermaid')
      .then(async (module) => {
        const mermaid = module.default ?? module;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        const renderId = `artifact-mermaid-${Math.random().toString(36).slice(2, 10)}`;
        const result = await mermaid.render(renderId, artifact.content);
        if (!cancelled) setSvg(result.svg);
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(error instanceof Error ? error.message : 'Could not render this Mermaid diagram.');
      });
    return () => {
      cancelled = true;
    };
  }, [artifact.content]);

  if (error) return <ErrorMessage message={error} />;
  if (!svg) return <Loading label="Rendering diagram..." />;
  return (
    <div className="flex h-full items-start justify-center overflow-auto px-5 py-5">
      <div className="w-full min-w-0" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

function LatexArtifactViewer({ artifact }: { artifact: ArtifactRecord }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto px-5 py-5">
      <div className="mb-3 min-w-0">
        <p className="ui-section-label">LaTeX source</p>
        <p className="mt-1 text-[12px] leading-relaxed text-secondary">
          LaTeX artifacts are shown as raw source so the entire file remains visible and copyable.
        </p>
      </div>
      <pre className="min-h-0 overflow-auto rounded-xl border border-border-subtle bg-elevated px-4 py-4 font-mono text-[11px] leading-relaxed text-primary">
        {artifact.content}
      </pre>
    </div>
  );
}

function ArtifactViewer({ artifact }: { artifact: ArtifactRecord }) {
  if (artifact.kind === 'html') return <HtmlArtifactViewer artifact={artifact} />;
  if (artifact.kind === 'mermaid') return <MermaidArtifactViewer artifact={artifact} />;
  if (artifact.kind === 'latex') return <LatexArtifactViewer artifact={artifact} />;
  return <ErrorMessage message={`Unsupported artifact kind: ${artifact.kind}`} />;
}

export function ArtifactTranscriptRenderer({
  block,
  context,
}: {
  block: never;
  context: { onOpenArtifact?: (artifactId: string) => void; activeArtifactId?: string | null };
}) {
  const artifact = readArtifactPresentation(block);
  if (!artifact) return null;
  return (
    <ArtifactToolBlock
      block={block}
      artifact={artifact}
      onOpenArtifact={context.onOpenArtifact}
      activeArtifactId={context.activeArtifactId}
    />
  );
}

export function ArtifactsPanel({ pa, context }: ExtensionSurfaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeArtifactId = searchParams.get(ARTIFACT_PARAM) ?? null;

  useEffect(() => {
    if (!context.conversationId) {
      setArtifacts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    pa.extension
      .invoke('artifact', { action: 'list', conversationId: context.conversationId })
      .then((result) => {
        if (cancelled) return;
        const rawArtifacts = isRecord(result) && Array.isArray(result.artifacts) ? result.artifacts : [];
        setArtifacts(
          rawArtifacts.flatMap((item) => {
            const summary = readArtifactSummary(item);
            return summary ? [summary] : [];
          }),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [context.conversationId, pa.extension]);

  const handleOpenArtifact = useCallback(
    (artifactId: string) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('file');
        next.delete('checkpoint');
        next.delete('run');
        next.set(ARTIFACT_PARAM, artifactId);
        return next;
      });
    },
    [setSearchParams],
  );

  let content;
  if (loading && artifacts.length === 0) content = <Loading label="Loading artifacts..." />;
  else if (error && artifacts.length === 0) content = <ErrorMessage message={error} />;
  else if (artifacts.length === 0) content = <div className="px-4 py-3 text-[12px] text-dim">No artifacts in this conversation.</div>;
  else {
    content = (
      <div className="flex flex-col gap-1.5">
        {artifacts.map((artifact) => {
          const selected = artifact.id === activeArtifactId;
          return (
            <button
              key={artifact.id}
              type="button"
              onClick={() => handleOpenArtifact(artifact.id)}
              className={`rounded-xl px-3 py-2.5 text-left transition-colors ${selected ? 'bg-elevated text-primary' : 'text-secondary hover:bg-elevated/60 hover:text-primary'}`}
              title={`${artifact.title} · ${artifact.id} · rev ${artifact.revision}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{artifact.title}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-dim/70">{artifact.kind}</span>
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-dim">{artifact.id}</div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-2">
        <p className="ui-section-label">Artifacts</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">{content}</div>
    </div>
  );
}

export function ArtifactDetailPanel({ pa, context }: ExtensionSurfaceProps) {
  const artifactId = new URLSearchParams(context.search).get(ARTIFACT_PARAM);
  const [artifact, setArtifact] = useState<ArtifactRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!context.conversationId || !artifactId) {
      setArtifact(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCopied(false);
    pa.extension
      .invoke('artifact', { action: 'get', conversationId: context.conversationId, artifactId })
      .then((result) => {
        if (!cancelled) setArtifact(readArtifactRecord(result));
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId, context.conversationId, pa.extension]);

  if (!context.conversationId || !artifactId) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center select-text">
        <div className="max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel/80">Workbench</p>
          <h2 className="mt-2 text-lg font-semibold text-primary text-balance">Open an artifact</h2>
          <p className="mt-2 text-[13px] leading-6 text-secondary">
            Pick an artifact from the right rail to inspect it beside the transcript.
          </p>
        </div>
      </div>
    );
  }

  async function copySource() {
    if (!artifact) return;
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not copy artifact source.');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <div className="shrink-0 border-b border-border-subtle px-4 py-2.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0 flex flex-1 items-center gap-2.5">
            <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-dim/80">{artifact?.kind ?? 'artifact'}</span>
            <h2
              className="min-w-0 truncate text-[14px] font-medium text-primary"
              title={
                artifact
                  ? `${artifact.title} · ${artifact.id} · rev ${artifact.revision} · updated ${formatDate(artifact.updatedAt)}`
                  : artifactId
              }
            >
              {artifact?.title ?? artifactId}
            </h2>
            {artifact ? <span className="hidden shrink-0 text-[11px] text-dim sm:inline">rev {artifact.revision}</span> : null}
          </div>
          {artifact ? (
            <button type="button" onClick={() => void copySource()} className="ui-toolbar-button shrink-0 px-2 py-1 text-[10px]">
              {copied ? 'copied' : artifact.kind === 'latex' ? 'copy latex' : 'copy source'}
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {loading && !artifact ? (
          <Loading label="Loading artifact..." />
        ) : error || !artifact ? (
          <ErrorMessage message={error || 'Artifact not found.'} />
        ) : (
          <ArtifactViewer artifact={artifact} />
        )}
      </div>
    </div>
  );
}
