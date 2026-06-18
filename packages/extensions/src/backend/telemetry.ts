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

export const recordTelemetryEvent = (_event: ExtensionTelemetryEventInput, _options?: ExtensionTelemetryRecordOptions): unknown =>
  hostResolved();
