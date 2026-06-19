function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/telemetry must be resolved by the Neon Pilot host runtime.');
}

export type ExtensionTelemetrySource = 'server' | 'renderer' | 'agent' | 'system';

export interface ExtensionTelemetryEventInput {
  source?: ExtensionTelemetrySource;
  category: string;
  name: string;
  sessionId?: string;
  runId?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  count?: number;
  value?: number;
  metadata?: Record<string, unknown>;
}

export interface ExtensionTelemetryRecordOptions {
  extensionId?: string;
}

export type TraceTelemetryLogEventType =
  | 'stats'
  | 'tool_call'
  | 'context'
  | 'compaction'
  | 'auto_mode'
  | 'suggested_context'
  | 'context_pointer_inspect';

export interface TraceTelemetryLogEvent {
  schemaVersion: 1;
  id: string;
  ts: string;
  type: TraceTelemetryLogEventType;
  sessionId: string;
  runId: string | null;
  profile: string;
  payload: Record<string, unknown>;
}

export interface AppTelemetryEventRow {
  id: string;
  ts: string;
  source: string;
  category: string;
  name: string;
  sessionId: string | null;
  runId: string | null;
  route: string | null;
  status: number | null;
  durationMs: number | null;
  count: number | null;
  value: number | null;
  metadataJson: string | null;
}

export const recordTelemetryEvent = (_event: ExtensionTelemetryEventInput, _options?: ExtensionTelemetryRecordOptions): unknown =>
  hostResolved();

export const readTraceTelemetryEvents = (
  _input: { since: string; limit?: number },
): Promise<TraceTelemetryLogEvent[]> => hostResolved();

export const queryAppTelemetryEvents = (
  _input: { since: string; limit?: number },
): Promise<AppTelemetryEventRow[]> => hostResolved();
