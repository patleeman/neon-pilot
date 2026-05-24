import { useCallback, useEffect, useRef } from 'react';

import { useAppEvents } from '../../app/contexts';
import { api } from '../../client/api';
import { useApi } from '../../hooks/useApi';
import { CheckpointDiffSection } from '../checkpoints/CheckpointDiffView';
import { cx, ErrorState, LoadingState } from '../ui';
const INLINE_DIFF_HEIGHT = 'clamp(20rem, 56vh, 44rem)';

export function CheckpointInlineDiff({ conversationId, checkpointId }: { conversationId?: string | null; checkpointId: string }) {
  const { versions } = useAppEvents();
  const previewEnabled = Boolean(conversationId?.trim());
  const previousCheckpointIdRef = useRef(checkpointId);
  const lastCheckpointVersionRef = useRef(versions.checkpoints);

  const fetchPreview = useCallback(async () => {
    if (!previewEnabled || !conversationId) {
      return null;
    }

    return api.conversationCheckpoint(conversationId, checkpointId);
  }, [checkpointId, conversationId, previewEnabled]);

  const { data, loading, error, refetch } = useApi(
    fetchPreview,
    previewEnabled ? `${conversationId}:checkpoint-inline:${checkpointId}` : `checkpoint-inline:${checkpointId}:disabled`,
  );

  useEffect(() => {
    if (previousCheckpointIdRef.current === checkpointId) {
      return;
    }

    previousCheckpointIdRef.current = checkpointId;
  }, [checkpointId]);

  useEffect(() => {
    if (!previewEnabled) {
      lastCheckpointVersionRef.current = versions.checkpoints;
      return;
    }

    if (versions.checkpoints === lastCheckpointVersionRef.current) {
      return;
    }

    lastCheckpointVersionRef.current = versions.checkpoints;
    void refetch({ resetLoading: false });
  }, [previewEnabled, refetch, versions.checkpoints]);

  if (!previewEnabled) {
    return null;
  }

  const checkpoint = data?.checkpoint ?? null;
  const hasFiles = (checkpoint?.files.length ?? 0) > 0;

  return (
    <div className="mt-3 border-t border-border-subtle/50 pt-2">
      <div
        className={cx('relative overflow-hidden rounded-lg bg-base/40', hasFiles && 'border border-border-subtle/60')}
        style={{ height: INLINE_DIFF_HEIGHT }}
      >
        {loading && !checkpoint ? (
          <LoadingState label="Loading diff…" className="h-full justify-center" />
        ) : error || !checkpoint ? (
          <ErrorState message={error || 'Couldn’t load the inline diff preview.'} className="m-3" />
        ) : checkpoint.files.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-[13px] text-secondary">
            No changed files were captured for this checkpoint.
          </div>
        ) : (
          <div className="h-full overflow-auto overscroll-contain">
            {checkpoint.files.map((file) => (
              <CheckpointDiffSection key={`${file.path}:${file.previousPath ?? ''}`} file={file} view="unified" stickyHeader />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
