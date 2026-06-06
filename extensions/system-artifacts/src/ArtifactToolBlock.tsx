import { timeAgo } from '@neon-pilot/extensions/data';
import { cx, InlineMeta, Pill, Spinner, TextButton, ToolResultCard } from '@neon-pilot/extensions/ui';
import { memo } from 'react';

export const ArtifactToolBlock = memo(function ArtifactToolBlock({
  block,
  artifact,
  onOpenArtifact,
  activeArtifactId,
}: {
  block: { status?: string; running?: boolean; error?: boolean | string; output?: string };
  artifact: { artifactId?: string; title?: string; kind?: string; revision?: number; updatedAt?: string };
  onOpenArtifact?: (artifactId: string) => void;
  activeArtifactId?: string | null;
}) {
  const isRunning = block.status === 'running' || !!block.running;
  const isError = block.status === 'error' || !!block.error;
  const isActive = activeArtifactId === artifact.artifactId;
  const actionLabel = isActive ? 'opened' : 'open';

  return (
    <ToolResultCard
      tone={isError ? 'danger' : 'neutral'}
      leading={
        <div className="ui-chat-avatar mt-0.5">
          <span className="ui-chat-avatar-mark">◫</span>
        </div>
      }
      title={artifact.title}
      badges={
        <>
          <Pill tone={isError ? 'danger' : 'accent'} mono>
            {artifact.kind}
          </Pill>
          {artifact.revision !== undefined && <InlineMeta>rev {artifact.revision}</InlineMeta>}
        </>
      }
      meta={<span className="font-mono text-secondary">{artifact.artifactId}</span>}
      body={block.output}
      actions={
        <>
          {isRunning ? (
            <InlineMeta>
              <Spinner />
              saving artifact…
            </InlineMeta>
          ) : (
            <TextButton
              type="button"
              onClick={() => onOpenArtifact?.(artifact.artifactId ?? '')}
              disabled={!onOpenArtifact}
              tone="accent"
              className={cx('disabled:cursor-default disabled:text-dim', isActive && 'text-dim hover:text-dim')}
            >
              {actionLabel}
            </TextButton>
          )}
          {artifact.updatedAt && <InlineMeta>updated {timeAgo(artifact.updatedAt)}</InlineMeta>}
        </>
      }
    />
  );
});
