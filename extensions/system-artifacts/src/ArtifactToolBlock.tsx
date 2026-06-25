import { timeAgo } from '@neon-pilot/extensions/data';
import { cx, InlineMeta, Pill, Spinner, TextButton, ToolResultCard } from '@neon-pilot/extensions/ui';
import { memo } from 'react';

interface ArtifactMetadata {
  type?: string;
  stylePreset?: string;
}

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

function labelFromSlug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function artifactTypeLabel(artifact: { kind?: string; metadata?: ArtifactMetadata }): string {
  const type = artifact.metadata?.type;
  return type ? (ARTIFACT_TYPE_LABELS[type] ?? labelFromSlug(type)) : (artifact.kind ?? 'artifact');
}

export const ArtifactToolBlock = memo(function ArtifactToolBlock({
  block,
  artifact,
  onOpenArtifact,
  activeArtifactId,
}: {
  block: { status?: string; running?: boolean; error?: boolean | string; output?: string };
  artifact: { artifactId?: string; title?: string; kind?: string; metadata?: ArtifactMetadata; revision?: number; updatedAt?: string };
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
            {artifactTypeLabel(artifact)}
          </Pill>
          {artifact.metadata?.stylePreset && <InlineMeta>{labelFromSlug(artifact.metadata.stylePreset)}</InlineMeta>}
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
