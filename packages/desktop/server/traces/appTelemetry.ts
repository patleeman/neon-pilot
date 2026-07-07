import type { DesktopRootLayout } from '@neon-pilot/core';
import { type AppTelemetryEventInput, writeAppTelemetryEvent } from '@neon-pilot/core';

const MAX_QUEUE_SIZE = 1000;
const FLUSH_BATCH_SIZE = 25;
const NOISY_EVENT_SAMPLE_MS = 5000;
const NOISY_INVALIDATE_SAMPLE_MS = 1000;

interface QueuedAppTelemetryEvent {
  event: AppTelemetryEventInput;
  layout?: DesktopRootLayout;
}

let queue: QueuedAppTelemetryEvent[] = [];
let flushScheduled = false;
const lastNoisyEventAtMs = new Map<string, number>();

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(flushAppTelemetryQueue, 0).unref?.();
}

export function flushAppTelemetryQueue(): void {
  flushScheduled = false;
  const batch = queue.splice(0, FLUSH_BATCH_SIZE);
  for (const { event, layout } of batch) {
    writeAppTelemetryEvent(layout ? { ...event, layout } : event);
  }
  if (queue.length > 0) scheduleFlush();
}

function readNoisyEventKey(event: AppTelemetryEventInput): { key: string; sampleMs: number } | null {
  if (event.source === 'server' && event.category === 'extension_action' && event.metadata?.ok === true) {
    const extensionId = typeof event.metadata.extensionId === 'string' ? event.metadata.extensionId : '';
    return { key: `extension_action:${extensionId}:${event.name}`, sampleMs: NOISY_EVENT_SAMPLE_MS };
  }

  if (event.source === 'server' && event.category === 'durable_run' && event.name === 'list') {
    return { key: 'durable_run:list', sampleMs: NOISY_EVENT_SAMPLE_MS };
  }

  if (event.source === 'server' && event.category === 'app_event' && event.name === 'invalidate') {
    const topics = Array.isArray(event.metadata?.topics) ? event.metadata.topics.join(',') : String(event.metadata?.topics ?? '');
    return { key: `app_event:invalidate:${topics}`, sampleMs: NOISY_INVALIDATE_SAMPLE_MS };
  }

  return null;
}

function shouldSampleNoisyEvent(event: AppTelemetryEventInput): boolean {
  const noisy = readNoisyEventKey(event);
  if (!noisy) return true;
  const now = Date.now();
  const previous = lastNoisyEventAtMs.get(noisy.key) ?? 0;
  if (now - previous < noisy.sampleMs) return false;
  lastNoisyEventAtMs.set(noisy.key, now);
  return true;
}

export function persistAppTelemetryEvent(event: AppTelemetryEventInput, layout?: DesktopRootLayout): void {
  try {
    if (!shouldSampleNoisyEvent(event)) return;
    if (queue.length >= MAX_QUEUE_SIZE) {
      writeAppTelemetryEvent({ source: 'system', category: 'telemetry', name: 'queue_drop', count: queue.length });
      queue = queue.slice(queue.length - Math.floor(MAX_QUEUE_SIZE / 2));
    }
    queue.push({ event, layout });
    scheduleFlush();
  } catch {
    // Telemetry must never affect app behavior.
  }
}
