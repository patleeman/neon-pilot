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

interface ExtensionTelemetryRecordOptions {
  extensionId?: string;
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
