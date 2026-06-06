import './components/knowledge.css';

import { type MemoryDocItem, type MentionItem } from '@neon-pilot/extensions/data';
import {
  AppPageEmptyState,
  AppPageIntro,
  AppPageLayout,
  CenteredLoadingState,
  CenteredMessage,
  type ExtensionSurfaceProps,
  MetaLabel,
  SectionLabel,
  SurfacePanel,
  lazyRouteWithRecovery,
  useApi,
} from '@neon-pilot/extensions/ui';
import { Suspense, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { KnowledgeSettingsPanel as KnowledgeSettingsPanelComponent } from './components/KnowledgeSettingsPanel';
import { knowledgeApi } from './lib/knowledgeApi';
import { navigateKnowledgeFile } from './lib/knowledgeNavigation';

const LazyKnowledgeFileTree = lazyRouteWithRecovery('system-knowledge-file-tree', async () => {
  const module = await import('./components/KnowledgeFileTree');
  return { default: module.KnowledgeFileTree };
});
const LazyKnowledgeEditor = lazyRouteWithRecovery('system-knowledge-editor', async () => {
  const module = await import('./components/KnowledgeEditor');
  return { default: module.KnowledgeEditor };
});

function getKnowledgeFileId(search: string): string | null {
  return new URLSearchParams(search).get('file');
}

export function KnowledgeSettingsPanel() {
  return <KnowledgeSettingsPanelComponent apiClient={knowledgeApi} />;
}

export function KnowledgeTreePanel({ pa }: ExtensionSurfaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFileId = getKnowledgeFileId(searchParams.toString());
  const handleFileSelect = useCallback(
    (id: string) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('artifact');
        next.delete('checkpoint');
        next.delete('run');
        next.delete('workspaceFile');
        next.set('file', id);
        return next;
      });
    },
    [setSearchParams],
  );

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <Suspense fallback={<CenteredLoadingState />}>
        <LazyKnowledgeFileTree
          activeFileId={activeFileId}
          onFileSelect={handleFileSelect}
          confirm={(options) => pa.ui.confirm(options)}
          onSyncKnowledgeBase={() => pa.extension.invoke('sync', {}).catch(() => {})}
        />
      </Suspense>
    </div>
  );
}

export function KnowledgePageSurface() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFileId = searchParams.get('file') ?? null;
  const { data: knowledgeBaseState, loading: knowledgeBaseLoading } = useApi(knowledgeApi.state, 'knowledge-page-knowledge-base');
  const handleFileNavigate = useCallback(
    (id: string) => {
      navigateKnowledgeFile(setSearchParams, id);
    },
    [setSearchParams],
  );
  const handleFileRenamed = useCallback(
    (oldId: string, newId: string) => {
      if (activeFileId === oldId) {
        navigateKnowledgeFile(setSearchParams, newId, { replace: true });
      }
    },
    [activeFileId, setSearchParams],
  );

  const fileName = activeFileId ? activeFileId.split('/').filter(Boolean).pop() : undefined;

  if (knowledgeBaseLoading && !knowledgeBaseState) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="flex min-h-full flex-col gap-10">
          <AppPageIntro title="Knowledge" summary="Durable notes, skills, and project context for the agent." />
          <AppPageEmptyState align="start" title="Loading knowledge base…" body="Checking whether managed sync is enabled." />
        </AppPageLayout>
      </div>
    );
  }

  if (knowledgeBaseState?.configured === false) {
    return (
      <div className="h-full overflow-y-auto">
        <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="flex min-h-full flex-col gap-10">
          <AppPageIntro title="Knowledge" summary="Durable notes, skills, and project context for the agent." />
          <section className="grid w-full gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="space-y-7">
              <div className="space-y-3">
                <MetaLabel tone="accent" className="font-semibold">
                  Set Up Knowledge
                </MetaLabel>
                <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.02em] text-primary text-balance">
                  Give the agent a durable memory.
                </h2>
                <p className="max-w-2xl text-[14px] leading-7 text-secondary">
                  Knowledge is a git-backed folder for notes, skills, project context, and instructions. Neon Pilot clones the repo locally,
                  watches for edits, and syncs changes in the background. Less ceremony, more brain.
                </p>
              </div>

              <SurfacePanel className="p-5">
                <KnowledgeSettingsPanelComponent variant="onboarding" />
              </SurfacePanel>
            </div>

            <aside className="space-y-5 border-t border-border-subtle pt-5 lg:border-t-0 lg:pt-0">
              <SectionLabel tone="muted">On this page</SectionLabel>
              <div className="space-y-3 text-[13px] leading-6 text-secondary">
                <div>
                  <h3 className="text-[13px] font-semibold text-primary">What Goes In Here</h3>
                  <p className="mt-1">Reusable skills, durable notes, project docs, and instructions the agent should actually remember.</p>
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-primary">How Sync Works</h3>
                  <p className="mt-1">
                    Git is the backing store. Neon Pilot keeps a local mirror under runtime state and reads files from that mirror.
                  </p>
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-primary">Already Have One?</h3>
                  <p className="mt-1">Paste the clone URL. Empty repo is fine too — Neon Pilot will populate it as you build memory.</p>
                </div>
              </div>
            </aside>
          </section>
        </AppPageLayout>
      </div>
    );
  }

  if (activeFileId) {
    return (
      <Suspense fallback={<CenteredLoadingState />}>
        <LazyKnowledgeEditor
          fileId={activeFileId}
          fileName={fileName}
          onFileNavigate={handleFileNavigate}
          onFileRenamed={handleFileRenamed}
          hideFileMeta
        />
      </Suspense>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="flex min-h-full flex-col gap-10">
        <AppPageIntro title="Knowledge" summary="Durable notes, skills, and project context for the agent." />
        <AppPageEmptyState
          align="start"
          title="Select a file to start editing"
          body="Pick a note from the Knowledge tree, or import a URL into the knowledge base."
        />
      </AppPageLayout>
    </div>
  );
}

