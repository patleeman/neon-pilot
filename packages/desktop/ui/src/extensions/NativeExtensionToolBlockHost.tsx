import React, { type ComponentType, lazy, type ReactNode, Suspense, useMemo } from 'react';

import { buildApiPath } from '../client/apiBase';
import { renderMarkdownText } from '../components/chat/MarkdownMessage.js';
import { stripAnsiForTranscript } from '../components/chat/toolPresentation';
import { addNotification } from '../components/notifications/notificationStore';
import { cx, LoadingState, Pill, SurfacePanel } from '../components/ui';
import type { MessageBlock } from '../shared/types';
import type { AskUserQuestionAnswers, AskUserQuestionPresentation } from '../transcript/askUserQuestions';
import { ensureExtensionFrontendReactGlobals } from './extensionFrontendReactGlobals';
import { getExtensionRegistryRevision } from './extensionRegistryEvents';
import { createNativeExtensionClient } from './nativePaClient';
import { systemExtensionModules } from './systemExtensionModules';
import type { ExtensionInstallSummary, ExtensionTranscriptBlockContribution, ExtensionTranscriptRendererContribution } from './types';
import { useExtensionStyles } from './useExtensionStyles';

type ToolBlock = Extract<MessageBlock, { type: 'tool_use' }>;

export interface ExtensionToolBlockContext {
  onOpenArtifact?: (artifactId: string) => void;
  activeArtifactId?: string | null;
  onOpenCheckpoint?: (checkpointId: string) => void;
  activeCheckpointId?: string | null;
  onOpenBrowser?: () => void;
  messages?: MessageBlock[];
  messageIndex?: number;
  onSubmitAskUserQuestion?: (presentation: AskUserQuestionPresentation, answers: AskUserQuestionAnswers) => Promise<void> | void;
  askUserQuestionDisplayMode?: 'inline' | 'composer';
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
}

type ExtensionToolBlockComponent = ComponentType<{
  block: ToolBlock;
  renderer: ExtensionTranscriptRendererContribution;
  context: ExtensionToolBlockContext;
}>;

type ExtensionTranscriptBlock = Extract<MessageBlock, { type: 'context' }>;

type ExtensionTranscriptBlockComponent = ComponentType<{
  pa: ReturnType<typeof createNativeExtensionClient>;
  block: ExtensionTranscriptBlock;
  renderer: ExtensionTranscriptBlockContribution;
  context: { messageIndex?: number; renderMarkdown?: (markdown: string) => ReactNode };
}>;

const BUILTIN_CHECKPOINT_RENDERER: {
  extension: ExtensionInstallSummary;
  renderer: ExtensionTranscriptRendererContribution;
} = {
  extension: {
    id: 'system-diffs',
    name: 'Diffs',
    packageType: 'system',
    enabled: true,
    status: 'enabled',
    manifest: {
      schemaVersion: 2,
      id: 'system-diffs',
      name: 'Diffs',
      packageType: 'system',
      frontend: { entry: 'dist/frontend.js' },
      contributes: {},
    },
    permissions: [],
    surfaces: [],
    routes: [],
  },
  renderer: {
    id: 'checkpoint-tool-block',
    tool: 'checkpoint',
    component: 'CheckpointTranscriptRenderer',
    standalone: true,
  },
};

function loadExtensionModule(extension: ExtensionInstallSummary, revision: number): Promise<Record<string, unknown>> {
  ensureExtensionFrontendReactGlobals();
  const systemLoader = systemExtensionModules.get(extension.id);
  if (systemLoader) return systemLoader();
  const entry = extension.manifest.frontend?.entry;
  if (!entry) throw new Error(`Extension ${extension.id} has no frontend entry.`);
  const source = buildApiPath(
    `/extensions/${encodeURIComponent(extension.id)}/files/${entry.split('/').map(encodeURIComponent).join('/')}?v=${revision}`,
  );
  return import(/* @vite-ignore */ source) as Promise<Record<string, unknown>>;
}

function extensionModuleKey(extension: ExtensionInstallSummary): string {
  return `${extension.id}:${extension.manifest.frontend?.entry ?? ''}:${getExtensionRegistryRevision()}`;
}

function lazyRendererComponent(extension: ExtensionInstallSummary, renderer: ExtensionTranscriptRendererContribution, revision: number) {
  return lazy(async () => {
    const module = await loadExtensionModule(extension, revision);
    const component = module[renderer.component];
    if (typeof component !== 'function') throw new Error(`Extension transcript renderer not found: ${renderer.component}`);
    return { default: component as ExtensionToolBlockComponent };
  });
}

