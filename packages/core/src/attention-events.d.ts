export declare const ATTENTION_EVENTS_STATE_FILE_NAME = 'attention-events-state.json';
export type AttentionEventStatus = 'scheduled' | 'ready' | 'delivering' | 'completed' | 'cancelled' | 'failed';
export type AttentionEventDeliveryMode = 'batchable' | 'sequential' | 'isolated';
export type AttentionEventPriority = 'low' | 'normal' | 'high';
export type AttentionEventBehavior = 'steer' | 'followUp';
export interface AttentionEventSource {
  kind: string;
  id?: string;
  extensionId?: string;
}
export interface AttentionEventContextMessage {
  customType: string;
  content: string;
}
export interface AttentionEventDelivery {
  mode: AttentionEventDeliveryMode;
  priority: AttentionEventPriority;
  requireAck: boolean;
  autoResumeIfOpen: boolean;
  behavior?: AttentionEventBehavior;
  batchKey?: string;
}
export interface AttentionEventRecord {
  id: string;
  conversationId?: string;
  sessionFile: string;
  title?: string;
  prompt: string;
  contextMessages?: AttentionEventContextMessage[];
  source: AttentionEventSource;
  status: AttentionEventStatus;
  dueAt: string;
  createdAt: string;
  readyAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  attempts: number;
  lastError?: string;
  delivery: AttentionEventDelivery;
}
export interface AttentionEventsStateFile {
  version: 1;
  events: Record<string, AttentionEventRecord>;
}
export declare function createEmptyAttentionEventsState(): AttentionEventsStateFile;
export declare function resolveAttentionEventsStateFile(stateRoot?: string): string;
export declare function loadAttentionEventsState(path?: string): AttentionEventsStateFile;
export declare function saveAttentionEventsState(state: AttentionEventsStateFile, path?: string): void;
export declare function withAttentionEventsLock<T>(fn: (state: AttentionEventsStateFile) => T, path?: string): T;
export declare function listAttentionEvents(state: AttentionEventsStateFile): AttentionEventRecord[];
export declare function getSessionAttentionEvents(state: AttentionEventsStateFile, sessionFile: string): AttentionEventRecord[];
export declare function getReadySessionAttentionEvents(state: AttentionEventsStateFile, sessionFile: string): AttentionEventRecord[];
export declare function scheduleAttentionEvent(
  state: AttentionEventsStateFile,
  event: Omit<AttentionEventRecord, 'status' | 'readyAt' | 'deliveredAt' | 'completedAt' | 'cancelledAt' | 'failedAt' | 'delivery'> & {
    delivery?: Partial<AttentionEventDelivery>;
  },
): AttentionEventRecord;
export declare function createReadyAttentionEvent(
  state: AttentionEventsStateFile,
  event: Omit<AttentionEventRecord, 'status' | 'deliveredAt' | 'completedAt' | 'cancelledAt' | 'failedAt' | 'delivery'> & {
    delivery?: Partial<AttentionEventDelivery>;
  },
): AttentionEventRecord;
export declare function activateDueAttentionEvents(
  state: AttentionEventsStateFile,
  input?: { at?: Date; sessionFile?: string },
): AttentionEventRecord[];
export declare function markAttentionEventsDelivering(
  state: AttentionEventsStateFile,
  input: { ids: string[]; deliveredAt?: string },
): AttentionEventRecord[];
export declare function completeAttentionEvents(
  state: AttentionEventsStateFile,
  input: { ids: string[]; completedAt?: string },
): AttentionEventRecord[];
export declare function retryAttentionEvents(
  state: AttentionEventsStateFile,
  input: { ids: string[]; dueAt: string; lastError?: string },
): AttentionEventRecord[];
export declare function cancelAttentionEvent(
  state: AttentionEventsStateFile,
  input: { id: string; cancelledAt?: string },
): AttentionEventRecord | undefined;
export declare function groupAttentionEventsForDelivery(events: AttentionEventRecord[]): AttentionEventRecord[][];
