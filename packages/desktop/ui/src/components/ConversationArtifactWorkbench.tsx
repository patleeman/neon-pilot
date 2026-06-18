import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import { writeClipboardText } from '../desktop/clipboard';
import type { ConversationArtifactRecord, ConversationArtifactSummary } from '../shared/types';
import { formatDate } from '../shared/utils';
import { useConversationArtifactSummaries } from './conversationArtifactHooks';
import { ConversationArtifactViewer } from './ConversationArtifactViewer';
import { addNotification } from './notifications/notificationStore';
import {
  ErrorState,
  LoadingState,
  MetaLabel,
  PanelMessage,
  RailSection,
  ResourceListItem,
  ToolbarButton,
  WorkbenchHeader,
  WorkbenchShell,
} from './ui';

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
    content = <PanelMessage>No artifacts in this conversation.</PanelMessage>;
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

  return <RailSection title="Artifacts">{content}</RailSection>;
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
  const copyResetTimeoutRef = useRef<number | null>(null);

  const clearCopyResetTimeout = useCallback(() => {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearCopyResetTimeout, [clearCopyResetTimeout]);

  useEffect(() => {
    let cancelled = false;
    clearCopyResetTimeout();
    setLoading(true);
    setArtifact(null);
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
    clearCopyResetTimeout();
    copyResetTimeoutRef.current = window.setTimeout(() => {
      copyResetTimeoutRef.current = null;
      setCopied(false);
    }, 1200);
  }, [artifact, clearCopyResetTimeout]);

  const artifactTitle = artifact
    ? `${artifact.title} · ${artifact.id} · rev ${artifact.revision} · updated ${formatDate(artifact.updatedAt)}`
    : artifactId;

  return (
    <WorkbenchShell
      header={
        <WorkbenchHeader
          title={<span title={artifactTitle}>{artifact?.title ?? artifactId}</span>}
          meta={artifact ? <span className="hidden sm:inline">rev {artifact.revision}</span> : null}
          leading={<MetaLabel>{artifact?.kind ?? 'artifact'}</MetaLabel>}
          titleClassName="text-[14px]"
          actions={
            artifact ? (
              <ToolbarButton
                onClick={() => {
                  void copySource();
                }}
                className="shrink-0 px-2 py-1 text-[10px]"
              >
                {copied ? 'copied' : artifact.kind === 'latex' ? 'copy latex' : 'copy source'}
              </ToolbarButton>
            ) : null
          }
        />
      }
    >
      {loading && !artifact ? (
        <LoadingState label="Loading artifact…" className="justify-center h-full" />
      ) : error || !artifact ? (
        <ErrorState message={error || 'Artifact not found.'} className="px-4 py-4" />
      ) : (
        <ConversationArtifactViewer artifact={artifact} />
      )}
    </WorkbenchShell>
  );
}
