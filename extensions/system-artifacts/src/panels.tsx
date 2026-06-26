import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  CardBody,
  CenteredLoadingState,
  CenteredMessage,
  CodeBlock,
  getDesktopBridge,
  MetaLabel,
  PanelMessage,
  ResourceListItem,
  SectionLabel,
  ToolbarButton,
} from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ArtifactToolBlock } from './ArtifactToolBlock.js';

type ArtifactKind = 'html' | 'mermaid' | 'latex';

interface ArtifactMetadata {
  type?: string;
  stylePreset?: string;
  styleOverrides?: { theme?: string; accent?: string; density?: string; notes?: string };
  source?: { kind?: string; label?: string; messageId?: string; selection?: string; paths?: string[]; command?: string };
  templateVersion?: string;
  generator?: string;
}

interface ArtifactSummary {
  id: string;
  kind: ArtifactKind;
  metadata?: ArtifactMetadata;
  title: string;
  revision: number;
  updatedAt: string;
}

interface ArtifactRecord extends ArtifactSummary {
  content: string;
}

const ARTIFACT_PARAM = 'artifact';
const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  architecture: 'Architecture explainer',
  'data-table': 'Data table',
  'diff-review': 'Diff review',
  'fact-check': 'Fact check',
  'plan-review': 'Plan review',
  'project-recap': 'Project recap',
  report: 'Report',
  slides: 'Slide deck',
  'visual-explainer': 'Visual explainer',
  'visual-plan': 'Visual plan',
};

const STYLE_PRESET_LABELS: Record<string, string> = {
  'architecture-map': 'Architecture map',
  'review-matrix': 'Review matrix',
  'slide-deck': 'Slide deck',
  'technical-report': 'Technical report',
  'visual-explainer': 'Visual explainer',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readArtifactSummary(value: unknown): ArtifactSummary | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : typeof value.artifactId === 'string' ? value.artifactId : '';
  const kind = value.kind === 'html' || value.kind === 'mermaid' || value.kind === 'latex' ? value.kind : null;
  const metadata = readArtifactMetadata(value.metadata);
  const title = typeof value.title === 'string' ? value.title : '';
  const revision = typeof value.revision === 'number' && Number.isFinite(value.revision) ? value.revision : 1;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  return id && kind && title ? { id, kind, ...(metadata ? { metadata } : {}), title, revision, updatedAt } : null;
}

function readArtifactMetadata(value: unknown): ArtifactMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const metadata: ArtifactMetadata = {};
  if (typeof value.type === 'string' && value.type.trim()) metadata.type = value.type.trim();
  if (typeof value.stylePreset === 'string' && value.stylePreset.trim()) metadata.stylePreset = value.stylePreset.trim();
  if (isRecord(value.styleOverrides)) {
    const overrides: ArtifactMetadata['styleOverrides'] = {};
    if (typeof value.styleOverrides.theme === 'string' && value.styleOverrides.theme.trim())
      overrides.theme = value.styleOverrides.theme.trim();
    if (typeof value.styleOverrides.accent === 'string' && value.styleOverrides.accent.trim())
      overrides.accent = value.styleOverrides.accent.trim();
    if (typeof value.styleOverrides.density === 'string' && value.styleOverrides.density.trim())
      overrides.density = value.styleOverrides.density.trim();
    if (typeof value.styleOverrides.notes === 'string' && value.styleOverrides.notes.trim())
      overrides.notes = value.styleOverrides.notes.trim();
    if (Object.keys(overrides).length) metadata.styleOverrides = overrides;
  }
  if (isRecord(value.source)) {
    const source: ArtifactMetadata['source'] = {};
    if (typeof value.source.kind === 'string' && value.source.kind.trim()) source.kind = value.source.kind.trim();
    if (typeof value.source.label === 'string' && value.source.label.trim()) source.label = value.source.label.trim();
    if (typeof value.source.messageId === 'string' && value.source.messageId.trim()) source.messageId = value.source.messageId.trim();
    if (typeof value.source.selection === 'string' && value.source.selection.trim()) source.selection = value.source.selection.trim();
    if (Array.isArray(value.source.paths)) {
      const paths = value.source.paths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0);
      if (paths.length) source.paths = paths;
    }
    if (typeof value.source.command === 'string' && value.source.command.trim()) source.command = value.source.command.trim();
    if (Object.keys(source).length) metadata.source = source;
  }
  if (typeof value.templateVersion === 'string' && value.templateVersion.trim()) metadata.templateVersion = value.templateVersion.trim();
  if (typeof value.generator === 'string' && value.generator.trim()) metadata.generator = value.generator.trim();
  return Object.keys(metadata).length ? metadata : undefined;
}

