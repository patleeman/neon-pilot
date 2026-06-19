import { callServerModuleExport } from './serverModuleResolver.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendApiGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

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

interface ExtensionTelemetryRecordOptions {
  extensionId?: string;
}

function workerBridge(): ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE] {
  return (globalThis as ExtensionBackendApiGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

export function recordTelemetryEvent(event: ExtensionTelemetryEventInput, options: ExtensionTelemetryRecordOptions = {}): void {
  void (async () => {
    try {
      const extensionId = options.extensionId?.trim();
      if (!extensionId) return;
      await callServerModuleExport<void>(
        '../../extensions/extensionPermissions.js',
        'assertExtensionPermission',
        extensionId,
        'telemetry:write',
        'telemetry.record',
      );
      await callServerModuleExport<void>('../../traces/appTelemetry.js', 'persistAppTelemetryEvent', {
        ...event,
        source: event.source ?? 'server',
        metadata: { ...(event.metadata ?? {}), extensionId },
      });
    } catch {
      // Telemetry must never affect app behavior.
    }
  })();
}

function clampTelemetryLimit(limit: number | undefined, fallback: number, max: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(Math.trunc(limit), max));
}

function requireTelemetryBridge(): NonNullable<ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE]> {
  const bridge = workerBridge();
  if (!bridge) throw new Error('Telemetry reads require an active extension host capability bridge.');
  return bridge;
}

export async function readTraceTelemetryEvents(input: { since: string; limit?: number }): Promise<TraceTelemetryLogEvent[]> {
  return requireTelemetryBridge()('telemetry', 'readTrace', {
    since: input.since,
    limit: clampTelemetryLimit(input.limit, 50_000, 100_000),
  }) as Promise<TraceTelemetryLogEvent[]>;
}

export async function queryAppTelemetryEvents(input: { since: string; limit?: number }): Promise<AppTelemetryEventRow[]> {
  return requireTelemetryBridge()('telemetry', 'queryApp', {
    since: input.since,
    limit: clampTelemetryLimit(input.limit, 200, 1000),
  }) as Promise<AppTelemetryEventRow[]>;
}
