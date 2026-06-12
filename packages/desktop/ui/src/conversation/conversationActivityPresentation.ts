import type {
  ConversationActivityItem,
  DeferredResumeSummary,
  ExecutionRecord,
  QueuedPromptPreview,
  ScheduledTaskSummary,
} from '../shared/types';

export interface ConversationPendingQueueItem {
  id: string;
  text: string;
  imageCount: number;
  restorable: boolean;
  type: 'steer' | 'followUp';
  queueIndex: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function activityExecutions(items: readonly ConversationActivityItem[]): ExecutionRecord[] {
  return items
    .filter((item) => item.kind === 'execution')
    .map((item) => item.payload)
    .filter((payload): payload is ExecutionRecord => isRecord(payload) && typeof payload.id === 'string');
}

export function activityDeferredResumes(items: readonly ConversationActivityItem[]): DeferredResumeSummary[] {
  return items
    .filter((item) => item.kind === 'deferred-resume')
    .map((item) => item.payload)
    .filter((payload): payload is DeferredResumeSummary => isRecord(payload) && typeof payload.id === 'string');
}

export function activityScheduledTasks(items: readonly ConversationActivityItem[]): ScheduledTaskSummary[] {
  return items
    .filter((item) => item.kind === 'scheduled-task')
    .map((item) => item.payload)
    .filter((payload): payload is ScheduledTaskSummary => isRecord(payload) && typeof payload.id === 'string');
}

export function activityQueuedPrompts(items: readonly ConversationActivityItem[]): ConversationPendingQueueItem[] {
  return items
    .filter((item) => item.kind === 'queued-prompt')
    .map((item) => {
      const payload = isRecord(item.payload) ? item.payload : {};
      const type = payload.type === 'steer' ? 'steer' : 'followUp';
      const queueIndex = typeof payload.queueIndex === 'number' && Number.isSafeInteger(payload.queueIndex) ? payload.queueIndex : 0;
      const preview: QueuedPromptPreview = {
        id: typeof payload.id === 'string' ? payload.id : item.source.id,
        text: typeof payload.text === 'string' ? payload.text : item.subtitle ?? '',
        imageCount: typeof payload.imageCount === 'number' && Number.isSafeInteger(payload.imageCount) ? payload.imageCount : 0,
        restorable: payload.restorable === false ? false : true,
      };
      return {
        id: preview.id,
        text: preview.text,
        imageCount: preview.imageCount,
        restorable: preview.restorable !== false,
        type,
        queueIndex,
      };
    });
}
