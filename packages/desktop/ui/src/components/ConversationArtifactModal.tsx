import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import { getConversationArtifactIdFromSearch, setConversationArtifactIdInSearch } from '../conversation/conversationArtifacts';
import { writeClipboardText } from '../desktop/clipboard';
import { useApi } from '../hooks/useApi';
import { formatDate } from '../shared/utils';
import { ConversationArtifactViewer } from './ConversationArtifactViewer';
import { addNotification } from './notifications/notificationStore';
import { CodeBlock, ErrorState, IconButton, LoadingState, MetaLabel, RowButton, SectionLabel, TabButton } from './ui';

function formatArtifactLoadError(error: string | null): string | null {
  if (!error) {
    return null;
  }

  return /Artifact not found/i.test(error) ? 'Artifact not found.' : error;
}

const ICON_PATHS = {
  check: 'M20 6 9 17l-5-5',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  copy: 'M8 8h10v12H8zM6 16H4V4h12v2',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff:
    'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a17.9 17.9 0 0 1-3.1 4.4M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8c1.4 0 2.7-.4 3.8-1',
  maximize: 'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
  minimize: 'M8 3v5H3M16 3v5h5M21 16h-5v5M3 16h5v5',
  x: 'M6 6l12 12M18 6 6 18',
};

function ToolbarIcon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export function ConversationArtifactModal({ conversationId, artifactId }: { conversationId: string; artifactId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { versions } = useAppEvents();
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const artifactFetcher = useCallback(() => api.conversationArtifact(conversationId, artifactId), [artifactId, conversationId]);
  const listFetcher = useCallback(() => api.conversationArtifacts(conversationId), [conversationId]);
  const {
    data: artifactData,
    loading,
    error,
    refetch,
  } = useApi(artifactFetcher, `${conversationId}:${artifactId}`, { notifyOnError: false });
  const { data: artifactListData, refetch: refetchList } = useApi(listFetcher, `${conversationId}:artifacts`);

  useEffect(() => {
    setShowSource(false);
    setCopied(false);
  }, [artifactId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const closeArtifact = useCallback(() => {
    navigate({
      pathname: location.pathname,
      search: setConversationArtifactIdInSearch(location.search, null),
    });
  }, [location.pathname, location.search, navigate]);

  const openArtifact = useCallback(
    (nextArtifactId: string) => {
      navigate({
        pathname: location.pathname,
        search: setConversationArtifactIdInSearch(location.search, nextArtifactId),
      });
    },
    [location.pathname, location.search, navigate],
  );

  const closeArtifactRef = useRef(closeArtifact);
  closeArtifactRef.current = closeArtifact;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeArtifactRef.current();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    void refetch({ resetLoading: false });
    void refetchList({ resetLoading: false });
  }, [refetch, refetchList, versions.artifacts]);

  const artifact = artifactData?.artifact ?? null;
  const artifacts = artifactListData?.artifacts ?? [];
  const artifactError = formatArtifactLoadError(error);

  async function copySource() {
    if (!artifact) {
      return;
    }

    try {
      await writeClipboardText(artifact.content);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Copy failed',
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const selectedArtifactId = getConversationArtifactIdFromSearch(location.search);

  return (
    <div
      className="ui-overlay-backdrop"
      style={{ background: 'rgb(0 0 0 / 0.55)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeArtifact();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conversation artifact"
        className="ui-dialog-shell"
        style={
          expanded
            ? { width: 'calc(100vw - 1rem)', height: 'calc(100vh - 1rem)', maxHeight: 'calc(100vh - 1rem)' }
            : { width: 'min(1600px, calc(100vw - 2rem))', height: 'min(92vh, 1100px)', maxHeight: 'calc(100vh - 2rem)' }
        }
      >
        <div className="border-b border-border-subtle px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex flex-1 items-center gap-2.5">
              <MetaLabel>{artifact?.kind ?? 'artifact'}</MetaLabel>
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
            <div className="flex shrink-0 items-center gap-1.5">
              {artifact ? (
                <>
                  <IconButton
                    compact
                    onClick={() => {
                      void copySource();
                    }}
                    aria-label={copied ? 'Copied' : artifact.kind === 'latex' ? 'Copy LaTeX' : 'Copy source'}
                    title={copied ? 'Copied' : artifact.kind === 'latex' ? 'Copy LaTeX' : 'Copy source'}
                  >
                    <ToolbarIcon name={copied ? 'check' : 'copy'} />
                  </IconButton>
                  {artifact.kind !== 'latex' ? (
                    <IconButton
                      compact
                      onClick={() => setShowSource((current) => !current)}
                      aria-label={showSource ? 'Hide source' : 'Show source'}
                      title={showSource ? 'Hide source' : 'Show source'}
                    >
                      <ToolbarIcon name={showSource ? 'eyeOff' : 'code'} />
                    </IconButton>
                  ) : null}
                </>
              ) : null}
              <IconButton
                compact
                onClick={() => setExpanded((current) => !current)}
                aria-label={expanded ? 'Restore' : 'Fullscreen'}
                title={expanded ? 'Restore' : 'Fullscreen'}
              >
                <ToolbarIcon name={expanded ? 'minimize' : 'maximize'} />
              </IconButton>
              <IconButton compact onClick={closeArtifact} aria-label="Close" title="Close">
                <ToolbarIcon name="x" />
              </IconButton>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex flex-1 overflow-hidden">
          {artifacts.length > 1 ? (
            <div className="hidden w-72 shrink-0 border-r border-border-subtle bg-base/40 lg:flex lg:flex-col">
              <div className="border-b border-border-subtle px-4 py-3">
                <SectionLabel>Artifacts</SectionLabel>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                <div className="flex flex-col gap-1.5">
                  {artifacts.map((item) => {
                    const selected = item.id === selectedArtifactId;
                    return (
                      <RowButton key={item.id} onClick={() => openArtifact(item.id)} selected={selected} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[12px] font-medium">{item.title}</span>
                          <MetaLabel tone="muted">{item.kind}</MetaLabel>
                        </div>
                        <div className="mt-0.5 text-[10px] text-dim font-mono">{item.id}</div>
                      </RowButton>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex flex-1 flex-col overflow-hidden bg-base">
            {artifacts.length > 1 ? (
              <div className="border-b border-border-subtle px-4 py-2.5 lg:hidden">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {artifacts.map((item) => {
                    const selected = item.id === selectedArtifactId;
                    return (
                      <TabButton key={item.id} onClick={() => openArtifact(item.id)} active={selected} className="shrink-0">
                        {item.title}
                      </TabButton>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-hidden">
              {loading && !artifact ? (
                <LoadingState label="Loading artifact…" className="justify-center h-full" />
              ) : artifactError || !artifact ? (
                <ErrorState message={artifactError || 'Artifact not found.'} className="px-4 py-4" />
              ) : (
                <ConversationArtifactViewer artifact={artifact} />
              )}
            </div>

            {showSource && artifact && artifact.kind !== 'latex' ? (
              <div className="max-h-[38%] overflow-auto border-t border-border-subtle px-4 py-3">
                <SectionLabel>Source</SectionLabel>
                <CodeBlock compact className="mt-2 border-0 bg-transparent p-0 text-secondary">
                  {artifact.content}
                </CodeBlock>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
