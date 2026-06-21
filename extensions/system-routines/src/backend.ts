import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { runAgentTask } from '@neon-pilot/extensions/backend/agent';

import type {
  Routine,
  RoutineFailureBehavior,
  RoutineHookPoint,
  RoutineOutcome,
  RoutinePosition,
  RoutineRunRecord,
  RoutineRunStep,
  RoutinesState,
  RoutineType,
} from './types.js';

const STORE_KEY = 'routines-state-v1';
const RUN_LIMIT = 100;

const HOOK_POINTS: RoutineHookPoint[] = [
  {
    id: 'checkpoint',
    title: 'Checkpoint',
    group: 'Tools',
    description: 'Routines that run around checkpointing.',
    ownerExtensionId: 'system-diffs',
    variables: [
      { name: 'cwd', label: 'Working directory' },
      { name: 'changedFiles', label: 'Changed files' },
      { name: 'checkpointMessage', label: 'Draft message' },
      { name: 'conversationId', label: 'Conversation' },
    ],
  },
  {
    id: 'agent.before_start',
    title: 'Before agent starts',
    group: 'Agent',
    description: 'Routines that run before a new agent turn starts.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'agent.after_turn',
    title: 'After turn completes',
    group: 'Agent',
    description: 'Routines that run after an agent turn completes.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'agent.before_final_response',
    title: 'Before final response',
    group: 'Agent',
    description: 'Routines that run before the assistant sends a final response.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'agent.task_failure',
    title: 'After task failure',
    group: 'Agent',
    description: 'Routines that run after a task fails.',
    ownerExtensionId: 'core',
    variables: [{ name: 'error', label: 'Error' }],
  },
  {
    id: 'tool.bash_failure',
    title: 'Bash failure',
    group: 'Tools',
    description: 'Routines that run after a shell command fails.',
    ownerExtensionId: 'system-runs',
    variables: [
      { name: 'cwd', label: 'Working directory' },
      { name: 'command', label: 'Command' },
      { name: 'error', label: 'Error' },
    ],
  },
  {
    id: 'tool.filesystem_write',
    title: 'Filesystem write',
    group: 'Tools',
    description: 'Routines that run around filesystem writes.',
    ownerExtensionId: 'core',
    variables: [
      { name: 'cwd', label: 'Working directory' },
      { name: 'path', label: 'Path' },
    ],
  },
  {
    id: 'background.scheduled_task',
    title: 'Scheduled task',
    group: 'Background',
    description: 'Routines that run around scheduled tasks.',
    ownerExtensionId: 'system-automations',
    variables: [
      { name: 'taskId', label: 'Task' },
      { name: 'status', label: 'Status' },
    ],
  },
];

const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function positionValue(value: unknown): RoutinePosition {
  return value === 'after' ? 'after' : 'before';
}

function typeValue(value: unknown): RoutineType {
  return value === 'decision' || value === 'stop' ? value : 'instruction';
}

function failureBehaviorValue(value: unknown): RoutineFailureBehavior {
  return value === 'warn' || value === 'block' ? value : 'continue';
}

function normalizeOutcome(value: unknown): RoutineOutcome | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id).trim();
  if (!id) return null;
  const behavior =
    value.behavior === 'warn' || value.behavior === 'block' || value.behavior === 'ask' || value.behavior === 'branch'
      ? value.behavior
      : 'continue';
  return {
    id,
    label: stringValue(value.label, id).trim() || id,
    target: stringValue(value.target, behavior).trim() || behavior,
    behavior,
    ...(typeof value.nextRoutineId === 'string' && value.nextRoutineId.trim() ? { nextRoutineId: value.nextRoutineId.trim() } : {}),
  };
}

function normalizeHookPoint(value: unknown): RoutineHookPoint | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id).trim();
  const title = stringValue(value.title).trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    group: stringValue(value.group, 'Extensions').trim() || 'Extensions',
    description: stringValue(value.description, `Routines that run around ${title.toLowerCase()}.`),
    ownerExtensionId: stringValue(value.ownerExtensionId, 'unknown').trim() || 'unknown',
    variables: Array.isArray(value.variables)
      ? value.variables.flatMap((variable) => {
          if (!isRecord(variable)) return [];
          const name = stringValue(variable.name).trim();
          if (!name) return [];
          return [{ name, label: stringValue(variable.label, name).trim() || name }];
        })
      : [],
  };
}

function mergeHookPoints(custom: RoutineHookPoint[]): RoutineHookPoint[] {
  const byId = new Map<string, RoutineHookPoint>();
  for (const hook of HOOK_POINTS) byId.set(hook.id, hook);
  for (const hook of custom) byId.set(hook.id, hook);
  return Array.from(byId.values());
}