function readArtifactRecord(value: unknown): ArtifactRecord | null {
  const summary = readArtifactSummary(value);
  if (!summary || !isRecord(value) || typeof value.content !== 'string') return null;
  return { ...summary, content: value.content };
}

function readArtifactPresentation(
  block: unknown,
): { artifactId?: string; title?: string; kind?: string; metadata?: ArtifactMetadata; revision?: number; updatedAt?: string } | null {
  if (!isRecord(block)) return null;
  const details = isRecord(block.details) ? block.details : isRecord(block.result) ? block.result : block;
  const artifactId = typeof details.artifactId === 'string' ? details.artifactId : undefined;
  if (!artifactId) return null;
  const metadata = readArtifactMetadata(details.metadata);
  return {
    artifactId,
    title: typeof details.title === 'string' ? details.title : artifactId,
    kind: typeof details.kind === 'string' ? details.kind : 'artifact',
    ...(metadata ? { metadata } : {}),
    revision: typeof details.revision === 'number' ? details.revision : undefined,
    updatedAt: typeof details.updatedAt === 'string' ? details.updatedAt : undefined,
  };
}

function formatDate(value: string): string {
  const date = Date.parse(value);
  return Number.isFinite(date) ? new Date(date).toLocaleString() : value;
}

function labelFromSlug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function artifactTypeLabel(artifact: { kind: string; metadata?: ArtifactMetadata }): string {
  const type = artifact.metadata?.type;
  return type ? (ARTIFACT_TYPE_LABELS[type] ?? labelFromSlug(type)) : artifact.kind;
}

function artifactDetailLabel(artifact: { kind: string; metadata?: ArtifactMetadata }): string {
  const preset = artifact.metadata?.stylePreset;
  const presetLabel = preset ? (STYLE_PRESET_LABELS[preset] ?? labelFromSlug(preset)) : null;
  return [presetLabel, artifact.kind].filter(Boolean).join(' · ');
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
  return <CenteredLoadingState label={label} />;
}

function ErrorMessage({ message }: { message: string }) {
  return <PanelMessage tone="danger">{message}</PanelMessage>;
}

