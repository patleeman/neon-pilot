import type { ExtensionBackendContext } from '@neon-pilot/extensions/backend';

const ONBOARDING_STATE_KEY = 'onboarding:tour:v1';
export const ONBOARDING_BACKEND_BUILD_MARKER = '2026-06-25';

export type OnboardingTourStatus = 'unseen' | 'active' | 'completed' | 'skipped';

export interface OnboardingTourState {
  status: OnboardingTourStatus;
  stepIndex: number;
  startedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  updatedAt: string;
}

interface EnsureInput {
  source?: string;
}

interface UpdateInput {
  status?: OnboardingTourStatus;
  stepIndex?: number;
}

export interface EnsureResult {
  state: OnboardingTourState;
  shouldStart: boolean;
}

const ensureInFlightByRuntimeScope = new Map<string, Promise<EnsureResult>>();

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeStepIndex(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function normalizeState(value: unknown): OnboardingTourState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Partial<OnboardingTourState>;
  if (record.status !== 'unseen' && record.status !== 'active' && record.status !== 'completed' && record.status !== 'skipped') {
    return null;
  }

  return {
    status: record.status,
    stepIndex: normalizeStepIndex(record.stepIndex),
    ...(typeof record.startedAt === 'string' ? { startedAt: record.startedAt } : {}),
    ...(typeof record.completedAt === 'string' ? { completedAt: record.completedAt } : {}),
    ...(typeof record.skippedAt === 'string' ? { skippedAt: record.skippedAt } : {}),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : nowIso(),
  };
}

function createInitialState(): OnboardingTourState {
  return {
    status: 'unseen',
    stepIndex: 0,
    updatedAt: nowIso(),
  };
}

async function readState(ctx: ExtensionBackendContext): Promise<OnboardingTourState> {
  return normalizeState(await ctx.storage.get<OnboardingTourState>(ONBOARDING_STATE_KEY)) ?? createInitialState();
}

async function writeState(ctx: ExtensionBackendContext, state: OnboardingTourState): Promise<OnboardingTourState> {
  await ctx.storage.put(ONBOARDING_STATE_KEY, state);
  return state;
}

function transitionState(current: OnboardingTourState, input: UpdateInput): OnboardingTourState {
  const nextStatus = input.status ?? current.status;
  const timestamp = nowIso();
  const next: OnboardingTourState = {
    ...current,
    status: nextStatus,
    stepIndex: normalizeStepIndex(input.stepIndex ?? current.stepIndex),
    updatedAt: timestamp,
  };

  if (nextStatus === 'active' && !next.startedAt) {
    next.startedAt = timestamp;
  }
  if (nextStatus === 'completed') {
    next.completedAt = timestamp;
  }
  if (nextStatus === 'skipped') {
    next.skippedAt = timestamp;
  }

  return next;
}

async function ensureOnce(input: EnsureInput | undefined, ctx: ExtensionBackendContext): Promise<EnsureResult> {
  const storedState = await ctx.storage.get<OnboardingTourState>(ONBOARDING_STATE_KEY);
  const normalizedState = normalizeState(storedState);
  const state = normalizedState ?? createInitialState();
  if (!normalizedState) {
    await writeState(ctx, state);
  }

  return {
    state,
    shouldStart: input?.source === 'frontend' && state.status === 'unseen',
  };
}

export async function ensure(input: unknown, ctx: ExtensionBackendContext): Promise<EnsureResult> {
  const runtimeScope = ctx.runtimeScope;
  const existingTask = ensureInFlightByRuntimeScope.get(runtimeScope);
  if (existingTask) {
    return existingTask;
  }

  const normalizedInput = input && typeof input === 'object' ? (input as EnsureInput) : undefined;
  const task = ensureOnce(normalizedInput, ctx).finally(() => {
    if (ensureInFlightByRuntimeScope.get(runtimeScope) === task) {
      ensureInFlightByRuntimeScope.delete(runtimeScope);
    }
  });
  ensureInFlightByRuntimeScope.set(runtimeScope, task);
  return task;
}

export async function update(input: unknown, ctx: ExtensionBackendContext): Promise<EnsureResult> {
  const body = input && typeof input === 'object' ? (input as UpdateInput) : {};
  const nextState = transitionState(await readState(ctx), body);
  const state = await writeState(ctx, nextState);
  return { state, shouldStart: false };
}