function normalizeRoutine(value: unknown, fallbackOrder = 0): Routine | null {
  if (!isRecord(value)) return null;
  const hookId = stringValue(value.hookId).trim();
  const name = stringValue(value.name).trim();
  if (!hookId || !name) return null;
  const createdAt = stringValue(value.createdAt, now());
  const updatedAt = stringValue(value.updatedAt, createdAt);
  return {
    id: stringValue(value.id, makeId('routine')).trim() || makeId('routine'),
    hookId,
    position: positionValue(value.position),
    type: typeValue(value.type),
    name,
    instruction: stringValue(value.instruction),
    enabled: boolValue(value.enabled, true),
    order: Number.isFinite(value.order) ? Number(value.order) : fallbackOrder,
    failureBehavior: failureBehaviorValue(value.failureBehavior),
    outcomes: Array.isArray(value.outcomes)
      ? value.outcomes.map(normalizeOutcome).filter((outcome): outcome is RoutineOutcome => Boolean(outcome))
      : [],
    createdAt,
    updatedAt,
  };
}

function defaultState(): RoutinesState {
  const timestamp = now();
  return {
    version: 1,
    hookPoints: [],
    routines: [
      {
        id: 'checkpoint-review-code',
        hookId: 'checkpoint',
        position: 'before',
        type: 'decision',
        name: 'Review code changes',
        instruction:
          'Use /skill:autoreview to review the current diff. Choose exactly one outcome based on whether checkpointing should continue.',
        enabled: true,
        order: 0,
        failureBehavior: 'block',
        outcomes: [
          { id: 'pass', label: 'Pass', target: 'Continue checkpoint', behavior: 'continue' },
          { id: 'issues_found', label: 'Issues found', target: 'Block checkpoint and report issues', behavior: 'block' },
          { id: 'needs_validation', label: 'Needs validation', target: 'Warn and continue', behavior: 'warn' },
          { id: 'unclear', label: 'Unclear', target: 'Ask user before continuing', behavior: 'ask' },
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'checkpoint-report',
        hookId: 'checkpoint',
        position: 'after',
        type: 'instruction',
        name: 'Report checkpoint',
        instruction: 'Summarize the checkpoint result, included files, and follow-up work.',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    runs: [],
  };
}

async function readState(ctx: ExtensionBackendContext): Promise<RoutinesState> {
  const stored = await ctx.storage.get(STORE_KEY).catch(() => null);
  if (!isRecord(stored)) return defaultState();
  return {
    version: 1,
    hookPoints: Array.isArray(stored.hookPoints)
      ? stored.hookPoints.map(normalizeHookPoint).filter((hook): hook is RoutineHookPoint => Boolean(hook))
      : [],
    routines: Array.isArray(stored.routines)
      ? stored.routines.map(normalizeRoutine).filter((routine): routine is Routine => Boolean(routine))
      : defaultState().routines,
    runs: Array.isArray(stored.runs) ? (stored.runs.filter(isRecord).slice(0, RUN_LIMIT) as unknown as RoutineRunRecord[]) : [],
  };
}

async function writeState(ctx: ExtensionBackendContext, state: RoutinesState): Promise<RoutinesState> {
  const next = { ...state, runs: state.runs.slice(0, RUN_LIMIT) };
  await ctx.storage.put(STORE_KEY, next);
  ctx.ui?.invalidate?.(['routines']);
  return next;
}

function routinesFor(state: RoutinesState, hookId: string, position: RoutinePosition): Routine[] {
  return state.routines
    .filter((routine) => routine.enabled && routine.hookId === hookId && routine.position === position)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

function summarizeHook(hookId: string, routines: Routine[]): string {
  const enabled = routines.filter((routine) => routine.hookId === hookId && routine.enabled);
  if (enabled.length === 0) return 'No routines';
  return enabled
    .sort((left, right) => left.position.localeCompare(right.position) || left.order - right.order)
    .slice(0, 2)
    .map((routine) => routine.name)
    .join(', ');
}

function toStateResult(state: RoutinesState) {
  const hooks = mergeHookPoints(state.hookPoints);
  return {
    hooks: hooks.map((hook) => ({ ...hook, summary: summarizeHook(hook.id, state.routines) })),
    routines: state.routines,
    runs: state.runs,
  };
}

export async function getState(_input: unknown, ctx: ExtensionBackendContext) {
  const state = await readState(ctx);
  return toStateResult(state);
}

export async function registerHookPoint(input: unknown, ctx: ExtensionBackendContext) {
  const hookPoint = normalizeHookPoint(input);
  if (!hookPoint) throw new Error('Hook point id and title are required.');
  const state = await readState(ctx);
  const hookPoints = [...state.hookPoints.filter((hook) => hook.id !== hookPoint.id), hookPoint];
  return toStateResult(await writeState(ctx, { ...state, hookPoints }));
}

export async function saveRoutine(input: unknown, ctx: ExtensionBackendContext) {
  const candidate = normalizeRoutine(input);
  if (!candidate) throw new Error('Routine name and hook are required.');
  const state = await readState(ctx);
  const existing = state.routines.find((routine) => routine.id === candidate.id);
  const nextRoutine: Routine = {
    ...candidate,
    createdAt: existing?.createdAt ?? candidate.createdAt,
    updatedAt: now(),
    order: Number.isFinite(candidate.order) ? candidate.order : (existing?.order ?? 0),
  };
  const routines = existing
    ? state.routines.map((routine) => (routine.id === nextRoutine.id ? nextRoutine : routine))
    : [...state.routines, nextRoutine];
  return toStateResult(await writeState(ctx, { ...state, routines }));
}

export async function deleteRoutine(input: unknown, ctx: ExtensionBackendContext) {
  if (!isRecord(input)) throw new Error('routineId is required.');
  const routineId = stringValue(input.routineId).trim();
  if (!routineId) throw new Error('routineId is required.');
  const state = await readState(ctx);
  return toStateResult(await writeState(ctx, { ...state, routines: state.routines.filter((routine) => routine.id !== routineId) }));
}

export async function reorderRoutines(input: unknown, ctx: ExtensionBackendContext) {
  if (!isRecord(input) || !Array.isArray(input.routineIds)) throw new Error('routineIds are required.');
  const ids = input.routineIds.filter((id): id is string => typeof id === 'string');
  const state = await readState(ctx);
  const order = new Map(ids.map((id, index) => [id, index]));
  return toStateResult(
    await writeState(ctx, {
      ...state,
      routines: state.routines.map((routine) =>
        order.has(routine.id) ? { ...routine, order: order.get(routine.id) ?? routine.order, updatedAt: now() } : routine,
      ),
    }),
  );
}

export async function moveRoutine(input: unknown, ctx: ExtensionBackendContext) {
  if (!isRecord(input)) throw new Error('routineId and position are required.');
  const routineId = stringValue(input.routineId).trim();
  const position = positionValue(input.position);
  const targetRoutineId = stringValue(input.targetRoutineId).trim();
  if (!routineId) throw new Error('routineId and position are required.');

  const state = await readState(ctx);
  const moving = state.routines.find((routine) => routine.id === routineId);
  if (!moving) throw new Error('Routine not found.');

  const timestamp = now();
  const targetLane = state.routines
    .filter((routine) => routine.hookId === moving.hookId && routine.position === position && routine.id !== routineId)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  const insertIndex = targetRoutineId ? targetLane.findIndex((routine) => routine.id === targetRoutineId) : -1;
  targetLane.splice(insertIndex >= 0 ? insertIndex : targetLane.length, 0, { ...moving, position, updatedAt: timestamp });
  const targetOrder = new Map(targetLane.map((routine, index) => [routine.id, index]));

  const sourceLane =
    moving.position === position
      ? []
      : state.routines
          .filter((routine) => routine.hookId === moving.hookId && routine.position === moving.position && routine.id !== routineId)
          .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  const sourceOrder = new Map(sourceLane.map((routine, index) => [routine.id, index]));

  return toStateResult(
    await writeState(ctx, {
      ...state,
      routines: state.routines.map((routine) => {
        if (routine.id === routineId) return { ...routine, position, order: targetOrder.get(routine.id) ?? 0, updatedAt: timestamp };
        if (routine.hookId !== moving.hookId) return routine;
        if (routine.position === position && targetOrder.has(routine.id)) {
          return { ...routine, order: targetOrder.get(routine.id) ?? routine.order, updatedAt: timestamp };
        }
        if (routine.position === moving.position && sourceOrder.has(routine.id)) {
          return { ...routine, order: sourceOrder.get(routine.id) ?? routine.order, updatedAt: timestamp };
        }
        return routine;
      }),
    }),
  );
}

export async function listSkills(_input: unknown, ctx: ExtensionBackendContext) {
  return ctx.extensions.callAction('system-skills', 'listSkills', {});
}

function extractSkillRefs(instruction: string): string[] {
  const refs = new Set<string>();
  for (const match of instruction.matchAll(/\/skill:([A-Za-z0-9._-]+)/g)) refs.add(match[1] ?? '');
  return Array.from(refs).filter(Boolean);
}

function renderContext(context: Record<string, unknown>): string {
  return Object.entries(context)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n');
}

function buildPrompt(routine: Routine, context: Record<string, unknown>): string {
  const base = [`Routine: ${routine.name}`, '', 'Instruction:', routine.instruction, '', 'Context:', renderContext(context)];
  if (routine.type === 'decision') {
    base.push(
      '',
      'Choose exactly one outcome id from this list and put it on the first line as `OUTCOME: <id>`:',
      ...routine.outcomes.map((outcome) => `- ${outcome.id}: ${outcome.target}`),
    );
  }
  return base.join('\n');
}

function parseOutcome(text: string, outcomes: RoutineOutcome[]): RoutineOutcome | null {
  const firstOutcome = /^\s*OUTCOME:\s*([A-Za-z0-9._-]+)/im.exec(text)?.[1];
  if (firstOutcome) return outcomes.find((outcome) => outcome.id === firstOutcome) ?? null;
  const normalized = text.toLowerCase();
  return outcomes.find((outcome) => normalized.includes(outcome.id.toLowerCase())) ?? null;
}

function statusForFailure(behavior: RoutineFailureBehavior): RoutineRunStep['status'] {
  if (behavior === 'block') return 'blocked';
  if (behavior === 'warn') return 'warned';
  return 'passed';
}

async function runRoutine(
  routine: Routine,
  state: RoutinesState,
  ctx: ExtensionBackendContext,
  context: Record<string, unknown>,
  visited: Set<string>,
): Promise<RoutineRunStep[]> {
  if (visited.has(routine.id)) {
    return [
      { routineId: routine.id, routineName: routine.name, status: 'failed', message: 'Routine branch loop detected.', skillRefs: [] },
    ];
  }
  visited.add(routine.id);
  const skillRefs = extractSkillRefs(routine.instruction);
  if (routine.type === 'stop') {
    return [{ routineId: routine.id, routineName: routine.name, status: 'blocked', message: routine.instruction, skillRefs }];
  }
  try {
    const result = await runAgentTask(
      {
        prompt: buildPrompt(routine, context),
        cwd: typeof context.cwd === 'string' ? context.cwd : undefined,
        tools: 'default',
        timeoutMs: 10 * 60 * 1000,
      },
      ctx,
    );
    if (routine.type === 'decision') {
      const outcome = parseOutcome(result.text, routine.outcomes);
      if (!outcome) {
        return [
          {
            routineId: routine.id,
            routineName: routine.name,
            status: 'blocked',
            text: result.text,
            message: `Decision routine did not return one of: ${routine.outcomes.map((item) => item.id).join(', ')}`,
            skillRefs,
          },
        ];
      }
      const step: RoutineRunStep = {
        routineId: routine.id,
        routineName: routine.name,
        status: outcome.behavior === 'block' || outcome.behavior === 'ask' ? 'blocked' : outcome.behavior === 'warn' ? 'warned' : 'passed',
        outcome: outcome.id,
        text: result.text,
        message: outcome.target,
        skillRefs,
      };
      if (outcome.behavior === 'branch' && outcome.nextRoutineId) {
        const nextRoutine = state.routines.find((candidate) => candidate.id === outcome.nextRoutineId && candidate.enabled);
        return nextRoutine ? [step, ...(await runRoutine(nextRoutine, state, ctx, context, visited))] : [step];
      }
      return [step];
    }
    return [{ routineId: routine.id, routineName: routine.name, status: 'passed', text: result.text, skillRefs }];
  } catch (error) {
    return [
      {
        routineId: routine.id,
        routineName: routine.name,
        status: statusForFailure(routine.failureBehavior),
        message: error instanceof Error ? error.message : String(error),
        skillRefs,
      },
    ];
  }
}

export async function runHook(input: unknown, ctx: ExtensionBackendContext) {
  if (!isRecord(input)) throw new Error('hookId is required.');
  const hookId = stringValue(input.hookId).trim();
  const position = positionValue(input.position);
  const context = isRecord(input.context) ? input.context : {};
  if (!hookId) throw new Error('hookId is required.');
  const state = await readState(ctx);
  const routines = routinesFor(state, hookId, position);
  const startedAt = now();
  const steps: RoutineRunStep[] = [];
  for (const routine of routines) {
    steps.push(...(await runRoutine(routine, state, ctx, context, new Set<string>())));
    if (steps.some((step) => step.status === 'blocked' || step.status === 'failed')) break;
  }
  const status: RoutineRunRecord['status'] =
    steps.length === 0
      ? 'skipped'
      : steps.some((step) => step.status === 'blocked')
        ? 'blocked'
        : steps.some((step) => step.status === 'failed')
          ? 'failed'
          : steps.some((step) => step.status === 'warned')
            ? 'warned'
            : 'passed';
  const record: RoutineRunRecord = { id: makeId('run'), hookId, position, status, startedAt, completedAt: now(), context, steps };
  await writeState(ctx, { ...state, runs: [record, ...state.runs].slice(0, RUN_LIMIT) });
  return {
    ok: status !== 'blocked' && status !== 'failed',
    status,
    blocked: status === 'blocked' || status === 'failed',
    message: steps.find((step) => step.status === 'blocked' || step.status === 'failed' || step.status === 'warned')?.message,
    run: record,
  };
}
