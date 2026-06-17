import { callServerModuleExport } from './serverModuleResolver.js';

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

export function recordTelemetryEvent(event: ExtensionTelemetryEventInput): void {
  void (async () => {
    try {
      await callServerModuleExport<void>('../../traces/appTelemetry.js', 'persistAppTelemetryEvent', {
        ...event,
        source: event.source ?? 'server',
      });
    } catch {
      // Telemetry must never affect app behavior.
    }
  })();
}