function formatArtifactLoadError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/artifact .+ was not found/i.test(raw)) {
    return 'This artifact was deleted or is no longer available.';
  }
  return raw;
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
        <SectionLabel>LaTeX source</SectionLabel>
        <CardBody className="mt-1 leading-relaxed">
          LaTeX artifacts are shown as raw source so the entire file remains visible and copyable.
        </CardBody>
      </div>
      <CodeBlock>{artifact.content}</CodeBlock>
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
  const [reloadToken, setReloadToken] = useState(0);
  const activeArtifactId = searchParams.get(ARTIFACT_PARAM) ?? null;

  useEffect(() => {
    const subscription = pa.ui.subscribeInvalidations((event) => {
      if (event.topics.includes('artifacts')) setReloadToken((current) => current + 1);
    });
    return () => subscription.unsubscribe();
  }, [pa.ui]);

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
  }, [context.conversationId, pa.extension, reloadToken]);

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
  else if (artifacts.length === 0) content = <PanelMessage>No artifacts in this conversation.</PanelMessage>;
  else {
    content = (
      <div className="flex flex-col gap-1.5">
        {artifacts.map((artifact) => {
          const selected = artifact.id === activeArtifactId;
          return (
            <ResourceListItem
              key={artifact.id}
              onClick={() => handleOpenArtifact(artifact.id)}
              selected={selected}
              label={artifact.title}
              meta={artifactTypeLabel(artifact)}
              detail={artifact.id}
              title={`${artifact.title} · ${artifact.id} · rev ${artifact.revision}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-2">
        <SectionLabel>Artifacts</SectionLabel>
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
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const copyResetTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const subscription = pa.ui.subscribeInvalidations((event) => {
      if (event.topics.includes('artifacts')) setReloadToken((current) => current + 1);
    });
    return () => subscription.unsubscribe();
  }, [pa.ui]);

  useEffect(() => {
    if (!context.conversationId || !artifactId) {
      setArtifact(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCopyError(null);
    setDeleteError(null);
    setCopied(false);
    setDeleting(false);
    pa.extension
      .invoke('artifact', { action: 'get', conversationId: context.conversationId, artifactId })
      .then((result) => {
        if (!cancelled) setArtifact(readArtifactRecord(result));
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(formatArtifactLoadError(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId, context.conversationId, pa.extension, reloadToken]);

  if (!context.conversationId || !artifactId) {
    return (
      <CenteredMessage eyebrow="Workbench" title="Open an artifact" body="Open an artifact from the transcript to inspect it in a tab." />
    );
  }

  async function copySource() {
    if (!artifact) return;
    setCopyError(null);
    try {
      const desktopBridge = getDesktopBridge();
      if (desktopBridge) {
        const result = await desktopBridge.writeClipboardText(artifact.content);
        if (!result.ok) {
          throw new Error(result.error || 'Copy to clipboard failed.');
        }
      } else {
        if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
          throw new Error('Clipboard access is unavailable.');
        }
        await navigator.clipboard.writeText(artifact.content);
      }
      setCopied(true);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyResetTimeoutRef.current = null;
      }, 1200);
    } catch (error) {
      setCopied(false);
      setCopyError('Could not copy artifact source. Use the visible source text instead.');
    }
  }

  async function deleteArtifact() {
    if (!artifact || !context.conversationId || deleting) return;
    const confirmed = window.confirm(`Delete artifact "${artifact.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      const result = await pa.extension.invoke('artifact', {
        action: 'delete',
        conversationId: context.conversationId,
        artifactId: artifact.id,
      });
      const deleted = isRecord(result) && result.deleted === true;
      setArtifact(null);
      setError(deleted ? 'This artifact was deleted.' : 'This artifact was already deleted.');
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete(ARTIFACT_PARAM);
        return next;
      });
    } catch (error) {
      setDeleteError('Could not delete artifact.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <div className="shrink-0 border-b border-border-subtle px-4 py-2.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0 flex flex-1 items-center gap-2.5">
            <MetaLabel>{artifact ? artifactTypeLabel(artifact) : 'artifact'}</MetaLabel>
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
            {artifact ? (
              <span className="hidden shrink-0 text-[11px] text-dim sm:inline">
                {artifactDetailLabel(artifact)} · rev {artifact.revision}
              </span>
            ) : null}
          </div>
          {artifact ? (
            <div className="flex shrink-0 items-center gap-2">
              {copyError || deleteError ? (
                <span className="max-w-[240px] truncate text-[11px] text-danger">{copyError ?? deleteError}</span>
              ) : null}
              <ToolbarButton onClick={() => void copySource()} className="shrink-0 px-2 py-1 text-[10px]">
                {copied ? 'copied' : artifact.kind === 'latex' ? 'copy latex' : 'copy source'}
              </ToolbarButton>
              <ToolbarButton onClick={() => void deleteArtifact()} disabled={deleting} className="shrink-0 px-2 py-1 text-[10px]">
                {deleting ? 'deleting' : 'delete'}
              </ToolbarButton>
            </div>
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
