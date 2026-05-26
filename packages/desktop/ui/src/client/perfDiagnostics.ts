import { recordRendererTelemetry } from '../telemetry/appTelemetry';

interface PerfApiSample {
  path: string;
  recordedAt: string;
  serverTiming: string | null;
  meta: Record<string, unknown> | null;
}

type ConversationOpenPhase = 'content' | 'rail' | 'extensions';

interface ConversationOpenPhaseSample {
  conversationId: string;
  source: string;
  phase: ConversationOpenPhase;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  meta?: Record<string, unknown>;
}

interface ConversationOpenTracker {
  startedAtMs: number;
  startedAt: string;
  source: string;
  completedPhases: Set<ConversationOpenPhase>;
}

interface ChatRenderSample {
  conversationId: string | null;
  route: string | null;
  recordedAt: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  meta: Record<string, unknown>;
}

interface ClientPerfSample {
  name: string;
  recordedAt: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  route: string | null;
  meta?: Record<string, unknown>;
}

interface RendererLongTaskSample {
  route: string;
  recordedAt: string;
  startTimeMs: number;
  durationMs: number;
  source: 'longtask' | 'event-loop-lag';
  meta?: Record<string, unknown>;
}

interface RendererInteractionSample {
  type: string;
  route: string;
  recordedAt: string;
  timeMs: number;
  target: string | null;
}

interface PerfStore {
  apiSamples: PerfApiSample[];
  conversationOpenSamples: ConversationOpenPhaseSample[];
  chatRenderSamples: ChatRenderSample[];
  clientSamples: ClientPerfSample[];
  longTaskSamples: RendererLongTaskSample[];
  interactionSamples: RendererInteractionSample[];
  extensionRegistryLoading?: boolean;
  extensionRegistryLoadedAt?: string;
  extensionRegistryLoadedAtMs?: number;
  extensionRegistryCounts?: Record<string, number>;
}

const MAX_PERF_SAMPLES = 120;
const CLIENT_PERF_TELEMETRY_MIN_DURATION_MS = 16;
const CHAT_RENDER_TELEMETRY_MIN_DURATION_MS = 16;
const perfStore: PerfStore = {
  apiSamples: [],
  conversationOpenSamples: [],
  chatRenderSamples: [],
  clientSamples: [],
  longTaskSamples: [],
  interactionSamples: [],
};
const conversationOpenTrackers = new Map<string, ConversationOpenTracker>();
let rendererBlockTelemetryStarted = false;
publishPerfStore();

function appendSample<T>(samples: T[], sample: T): void {
  samples.push(sample);
  while (samples.length > MAX_PERF_SAMPLES) {
    samples.shift();
  }
}

function getGlobalPerfTarget(): { __NEON_PILOT_APP_PERF__?: PerfStore } {
  return globalThis as { __NEON_PILOT_APP_PERF__?: PerfStore };
}

function publishPerfStore(): void {
  getGlobalPerfTarget().__NEON_PILOT_APP_PERF__ = perfStore;
}

function shouldLogPerfSamples(): boolean {
  try {
    return globalThis.localStorage?.getItem('neonPilot.debugPerf') === '1';
  } catch {
    return false;
  }
}

function safeParsePerfMeta(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function recordChatRenderTiming(input: {
  conversationId?: string | null;
  route?: string | null;
  startedAtMs: number;
  meta: Record<string, unknown>;
}): void {
  const endTimeMs = performance.now();
  const sample: ChatRenderSample = {
    conversationId: input.conversationId ?? null,
    route: input.route ?? null,
    recordedAt: new Date().toISOString(),
    startTimeMs: Math.max(0, input.startedAtMs),
    endTimeMs,
    durationMs: Math.max(0, endTimeMs - input.startedAtMs),
    meta: input.meta,
  };
  appendSample(perfStore.chatRenderSamples, sample);
  publishPerfStore();
  if (sample.durationMs >= CHAT_RENDER_TELEMETRY_MIN_DURATION_MS) {
    recordRendererTelemetry({
      category: 'renderer_performance',
      name: 'chat_render',
      route: sample.route ?? undefined,
      sessionId: sample.conversationId ?? undefined,
      durationMs: Math.round(sample.durationMs),
      metadata: summarizeChatRenderSample(sample),
    });
  }
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][chat-render]', sample);
  }
}

export function recordClientPerfTiming(input: {
  name: string;
  startedAtMs: number;
  meta?: Record<string, unknown>;
  minDurationMs?: number;
}): void {
  const endTimeMs = performance.now();
  const durationMs = Math.max(0, endTimeMs - input.startedAtMs);
  if (input.minDurationMs !== undefined && durationMs < input.minDurationMs) {
    return;
  }

  const sample: ClientPerfSample = {
    name: input.name,
    recordedAt: new Date().toISOString(),
    startTimeMs: Math.max(0, input.startedAtMs),
    endTimeMs,
    durationMs,
    route: `${globalThis.location?.pathname ?? ''}${globalThis.location?.search ?? ''}`,
    ...(input.meta ? { meta: input.meta } : {}),
  };
  appendSample(perfStore.clientSamples, sample);
  publishPerfStore();
  if (sample.durationMs >= CLIENT_PERF_TELEMETRY_MIN_DURATION_MS) {
    recordRendererTelemetry({
      category: 'renderer_performance',
      name: 'client_work',
      route: sample.route ?? undefined,
      durationMs: Math.round(sample.durationMs),
      metadata: summarizeClientSample(sample),
    });
  }
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][client]', sample);
  }
}

