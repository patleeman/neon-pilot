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

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<Record<string, unknown>>;

export function recordTelemetryEvent(event: ExtensionTelemetryEventInput): void {
  void (async () => {
    try {
      const appTelemetry = await dynamicImport('../../traces/appTelemetry.js');
      const persist = appTelemetry.persistAppTelemetryEvent;
      if (typeof persist === 'function') {
        persist({ ...event, source: event.source ?? 'server' });
      }
    } catch {
      // Telemetry must never affect app behavior.
    }
  })();
}
