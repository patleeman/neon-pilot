import { timeAgo } from '@neon-pilot/extensions/data';
import { CardBody, CardMeta, CardTitle, cx, InlineMeta, Pill, Spinner, SurfacePanel, TextButton } from '@neon-pilot/extensions/ui';
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
    <SurfacePanel muted className={cx('px-3.5 py-3 text-[12px] transition-colors', isError && 'border-danger/30 bg-danger/5')}>
      <div className="flex items-start gap-3">
        <div className="ui-chat-avatar mt-0.5">
          <span className="ui-chat-avatar-mark">◫</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle as="span" className="truncate">
              {artifact.title}
            </CardTitle>
            <Pill tone={isError ? 'danger' : 'accent'} mono>
              {artifact.kind}
            </Pill>
            {artifact.revision !== undefined && <CardMeta as="span">rev {artifact.revision}</CardMeta>}
          </div>
          <CardMeta className="mt-1 break-all font-mono text-secondary">{artifact.artifactId}</CardMeta>
          {block.output && !isError && <CardBody className="mt-2 leading-relaxed">{block.output}</CardBody>}
          {isError && block.output && <p className="mt-2 text-[12px] leading-relaxed text-danger/85">{block.output}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
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
          </div>
        </div>
      </div>
    </SurfacePanel>
  );
});