export function measureClientPerfTiming<T>(
  input: { name: string; meta?: Record<string, unknown>; minDurationMs?: number },
  fn: () => T,
): T {
  const startedAtMs = performance.now();
  try {
    return fn();
  } finally {
    recordClientPerfTiming({ ...input, startedAtMs });
  }
}

function summarizeClientSample(sample: ClientPerfSample): Record<string, unknown> {
  return {
    name: sample.name,
    startTimeMs: Math.round(sample.startTimeMs),
    endTimeMs: Math.round(sample.endTimeMs),
    durationMs: Math.round(sample.durationMs),
    route: sample.route,
    ...(sample.meta ? { meta: sample.meta } : {}),
  };
}

function summarizeChatRenderSample(sample: ChatRenderSample): Record<string, unknown> {
  return {
    conversationId: sample.conversationId,
    route: sample.route,
    startTimeMs: Math.round(sample.startTimeMs),
    endTimeMs: Math.round(sample.endTimeMs),
    durationMs: Math.round(sample.durationMs),
    meta: sample.meta,
  };
}

function buildRendererBlockAttribution(startTimeMs: number, durationMs: number): Record<string, unknown> | null {
  const blockEndTimeMs = startTimeMs + durationMs;
  const recentInteractions = perfStore.interactionSamples
    .filter((sample) => sample.timeMs >= startTimeMs - 1500 && sample.timeMs <= blockEndTimeMs + 250)
    .slice(-8)
    .map((sample) => ({
      type: sample.type,
      route: sample.route,
      timeMs: Math.round(sample.timeMs),
      target: sample.target,
    }));
  const recentClientSamples = perfStore.clientSamples
    .filter((sample) => sample.endTimeMs >= startTimeMs - 5000 && sample.startTimeMs <= blockEndTimeMs + 250)
    .slice(-8)
    .map(summarizeClientSample);
  const latestChatRenderSample = perfStore.chatRenderSamples.at(-1);
  if (recentInteractions.length === 0 && recentClientSamples.length === 0 && !latestChatRenderSample) {
    return null;
  }

  return {
    ...(recentInteractions.length > 0 ? { recentInteractions } : {}),
    ...(recentClientSamples.length > 0 ? { recentClientSamples } : {}),
    ...(latestChatRenderSample ? { latestChatRenderSample: summarizeChatRenderSample(latestChatRenderSample) } : {}),
  };
}

function describeInteractionTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const element = target.closest<HTMLElement>(
    [
      '[data-route]',
      '[data-testid]',
      '[data-extension-id]',
      '[data-chat-transcript-panel]',
      '[data-message-index]',
      '[aria-label]',
      'button',
      'a',
      'input',
      'textarea',
      'select',
      '[role]',
    ].join(','),
  );
  if (!element) {
    return target.tagName.toLowerCase();
  }

  const parts = [element.tagName.toLowerCase()];
  const route = element.getAttribute('data-route');
  const testId = element.getAttribute('data-testid');
  const extensionId = element.getAttribute('data-extension-id');
  const messageIndex = element.getAttribute('data-message-index');
  const ariaLabel = element.getAttribute('aria-label');
  const role = element.getAttribute('role');
  if (route) parts.push(`route=${route}`);
  if (testId) parts.push(`testid=${testId}`);
  if (extensionId) parts.push(`extension=${extensionId}`);
  if (messageIndex) parts.push(`message=${messageIndex}`);
  if (role) parts.push(`role=${role}`);
  if (ariaLabel) parts.push(`label=${ariaLabel.slice(0, 80)}`);
  const text = element.textContent?.replace(/\s+/g, ' ').trim();
  if (!ariaLabel && text) {
    parts.push(`text=${text.slice(0, 80)}`);
  }
  return parts.join(' ');
}

export function recordRendererInteraction(type: string, target: EventTarget | null, timeMs = performance.now()): void {
  const sample: RendererInteractionSample = {
    type,
    route: `${globalThis.location?.pathname ?? ''}${globalThis.location?.search ?? ''}`,
    recordedAt: new Date().toISOString(),
    timeMs: Math.max(0, timeMs),
    target: describeInteractionTarget(target),
  };
  appendSample(perfStore.interactionSamples, sample);
  publishPerfStore();
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][interaction]', sample);
  }
}

