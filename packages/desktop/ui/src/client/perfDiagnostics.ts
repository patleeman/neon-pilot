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
  durationMs: number;
  meta: Record<string, unknown>;
}

interface ClientPerfSample {
  name: string;
  recordedAt: string;
  durationMs: number;
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

interface PerfStore {
  apiSamples: PerfApiSample[];
  conversationOpenSamples: ConversationOpenPhaseSample[];
  chatRenderSamples: ChatRenderSample[];
  clientSamples: ClientPerfSample[];
  longTaskSamples: RendererLongTaskSample[];
  extensionRegistryLoading?: boolean;
  extensionRegistryLoadedAt?: string;
  extensionRegistryLoadedAtMs?: number;
  extensionRegistryCounts?: Record<string, number>;
}

const MAX_PERF_SAMPLES = 120;
const perfStore: PerfStore = {
  apiSamples: [],
  conversationOpenSamples: [],
  chatRenderSamples: [],
  clientSamples: [],
  longTaskSamples: [],
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
    return globalThis.localStorage?.getItem('pa.debugPerf') === '1';
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
  const sample: ChatRenderSample = {
    conversationId: input.conversationId ?? null,
    route: input.route ?? null,
    recordedAt: new Date().toISOString(),
    durationMs: Math.max(0, performance.now() - input.startedAtMs),
    meta: input.meta,
  };
  appendSample(perfStore.chatRenderSamples, sample);
  publishPerfStore();
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][chat-render]', sample);
  }
}

export function recordClientPerfTiming(input: { name: string; startedAtMs: number; meta?: Record<string, unknown> }): void {
  const sample: ClientPerfSample = {
    name: input.name,
    recordedAt: new Date().toISOString(),
    durationMs: Math.max(0, performance.now() - input.startedAtMs),
    ...(input.meta ? { meta: input.meta } : {}),
  };
  appendSample(perfStore.clientSamples, sample);
  publishPerfStore();
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][client]', sample);
  }
}

function recordRendererLongTask(input: {
  source: RendererLongTaskSample['source'];
  startTimeMs: number;
  durationMs: number;
  meta?: Record<string, unknown>;
}): void {
  const sample: RendererLongTaskSample = {
    route: `${globalThis.location?.pathname ?? ''}${globalThis.location?.search ?? ''}`,
    recordedAt: new Date().toISOString(),
    startTimeMs: Math.max(0, input.startTimeMs),
    durationMs: Math.max(0, input.durationMs),
    source: input.source,
    ...(input.meta ? { meta: input.meta } : {}),
  };
  appendSample(perfStore.longTaskSamples, sample);
  publishPerfStore();
  if (shouldLogPerfSamples()) {
    console.info('[pa-perf][renderer-block]', sample);
  }
}

export function startRendererBlockTelemetry(): void {
  if (rendererBlockTelemetryStarted || typeof globalThis.performance === 'undefined') {
    return;
  }
  rendererBlockTelemetryStarted = true;

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
