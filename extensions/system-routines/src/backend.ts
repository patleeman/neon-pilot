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
    id: 'agent.input',
    title: 'User prompt received',
    group: 'Agent',
    description: 'Judge, rewrite, route, or block a user prompt before the agent runs.',
    ownerExtensionId: 'core',
    variables: [
      { name: 'conversationId', label: 'Conversation' },
      { name: 'prompt', label: 'Prompt' },
    ],
  },
  {
    id: 'agent.before_start',
    title: 'Before agent starts',
    group: 'Agent',
    description: 'Judge whether the agent should proceed or add guidance for the next turn.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'agent.context',
    title: 'Before model context is sent',
    group: 'Agent',
    description: 'Judge whether the model context is safe, relevant, or missing important material.',
    ownerExtensionId: 'core',
    variables: [
      { name: 'conversationId', label: 'Conversation' },
      { name: 'contextSummary', label: 'Context summary' },
    ],
  },
  {
    id: 'agent.before_final_response',
    title: 'Before final response',
    group: 'Agent',
    description: 'Quality-check the assistant response before it is shown.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'agent.after_turn',
    title: 'After agent finishes',
    group: 'Agent',
    description: 'Summarize, review, or decide what should happen after an agent turn.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'agent.task_failure',
    title: 'After task failure',
    group: 'Agent',
    description: 'Diagnose an agent task failure and decide whether it should block or continue.',
    ownerExtensionId: 'core',
    variables: [{ name: 'error', label: 'Error' }],
  },
  {
    id: 'tool.before_run',
    title: 'Before tool runs',
    group: 'Tools',
    description: 'Judge whether a tool call is safe and appropriate before it runs.',
    ownerExtensionId: 'core',
    variables: [
      { name: 'toolName', label: 'Tool' },
      { name: 'input', label: 'Input' },
      { name: 'conversationId', label: 'Conversation' },
    ],
  },
  {
    id: 'tool.after_run',
    title: 'After tool runs',
    group: 'Tools',
    description: 'Review, summarize, or diagnose a tool result.',
    ownerExtensionId: 'core',
    variables: [
      { name: 'toolName', label: 'Tool' },
      { name: 'result', label: 'Result' },
      { name: 'conversationId', label: 'Conversation' },
    ],
  },
  {
    id: 'tool.bash_failure',
    title: 'Shell command failure',
    group: 'Tools',
    description: 'Diagnose a failed shell command.',
    ownerExtensionId: 'system-runs',
    variables: [
      { name: 'cwd', label: 'Working directory' },
      { name: 'command', label: 'Command' },
      { name: 'error', label: 'Error' },
    ],
  },
  {
    id: 'tool.filesystem_write',
    title: 'File write',
    group: 'Files',
    description: 'Review a workspace file write for safety, tests, docs, or follow-up work.',
    ownerExtensionId: 'core',
    variables: [
      { name: 'cwd', label: 'Working directory' },
      { name: 'path', label: 'Path' },
    ],
  },
  {
    id: 'tool.user_bash',
    title: 'User shell command',
    group: 'Tools',
    description: 'Judge or summarize a shell command entered directly by the user.',
    ownerExtensionId: 'core',
    variables: [
      { name: 'cwd', label: 'Working directory' },
      { name: 'command', label: 'Command' },
    ],
  },
  {
    id: 'session.before_compact',
    title: 'Before compaction',
    group: 'Conversation',
    description: 'Judge what facts must be preserved before conversation compaction.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'session.after_compact',
    title: 'After compaction',
    group: 'Conversation',
    description: 'Review whether compaction preserved the important state.',
    ownerExtensionId: 'core',
    variables: [{ name: 'conversationId', label: 'Conversation' }],
  },
  {
    id: 'model.changed',
    title: 'Model changes',
    group: 'Models',
    description: 'Review model changes and adjust workflow guidance when needed.',
    ownerExtensionId: 'system-model-picker',
    variables: [
      { name: 'previousModel', label: 'Previous model' },
      { name: 'model', label: 'Model' },
    ],
  },
  {
    id: 'background.scheduled_task',
    title: 'Scheduled task',
    group: 'Background',
    description: 'Judge, summarize, or diagnose scheduled task execution.',
    ownerExtensionId: 'system-automations',
    variables: [
      { name: 'taskId', label: 'Task' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'background.command',
    title: 'Background command',
    group: 'Background',
    description: 'Judge command safety before it starts or summarize and diagnose it after it finishes.',
    ownerExtensionId: 'system-runs',
    variables: [
      { name: 'runId', label: 'Run' },
      { name: 'command', label: 'Command' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'background.subagent',
    title: 'Subagent run',
    group: 'Background',
    description: 'Judge subagent scope before launch or review the result after completion.',
    ownerExtensionId: 'system-runs',
    variables: [
      { name: 'runId', label: 'Run' },
      { name: 'prompt', label: 'Prompt' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'checkpoint',
    title: 'Checkpoint',
    group: 'Changes',
    description: 'Judge whether changes are ready to checkpoint or summarize the saved checkpoint.',
    ownerExtensionId: 'system-diffs',
    variables: [
      { name: 'cwd', label: 'Working directory' },
      { name: 'changedFiles', label: 'Changed files' },
      { name: 'checkpointMessage', label: 'Draft message' },
      { name: 'conversationId', label: 'Conversation' },
    ],
  },
  {
    id: 'scratchpad.changed',
    title: 'Scratchpad changes',
    group: 'Conversation',
    description: 'Clean up, summarize, or check scratchpad changes before they affect context.',
    ownerExtensionId: 'system-scratchpad',
    variables: [{ name: 'content', label: 'Content' }],
  },
  {
    id: 'todo.changed',
    title: 'Todo list changes',
    group: 'Conversation',
    description: 'Reprioritize todos or detect stale and duplicate work.',
    ownerExtensionId: 'system-todo',
    variables: [{ name: 'todos', label: 'Todos' }],
  },
  {
    id: 'artifact.changed',
    title: 'Artifact created or updated',
    group: 'Outputs',
    description: 'Review generated artifacts for quality, renderability, and follow-up work.',
    ownerExtensionId: 'system-artifacts',
    variables: [
      { name: 'artifactId', label: 'Artifact' },
      { name: 'kind', label: 'Kind' },
    ],
  },
  {
    id: 'mcp.tool',
    title: 'MCP tool call',
    group: 'External tools',
    description: 'Judge or summarize external MCP tool calls.',
    ownerExtensionId: 'system-mcp',
    variables: [
      { name: 'server', label: 'Server' },
      { name: 'tool', label: 'Tool' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'web.fetch',
    title: 'Web fetch',
    group: 'External tools',
    description: 'Judge web requests or summarize fetched source material.',
    ownerExtensionId: 'system-web-tools',
    variables: [
      { name: 'url', label: 'URL' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'goal.changed',
    title: 'Goal changes',
    group: 'Workflows',
    description: 'Review goal changes, completion, pauses, and resumes.',
    ownerExtensionId: 'system-auto-mode',
    variables: [
      { name: 'goal', label: 'Goal' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'workflow.step',
    title: 'Workflow step',
    group: 'Workflows',
    description: 'Review workflow plans, step results, failures, and completion.',
    ownerExtensionId: 'system-dynamic-workflows',
    variables: [
      { name: 'workflowId', label: 'Workflow' },
      { name: 'step', label: 'Step' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'extension.install',
    title: 'Extension install or import',
    group: 'Extensions',
    description: 'Security-review extension installs, imports, validation failures, and self-test failures.',
    ownerExtensionId: 'system-extension-manager',
    variables: [
      { name: 'extensionId', label: 'Extension' },
      { name: 'status', label: 'Status' },
    ],
  },
  {
    id: 'attachment.added',
    title: 'Attachment added',
    group: 'Inputs',
    description: 'Judge whether an attachment needs probing, OCR, or extra context before sending.',
    ownerExtensionId: 'system-composer-attachments',
    variables: [{ name: 'attachment', label: 'Attachment' }],
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
    ...(typeof value.parentRoutineId === 'string' && value.parentRoutineId.trim() ? { parentRoutineId: value.parentRoutineId.trim() } : {}),
    ...(typeof value.parentOutcomeId === 'string' && value.parentOutcomeId.trim() ? { parentOutcomeId: value.parentOutcomeId.trim() } : {}),
    type: typeValue(value.type),
    name,
    instruction: stringValue(value.instruction),
    enabled: boolValue(value.enabled, true),
    order: Number.isFinite(value.order) ? Number(value.order) : fallbackOrder,
    failureBehavior: failureBehaviorValue(value.failureBehavior),
    ...(typeof value.modelRef === 'string' && value.modelRef.trim() ? { modelRef: value.modelRef.trim() } : {}),
    ...(typeof value.fallbackModelRef === 'string' && value.fallbackModelRef.trim()
      ? { fallbackModelRef: value.fallbackModelRef.trim() }
      : {}),
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

function clearRoutineParent(routine: Routine): Routine {
  const next = { ...routine };
  delete next.parentRoutineId;
  delete next.parentOutcomeId;
  return next;
}

function routineHasAncestor(routinesById: Map<string, Routine>, routineId: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  let current = routinesById.get(routineId);
  while (current?.parentRoutineId) {
    if (current.parentRoutineId === ancestorId) return true;
    if (seen.has(current.parentRoutineId)) return true;
    seen.add(current.parentRoutineId);
    current = routinesById.get(current.parentRoutineId);
  }
  return false;
}

function repairRoutineParents(routines: Routine[]): Routine[] {
  const routinesById = new Map(routines.map((routine) => [routine.id, routine]));
  return routines.map((routine) => {
    if (!routine.parentRoutineId && !routine.parentOutcomeId) return routine;
    const parent = routine.parentRoutineId ? routinesById.get(routine.parentRoutineId) : null;
    const outcomeExists = parent?.outcomes.some((outcome) => outcome.id === routine.parentOutcomeId);
    if (
      !parent ||
      parent.type !== 'decision' ||
      parent.hookId !== routine.hookId ||
      parent.position !== routine.position ||
      !routine.parentOutcomeId ||
      !outcomeExists ||
      routineHasAncestor(routinesById, parent.id, routine.id)
    ) {
      return clearRoutineParent(routine);
    }
    return routine;
  });
}

async function readState(ctx: ExtensionBackendContext): Promise<RoutinesState> {
  const stored = await ctx.storage.get(STORE_KEY).catch(() => null);
  if (!isRecord(stored)) return defaultState();
  const routines = Array.isArray(stored.routines)
    ? stored.routines.map(normalizeRoutine).filter((routine): routine is Routine => Boolean(routine))
    : defaultState().routines;
  return {
    version: 1,
    hookPoints: Array.isArray(stored.hookPoints)
      ? stored.hookPoints.map(normalizeHookPoint).filter((hook): hook is RoutineHookPoint => Boolean(hook))
      : [],
    routines: repairRoutineParents(routines),
    runs: Array.isArray(stored.runs) ? (stored.runs.filter(isRecord).slice(0, RUN_LIMIT) as unknown as RoutineRunRecord[]) : [],
  };
}

async function writeState(ctx: ExtensionBackendContext, state: RoutinesState): Promise<RoutinesState> {
  const next = { ...state, runs: state.runs.slice(0, RUN_LIMIT) };
  await ctx.storage.put(STORE_KEY, next);
  await Promise.resolve(ctx.ui?.invalidate?.(['routines']));
  return next;
}

function routinesFor(state: RoutinesState, hookId: string, position: RoutinePosition): Routine[] {
  return state.routines
    .filter((routine) => routine.enabled && routine.hookId === hookId && routine.position === position && !routine.parentRoutineId)
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
  const idsToDelete = new Set<string>([routineId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const routine of state.routines) {
      if (routine.parentRoutineId && idsToDelete.has(routine.parentRoutineId) && !idsToDelete.has(routine.id)) {
        idsToDelete.add(routine.id);
        changed = true;
      }
    }
  }
  return toStateResult(await writeState(ctx, { ...state, routines: state.routines.filter((routine) => !idsToDelete.has(routine.id)) }));
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
  let position = positionValue(input.position);
  const targetRoutineId = stringValue(input.targetRoutineId).trim();
  const parentRoutineId = stringValue(input.parentRoutineId).trim();
  const parentOutcomeId = stringValue(input.parentOutcomeId).trim();
  if (!routineId) throw new Error('routineId and position are required.');

  const state = await readState(ctx);
  const moving = state.routines.find((routine) => routine.id === routineId);
  if (!moving) throw new Error('Routine not found.');
  if (parentRoutineId === routineId) throw new Error('Routine cannot be nested inside itself.');
  if (parentRoutineId || parentOutcomeId) {
    if (!parentRoutineId || !parentOutcomeId) throw new Error('Choose a judge route before dropping this routine.');
    const routinesById = new Map(state.routines.map((routine) => [routine.id, routine]));
    const parent = routinesById.get(parentRoutineId);
    if (!parent || parent.type !== 'decision') throw new Error('Drop routines onto a judge route.');
    if (parent.hookId !== moving.hookId) throw new Error('Routines can only move within the same event.');
    if (!parent.outcomes.some((outcome) => outcome.id === parentOutcomeId)) throw new Error('That judge route no longer exists.');
    if (routineHasAncestor(routinesById, parent.id, moving.id))
      throw new Error('A routine cannot move inside one of its own nested routes.');
    position = parent.position;
  }

  const timestamp = now();
  const targetLane = state.routines
    .filter(
      (routine) =>
        routine.hookId === moving.hookId &&
        routine.position === position &&
        routine.id !== routineId &&
        (routine.parentRoutineId ?? '') === parentRoutineId &&
        (routine.parentOutcomeId ?? '') === parentOutcomeId,
    )
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  const insertIndex = targetRoutineId ? targetLane.findIndex((routine) => routine.id === targetRoutineId) : -1;
  targetLane.splice(insertIndex >= 0 ? insertIndex : targetLane.length, 0, {
    ...moving,
    position,
    ...(parentRoutineId && parentOutcomeId
      ? { parentRoutineId, parentOutcomeId }
      : { parentRoutineId: undefined, parentOutcomeId: undefined }),
    updatedAt: timestamp,
  });
  const targetOrder = new Map(targetLane.map((routine, index) => [routine.id, index]));

  const sourceLane =
    moving.position === position && (moving.parentRoutineId ?? '') === parentRoutineId && (moving.parentOutcomeId ?? '') === parentOutcomeId
      ? []
      : state.routines
          .filter(
            (routine) =>
              routine.hookId === moving.hookId &&
              routine.position === moving.position &&
              routine.id !== routineId &&
              (routine.parentRoutineId ?? '') === (moving.parentRoutineId ?? '') &&
              (routine.parentOutcomeId ?? '') === (moving.parentOutcomeId ?? ''),
          )
          .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  const sourceOrder = new Map(sourceLane.map((routine, index) => [routine.id, index]));

  return toStateResult(
    await writeState(ctx, {
      ...state,
      routines: state.routines.map((routine) => {
        if (routine.id === routineId) {
          const next = { ...routine, position, order: targetOrder.get(routine.id) ?? 0, updatedAt: timestamp };
          if (parentRoutineId && parentOutcomeId) return { ...next, parentRoutineId, parentOutcomeId };
          const topLevel = { ...next };
          delete topLevel.parentRoutineId;
          delete topLevel.parentOutcomeId;
          return topLevel;
        }
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
  const base = [
    'Automated routine run',
    'This message was generated by Neon Pilot Routines, not typed by the user.',
    `Routine: ${routine.name}`,
    `Routine ID: ${routine.id}`,
    `Open Routines: /routines`,
    `Hook: ${routine.hookId} (${routine.position})`,
    ...(routine.parentRoutineId && routine.parentOutcomeId
      ? [`Nested under routine ID: ${routine.parentRoutineId}`, `Route outcome: ${routine.parentOutcomeId}`]
      : []),
    '',
    'Instruction:',
    routine.instruction,
    '',
    'Context:',
    renderContext(context),
  ];
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

function formatRoutineError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const trimmed = rawMessage.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as unknown;
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        const nestedError = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : undefined;
        const message = typeof nestedError?.message === 'string' ? nestedError.message : undefined;
        const statusCode = typeof record.status_code === 'number' ? record.status_code : undefined;
        if (message && statusCode) return `Routine model call failed (${statusCode}): ${message}`;
        if (message) return `Routine model call failed: ${message}`;
      }
    } catch {
      // Fall through to generic cleanup below.
    }
  }
  if (/status_code|headers|x-codex-|usage_limit_reached/i.test(trimmed)) {
    return 'Routine model call failed. Check provider limits or credentials, then try again.';
  }
  return trimmed || 'Routine failed.';
}

async function runRoutineAgentTask(routine: Routine, ctx: ExtensionBackendContext, context: Record<string, unknown>) {
  const baseInput = {
    prompt: buildPrompt(routine, context),
    cwd: typeof context.cwd === 'string' ? context.cwd : undefined,
    tools: 'default' as const,
    timeoutMs: 10 * 60 * 1000,
  };
  try {
    return {
      result: await runAgentTask({ ...baseInput, ...(routine.modelRef ? { modelRef: routine.modelRef } : {}) }, ctx),
      fallbackUsed: false,
    };
  } catch (error) {
    if (!routine.fallbackModelRef || routine.fallbackModelRef === routine.modelRef) throw error;
    return { result: await runAgentTask({ ...baseInput, modelRef: routine.fallbackModelRef }, ctx), fallbackUsed: true };
  }
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
    const { result, fallbackUsed } = await runRoutineAgentTask(routine, ctx, context);
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
        model: result.model,
        provider: result.provider,
        fallbackUsed,
      };
      const routeChildren = state.routines
        .filter((candidate) => candidate.enabled && candidate.parentRoutineId === routine.id && candidate.parentOutcomeId === outcome.id)
        .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
      const childSteps: RoutineRunStep[] = [];
      for (const child of routeChildren) {
        childSteps.push(...(await runRoutine(child, state, ctx, context, visited)));
        if (childSteps.some((childStep) => childStep.status === 'blocked' || childStep.status === 'failed')) break;
      }
      if (outcome.behavior === 'branch' && outcome.nextRoutineId) {
        const nextRoutine = state.routines.find((candidate) => candidate.id === outcome.nextRoutineId && candidate.enabled);
        return nextRoutine
          ? [step, ...childSteps, ...(await runRoutine(nextRoutine, state, ctx, context, visited))]
          : [step, ...childSteps];
      }
      return [step, ...childSteps];
    }
    return [
      {
        routineId: routine.id,
        routineName: routine.name,
        status: 'passed',
        text: result.text,
        skillRefs,
        model: result.model,
        provider: result.provider,
        fallbackUsed,
      },
    ];
  } catch (error) {
    return [
      {
        routineId: routine.id,
        routineName: routine.name,
        status: statusForFailure(routine.failureBehavior),
        message: formatRoutineError(error),
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