export function KnowledgeFilePanel({ context }: ExtensionSurfaceProps) {
  const [, setSearchParams] = useSearchParams();
  const activeFileId = getKnowledgeFileId(context.search);
  const fileName = activeFileId ? activeFileId.split('/').filter(Boolean).pop() : undefined;
  const handleFileNavigate = useCallback(
    (id: string) => {
      navigateKnowledgeFile(setSearchParams, id);
    },
    [setSearchParams],
  );
  const handleFileRenamed = useCallback(
    (oldId: string, newId: string) => {
      if (activeFileId === oldId) {
        navigateKnowledgeFile(setSearchParams, newId, { replace: true });
      }
    },
    [activeFileId, setSearchParams],
  );
  const handleFileClose = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('file');
      return next;
    });
  }, [setSearchParams]);

  if (!activeFileId) {
    return (
      <CenteredMessage
        eyebrow="Workbench"
        title="Open a knowledge file"
        body="Pick a file from the Knowledge tree to keep it beside the transcript."
      />
    );
  }

  return (
    <Suspense fallback={<CenteredLoadingState />}>
      <LazyKnowledgeEditor
        fileId={activeFileId}
        fileName={fileName}
        onFileNavigate={handleFileNavigate}
        onFileRenamed={handleFileRenamed}
        onClose={handleFileClose}
        hideFileMeta
      />
    </Suspense>
  );
}

function quickOpenFileTitle(name: string): string {
  return name.replace(/\.md$/i, '');
}

function quickOpenFileLocation(id: string): string | undefined {
  const parts = id.split('/').slice(0, -1).filter(Boolean);
  return parts.length > 0 ? parts.join('/') : undefined;
}

function quickOpenExcerpt(value: string | undefined, maxLength = 140): string | undefined {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export const knowledgeQuickOpenProvider = {
  async list() {
    const result = await knowledgeApi.listFiles();
    return result.files
      .filter((file) => file.kind === 'file' && file.name.endsWith('.md'))
      .map((file, index) => ({
        id: `knowledge-file:${file.id}`,
        title: quickOpenFileTitle(file.name),
        subtitle: quickOpenFileLocation(file.id),
        meta: file.id,
        keywords: [file.id, file.name, file.path],
        order: index,
        action: { kind: 'openFile', fileId: file.id },
      }));
  },
  async search(query: string, limit: number) {
    const result = await knowledgeApi.search(query, limit);
    return result.results.map((file, index) => ({
      id: `knowledge-file-search:${file.id}`,
      title: quickOpenFileTitle(file.name),
      subtitle: quickOpenFileLocation(file.id),
      meta: quickOpenExcerpt(file.excerpt) ?? file.id,
      keywords: [file.id, file.name, file.excerpt],
      order: index,
      action: { kind: 'openFile', fileId: file.id },
    }));
  },
};

export async function buildKnowledgeMentionItems(input: { memoryDocs: MemoryDocItem[] }): Promise<MentionItem[]> {
  const knowledgeFiles = await knowledgeApi.listFiles();
  return [
    ...input.memoryDocs.map((doc) => ({
      id: `@${doc.id}`,
      label: doc.id,
      kind: 'note' as const,
      title: doc.title,
      summary: doc.summary,
      path: doc.path,
    })),
    ...knowledgeFiles.files.map((file) => ({
      id: `@${file.id}`,
      label: file.id,
      kind: (file.kind === 'folder' ? 'folder' : 'file') as const,
      title: file.name,
      summary: file.path,
      path: file.path,
    })),
  ];
}