function recordRendererLongTask(input: {
  source: RendererLongTaskSample['source'];
  startTimeMs: number;
  durationMs: number;
  meta?: Record<string, unknown>;
}): void {
  const startTimeMs = Math.max(0, input.startTimeMs);
  const durationMs = Math.max(0, input.durationMs);
  const attribution = buildRendererBlockAttribution(startTimeMs, durationMs);
  const sample: RendererLongTaskSample = {
    route: `${globalThis.location?.pathname ?? ''}${globalThis.location?.search ?? ''}`,
    recordedAt: new Date().toISOString(),
    startTimeMs,
    durationMs,
    source: input.source,
    ...(input.meta || attribution ? { meta: { ...(input.meta ?? {}), ...(attribution ? { attribution } : {}) } } : {}),
  };
  appendSample(perfStore.longTaskSamples, sample);
  publishPerfStore();
  recordRendererTelemetry({
    category: 'renderer_performance',
    name: sample.source,
    route: sample.route,
    durationMs: Math.round(sample.durationMs),
    metadata: {
      startTimeMs: Math.round(sample.startTimeMs),
      ...sample.meta,
    },
  });
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][renderer-block]', sample);
  }
}

export function startRendererBlockTelemetry(): void {
  if (rendererBlockTelemetryStarted || typeof globalThis.performance === 'undefined') {
    return;
  }
  rendererBlockTelemetryStarted = true;

  const recordInteractionEvent = (event: Event) => {
    recordRendererInteraction(event.type, event.target, performance.now());
  };
  globalThis.addEventListener?.('pointerdown', recordInteractionEvent, { capture: true, passive: true });
  globalThis.addEventListener?.('click', recordInteractionEvent, { capture: true, passive: true });
  globalThis.addEventListener?.('keydown', recordInteractionEvent, { capture: true });
  globalThis.addEventListener?.('wheel', recordInteractionEvent, { capture: true, passive: true });
  globalThis.addEventListener?.('scroll', recordInteractionEvent, { capture: true, passive: true });

  try {
    const Observer = globalThis.PerformanceObserver;
    if (Observer && Observer.supportedEntryTypes?.includes('longtask')) {
      const observer = new Observer((list) => {
        for (const entry of list.getEntries()) {
          recordRendererLongTask({
            source: 'longtask',
            startTimeMs: entry.startTime,
            durationMs: entry.duration,
            meta: { name: entry.name, entryType: entry.entryType },
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    }
  } catch {
    // Long Task API is best-effort; keep the fallback lag sampler active.
  }

  let expectedAtMs = performance.now() + 250;
  globalThis.setInterval(() => {
    const now = performance.now();
    const lagMs = now - expectedAtMs;
    expectedAtMs = now + 250;
    if (lagMs >= 75) {
      recordRendererLongTask({
        source: 'event-loop-lag',
        startTimeMs: now - lagMs,
        durationMs: lagMs,
      });
    }
  }, 250);
}

export function recordExtensionRegistryUsability(input: { loading: boolean; counts?: Record<string, number> }): void {
  perfStore.extensionRegistryLoading = input.loading;
  if (!input.loading) {
    perfStore.extensionRegistryLoadedAt = new Date().toISOString();
    perfStore.extensionRegistryLoadedAtMs = performance.now();
    perfStore.extensionRegistryCounts = input.counts ?? {};
  }
  publishPerfStore();
}

export function recordApiTiming(path: string, res: Response): void {
  if (!res) return;
  const serverTiming = res.headers.get('Server-Timing');
  const meta = safeParsePerfMeta(res.headers.get('X-PA-Perf'));
  if (!serverTiming && !meta) {
    return;
  }

  const sample: PerfApiSample = {
    path,
    recordedAt: new Date().toISOString(),
    serverTiming,
    meta,
  };
  appendSample(perfStore.apiSamples, sample);
  publishPerfStore();
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][api]', sample);
  }
}

function markConversationOpenStart(conversationId: string, source = 'route'): void {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) {
    return;
  }

  conversationOpenTrackers.set(normalizedConversationId, {
    startedAtMs: performance.now(),
    startedAt: new Date().toISOString(),
    source,
    completedPhases: new Set(),
  });
}

export function ensureConversationOpenStart(conversationId: string, source = 'route'): void {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId || conversationOpenTrackers.has(normalizedConversationId)) {
    return;
  }

  markConversationOpenStart(normalizedConversationId, source);
}

export function completeConversationOpenPhase(conversationId: string, phase: ConversationOpenPhase, meta?: Record<string, unknown>): void {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) {
    return;
  }

  const tracker = conversationOpenTrackers.get(normalizedConversationId);
  if (!tracker || tracker.completedPhases.has(phase)) {
    return;
  }

  tracker.completedPhases.add(phase);
  const durationMs = performance.now() - tracker.startedAtMs;
  const sample: ConversationOpenPhaseSample = {
    conversationId: normalizedConversationId,
    source: tracker.source,
    phase,
    startedAt: tracker.startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    ...(meta ? { meta } : {}),
  };
  appendSample(perfStore.conversationOpenSamples, sample);
  publishPerfStore();
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][conversation-open]', sample);
  }

  if (tracker.completedPhases.has('content') && tracker.completedPhases.has('rail') && tracker.completedPhases.has('extensions')) {
    conversationOpenTrackers.delete(normalizedConversationId);
  }
}