function lazyTranscriptBlockComponent(
  extension: ExtensionInstallSummary,
  renderer: ExtensionTranscriptBlockContribution,
  revision: number,
) {
  return lazy(async () => {
    const module = await loadExtensionModule(extension, revision);
    const component = module[renderer.component];
    if (typeof component !== 'function') throw new Error(`Extension transcript block renderer not found: ${renderer.component}`);
    return { default: component as ExtensionTranscriptBlockComponent };
  });
}

function MissingExtensionRendererFallback({ block }: { block: ToolBlock }) {
  const output = stripAnsiForTranscript(block.output ?? '').trim();
  const isError = block.status === 'error' || !!block.error;

  return (
    <SurfacePanel muted className={cx('px-3 py-2.5 text-[12px]', isError ? 'ui-surface-danger-soft' : 'border-border/60 bg-panel/80')}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Pill tone={isError ? 'danger' : 'muted'} mono>
          {block.tool}
        </Pill>
        <span className="text-dim">Extension renderer unavailable.</span>
      </div>
      {output ? <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-secondary">{output}</pre> : null}
    </SurfacePanel>
  );
}

export function NativeExtensionToolBlockHost({
  extension,
  renderer,
  block,
  context,
}: {
  extension?: ExtensionInstallSummary | null;
  renderer?: ExtensionTranscriptRendererContribution | null;
  block: ToolBlock;
  context: ExtensionToolBlockContext;
}) {
  if ((!extension || !renderer) && block.tool === 'checkpoint') {
    return (
      <NativeExtensionToolBlockHostInner
        extension={BUILTIN_CHECKPOINT_RENDERER.extension}
        renderer={BUILTIN_CHECKPOINT_RENDERER.renderer}
        block={block}
        context={context}
      />
    );
  }

  if (!extension || !renderer) {
    return <MissingExtensionRendererFallback block={block} />;
  }

  return <NativeExtensionToolBlockHostInner extension={extension} renderer={renderer} block={block} context={context} />;
}

function NativeExtensionToolBlockHostInner({
  extension,
  renderer,
  block,
  context,
}: {
  extension: ExtensionInstallSummary;
  renderer: ExtensionTranscriptRendererContribution;
  block: ToolBlock;
  context: ExtensionToolBlockContext;
}) {
  useExtensionStyles(extension.id, extension.manifest.frontend?.styles);

  const moduleKey = extensionModuleKey(extension);
  const Component = useMemo(
    () => lazyRendererComponent(extension, renderer, getExtensionRegistryRevision()),
    [extension, renderer, moduleKey],
  );
  return (
    <Suspense fallback={<LoadingState label="Loading tool…" className="py-3" />}>
      <ExtensionToolBlockErrorBoundary extensionId={extension.id}>
        <Component block={block} renderer={renderer} context={context} />
      </ExtensionToolBlockErrorBoundary>
    </Suspense>
  );
}

class ExtensionToolBlockErrorBoundary extends React.Component<
  { children: React.ReactNode; extensionId: string },
  { message: string | null }
> {
  state = { message: null };
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: unknown, _errorInfo: { componentStack?: string }) {
    const message = error instanceof Error ? error.message : String(error);
    addNotification({
      type: 'error',
      message: `Extension tool block error: ${message}`,
      details: error instanceof Error ? error.stack : undefined,
      source: this.props.extensionId,
    });
  }
  render() {
    return this.state.message ? <ErrorState message={this.state.message} /> : this.props.children;
  }
}
export function NativeExtensionTranscriptBlockHost({
  extension,
  renderer,
  block,
  context,
}: {
  extension: ExtensionInstallSummary;
  renderer: ExtensionTranscriptBlockContribution;
  block: ExtensionTranscriptBlock;
  context: { messageIndex?: number };
}) {
  useExtensionStyles(extension.id, extension.manifest.frontend?.styles);
  const pa = useMemo(() => createNativeExtensionClient(extension.id), [extension.id]);
  const blockContext = useMemo(
    () => ({
      ...context,
      renderMarkdown: (markdown: string) => renderMarkdownText(markdown),
    }),
    [context],
  );
  const moduleKey = extensionModuleKey(extension);
  const Component = useMemo(
    () => lazyTranscriptBlockComponent(extension, renderer, getExtensionRegistryRevision()),
    [extension, renderer, moduleKey],
  );
  return (
    <Suspense fallback={<LoadingState label="Loading transcript block…" className="py-3" />}>
      <ExtensionToolBlockErrorBoundary extensionId={extension.id}>
        <Component pa={pa} block={block} renderer={renderer} context={blockContext} />
      </ExtensionToolBlockErrorBoundary>
    </Suspense>
  );
}
