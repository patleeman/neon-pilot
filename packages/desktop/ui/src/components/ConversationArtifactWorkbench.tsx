import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import { writeClipboardText } from '../desktop/clipboard';
import type { ConversationArtifactRecord, ConversationArtifactSummary } from '../shared/types';
import { formatDate } from '../shared/utils';
import { useConversationArtifactSummaries } from './conversationArtifactHooks';
import { ConversationArtifactViewer } from './ConversationArtifactViewer';
import { addNotification } from './notifications/notificationStore';
import { ErrorState, LoadingState, ResourceListItem, SectionLabel } from './ui';

export { useConversationArtifactSummaries };

export function ConversationArtifactRailContent({
  artifacts,
  activeArtifactId,
  loading,
  error,
  onOpenArtifact,
}: {
  artifacts: ConversationArtifactSummary[];
  activeArtifactId: string | null;
  loading: boolean;
  error: string | null;
  onOpenArtifact: (artifactId: string) => void;
}) {
  let content: ReactNode;

  if (loading && artifacts.length === 0) {
    content = <LoadingState label="Loading artifacts…" className="justify-center h-full" />;
  } else if (error && artifacts.length === 0) {
    content = <ErrorState message={error} className="px-4 py-4" />;
  } else if (artifacts.length === 0) {
    content = <div className="px-4 py-3 text-[12px] text-dim">No artifacts in this conversation.</div>;
  } else {
    content = (
      <div className="flex flex-col gap-1.5">
        {artifacts.map((artifact) => {
          const selected = artifact.id === activeArtifactId;
          return (
            <ResourceListItem
              key={artifact.id}
              onClick={() => onOpenArtifact(artifact.id)}
              selected={selected}
              label={artifact.title}
              meta={artifact.kind}
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

function formatArtifactLoadError(error: string | null): string | null {
  if (!error) {
    return null;
  }

  return /Artifact not found/i.test(error) ? 'Artifact not found.' : error;
}

export function ConversationArtifactWorkbenchPane({ conversationId, artifactId }: { conversationId: string; artifactId: string }) {
  const { versions } = useAppEvents();
  const [artifact, setArtifact] = useState<ConversationArtifactRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCopied(false);

    api
      .conversationArtifact(conversationId, artifactId)
      .then((result) => {
        if (!cancelled) {
          setArtifact(result.artifact);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setArtifact(null);
          const rawMessage = err instanceof Error ? err.message : 'Failed to load artifact.';
          const msg = formatArtifactLoadError(rawMessage) ?? rawMessage;
          setError(msg);
          if (!/Artifact not found/i.test(rawMessage)) {
            addNotification({ type: 'error', message: msg, details: err instanceof Error ? err.stack : undefined, source: 'core' });
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId, conversationId, versions.artifacts]);

  const copySource = useCallback(async () => {
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
  }, [artifact]);

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
            <button
              type="button"
              onClick={() => {
                void copySource();
              }}
              className="ui-toolbar-button shrink-0 px-2 py-1 text-[10px]"
            >
              {copied ? 'copied' : artifact.kind === 'latex' ? 'copy latex' : 'copy source'}
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {loading && !artifact ? (
          <LoadingState label="Loading artifact…" className="justify-center h-full" />
        ) : error || !artifact ? (
          <ErrorState message={error || 'Artifact not found.'} className="px-4 py-4" />
        ) : (
          <ConversationArtifactViewer artifact={artifact} />
        )}
      </div>
    </div>
  );
}
