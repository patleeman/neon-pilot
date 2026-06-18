import type { ExtensionAPI } from '@neon-pilot/extensions';

// ── Constants ────────────────────────────────────────────────────────────────

const GOAL_STATE_CUSTOM_TYPE = 'conversation-goal';
const CONTINUATION_CUSTOM_TYPE = 'goal-continuation';

const GOAL_TOOL = 'goal';

// ── State types ──────────────────────────────────────────────────────────────

interface GoalState {
  objective: string;
  status: 'active' | 'paused' | 'complete';
  tasks: [];
  stopReason: string | null;
  updatedAt: string | null;
  noProgressTurns: number;
}

const DEFAULT_GOAL_STATE: GoalState = {
  objective: '',
  status: 'complete',
  tasks: [],
  stopReason: null,
  updatedAt: null,
  noProgressTurns: 0,
};

// ── State helpers ────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readGoalState(sessionManager: { getEntries: () => unknown[] }): GoalState {
  const entries = sessionManager.getEntries();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || entry.type !== 'custom' || entry.customType !== GOAL_STATE_CUSTOM_TYPE) {
      continue;
    }
    const data = entry.data;
    if (!isRecord(data) || typeof data.objective !== 'string') {
      continue;
    }
    const status =
      typeof data.status === 'string' && ['active', 'paused', 'complete'].includes(data.status)
        ? (data.status as GoalState['status'])
        : 'complete';
    return {
      objective: data.objective,
      status,
      tasks: [],
      stopReason: typeof data.stopReason === 'string' ? data.stopReason : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      noProgressTurns: typeof data.noProgressTurns === 'number' && Number.isSafeInteger(data.noProgressTurns) ? data.noProgressTurns : 0,
    };
  }
  return DEFAULT_GOAL_STATE;
}

function writeGoalState(pi: ExtensionAPI, state: GoalState): void {
  pi.appendEntry(GOAL_STATE_CUSTOM_TYPE, state);
}

function createActiveGoalState(objective: string): GoalState {
  return {
    objective,
    status: 'active',
    tasks: [],
    stopReason: null,
    updatedAt: new Date().toISOString(),
    noProgressTurns: 0,
  };
}

function createCompleteGoalState(stopReason: string): GoalState {
  return {
    objective: '',
    status: 'complete',
    tasks: [],
    stopReason,
    updatedAt: new Date().toISOString(),
    noProgressTurns: 0,
  };
}

function createPausedGoalState(state: GoalState, stopReason = 'paused'): GoalState {
  return {
    ...state,
    status: 'paused',
    stopReason,
    updatedAt: new Date().toISOString(),
    noProgressTurns: 0,
  };
}

function createResumedGoalState(state: GoalState): GoalState {
  return {
    ...state,
    status: 'active',
    stopReason: null,
    updatedAt: new Date().toISOString(),
    noProgressTurns: 0,
  };
}

function buildContinuationPrompt(state: GoalState): string {
  return [
    'Goal continuation.',
    '',
    `Objective: ${state.objective}`,
    '',
    'Continue working until the objective is fully achieved.',
    'If the objective is fully achieved, call goal with status: "complete" and stop.',
    'If work remains, make concrete progress before replying.',
  ].join('\n');
}

function hasTurnError(event: unknown): boolean {
  if (!isRecord(event)) {
    return false;
  }
  if (typeof event.errorMessage === 'string' && event.errorMessage.trim().length > 0) {
    return true;
  }
  if (typeof event.error === 'string' && event.error.trim().length > 0) {
    return true;
  }
  if (isRecord(event.error)) {
    return true;
  }
  return event.status === 'error' || event.status === 'failed';
}

function isNoProgressGoalTurn(event: unknown, toolResults: Array<{ toolName?: string }>): boolean {
  if (hasTurnError(event)) {
    return false;
  }
  return toolResults.length === 0;
}

function readEventType(event: unknown): string | null {
  return isRecord(event) && typeof event.type === 'string' ? event.type : null;
}

function isOverflowCompactionStart(event: unknown): boolean {
  return isRecord(event) && event.type === 'compaction_start' && event.reason === 'overflow';
}

function isOverflowCompactionRetry(event: unknown): boolean {
  return (
    isRecord(event) && event.type === 'compaction_end' && event.reason === 'overflow' && event.aborted !== true && event.willRetry === true
  );
}

function isOverflowRecoveryFailure(event: unknown): boolean {
  return (
    isRecord(event) &&
    event.type === 'compaction_end' &&
    event.reason === 'overflow' &&
    event.aborted !== true &&
    event.willRetry !== true &&
    typeof event.errorMessage === 'string' &&
    event.errorMessage.trim().length > 0
  );
}

function hasPendingMessages(ctx: { hasPendingMessages?: () => boolean }): boolean {
  return typeof ctx.hasPendingMessages === 'function' ? ctx.hasPendingMessages() : false;
}

// ── Tool parameter schemas ───────────────────────────────────────────────────

const GoalParams = {
  type: 'object',
  properties: {
    objective: { type: 'string', description: 'Start or replace the active goal objective.' },
    status: {
      type: 'string',
      enum: ['pause', 'resume', 'complete'],
      description: 'Pause the active goal, resume a paused goal, or mark the active goal complete only when the objective is achieved.',
    },
  },
} as const;

// ── Extension entry ──────────────────────────────────────────────────────────

export function createConversationAutoModeAgentExtension(): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    let pendingContinuationTimer: ReturnType<typeof setTimeout> | null = null;
    let overflowRecoveryActive = false;

    const clearPendingContinuation = () => {
      if (pendingContinuationTimer) {
        clearTimeout(pendingContinuationTimer);
        pendingContinuationTimer = null;
      }
    };

    const scheduleContinuationIfActive = (ctx: { sessionManager: { getEntries: () => unknown[] }; hasPendingMessages?: () => boolean }) => {
      const state = readGoalState(ctx.sessionManager);
      if (state.status !== 'active') {
        clearPendingContinuation();
        return;
      }

      if (overflowRecoveryActive || hasPendingMessages(ctx) || pendingContinuationTimer) {
        return;
      }

      const prompt = buildContinuationPrompt(state);
      const continuationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const scheduledObjective = state.objective;
      const scheduledUpdatedAt = state.updatedAt;

      pendingContinuationTimer = setTimeout(() => {
        pendingContinuationTimer = null;
        const latest = readGoalState(ctx.sessionManager);
        if (latest.status !== 'active' || latest.objective !== scheduledObjective || latest.updatedAt !== scheduledUpdatedAt) {
          return;
        }
        if (overflowRecoveryActive || hasPendingMessages(ctx)) {
          return;
        }
        pi.sendMessage(
          {
            customType: CONTINUATION_CUSTOM_TYPE,
            content: prompt,
            details: { source: 'goal-mode', continuationId },
          },
          { deliverAs: 'followUp', triggerTurn: true },
        );
      }, 0);
    };

    // ── Register goal tool ───────────────────────────────────────────────
    pi.registerTool({
      name: GOAL_TOOL,
      label: 'Goal',
      description: 'Start, replace, or complete the current goal.',
      promptSnippet: 'Use goal for explicit sustained objectives; set objective to start/replace, or status="complete" when done.',
      promptGuidelines: [
        'Use goal mode only for explicit requests or sustained autonomous work; ordinary one-shot tasks do not need a goal.',
        'Set objective to start or replace the active goal.',
        'Use status="pause" when the goal must wait on time or an external event; schedule a deferred resume with instructions to call status="resume" when work should continue.',
        'Use status="complete" only when the objective is actually achieved.',
      ],
      parameters: GoalParams,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const objective = typeof params.objective === 'string' ? params.objective.trim() : undefined;
        if (params.status && objective) {
          throw new Error('Use either objective or status, not both.');
        }
        if (!params.status && !objective) {
          throw new Error('Provide objective to start/update the goal, or status: "pause", "resume", or "complete".');
        }

        const state = readGoalState(ctx.sessionManager);
        if (params.status === 'complete' && state.status === 'complete') {
          clearPendingContinuation();
          return {
            content: [{ type: 'text' as const, text: 'Goal already complete.' }],
            details: { state },
          };
        }

        if (params.status === 'pause') {
          if (state.status === 'complete' || !state.objective) {
            clearPendingContinuation();
            return { content: [{ type: 'text' as const, text: 'No active goal to pause.' }], details: { state } };
          }
          if (state.status === 'paused') {
            clearPendingContinuation();
            return { content: [{ type: 'text' as const, text: 'Goal already paused.' }], details: { state } };
          }
          const paused = createPausedGoalState(state);
          writeGoalState(pi, paused);
          clearPendingContinuation();
          return { content: [{ type: 'text' as const, text: `Goal paused: "${paused.objective}"` }], details: { state: paused } };
        }

        if (params.status === 'resume') {
          if (state.status === 'complete' || !state.objective) {
            clearPendingContinuation();
            return { content: [{ type: 'text' as const, text: 'No paused goal to resume.' }], details: { state } };
          }
          if (state.status === 'active') {
            return { content: [{ type: 'text' as const, text: `Goal already active: "${state.objective}"` }], details: { state } };
          }
          const resumed = createResumedGoalState(state);
          writeGoalState(pi, resumed);
          clearPendingContinuation();
          return { content: [{ type: 'text' as const, text: `Goal resumed: "${resumed.objective}"` }], details: { state: resumed } };
        }

        const newState = params.status === 'complete' ? createCompleteGoalState('goal achieved') : createActiveGoalState(objective!);
        writeGoalState(pi, newState);
        clearPendingContinuation();

        const text = newState.status === 'complete' ? 'Goal complete!' : `Goal set: "${newState.objective}"`;
        return {
          content: [{ type: 'text' as const, text }],
          details: { state: newState },
        };
      },
    });

    // ── Turn end: update progress state only ──────────────────────────
    pi.on('turn_end', async (event, ctx) => {
      const state = readGoalState(ctx.sessionManager);
      if (state.status !== 'active') {
        clearPendingContinuation();
        return;
      }

      // Pause goal on interrupt (user hit stop mid-stream)
      if (ctx.signal?.aborted) {
        const stopped = createPausedGoalState(state);
        writeGoalState(pi, stopped);
        clearPendingContinuation();
        return;
      }

      const toolResults = Array.isArray(event.toolResults) ? event.toolResults : [];
      const noProgressTurns = isNoProgressGoalTurn(event, toolResults) ? state.noProgressTurns + 1 : 0;
      if (noProgressTurns >= 2) {
        const stopped = createCompleteGoalState('no progress');
        writeGoalState(pi, stopped);
        clearPendingContinuation();
        return;
      }

      if (noProgressTurns !== state.noProgressTurns) {
        writeGoalState(pi, { ...state, noProgressTurns, updatedAt: new Date().toISOString() });
      }
    });

    // ── Compaction lifecycle: overflow recovery owns its retry ────────
    pi.on('compaction_start', async (event) => {
      if (!isOverflowCompactionStart(event)) {
        return;
      }
      overflowRecoveryActive = true;
      clearPendingContinuation();
    });

    pi.on('compaction_end', async (event, ctx) => {
      if (!isRecord(event) || event.reason !== 'overflow') {
        return;
      }
      if (isOverflowRecoveryFailure(event)) {
        const state = readGoalState(ctx.sessionManager);
        if (state.status === 'active') {
          writeGoalState(pi, createPausedGoalState(state, 'overflow recovery failed'));
        }
        overflowRecoveryActive = false;
        clearPendingContinuation();
        return;
      }
      overflowRecoveryActive = isOverflowCompactionRetry(event);
      clearPendingContinuation();
    });

    pi.on('agent_start', async (event) => {
      if (overflowRecoveryActive && readEventType(event) === 'agent_start') {
        overflowRecoveryActive = false;
      }
    });

    // ── Agent end: schedule one continuation if goal is still active ───
    pi.on('agent_end', async (_event, ctx) => {
      scheduleContinuationIfActive(ctx);
    });

    pi.on('session_start', async (_event, ctx) => {
      const state = readGoalState(ctx.sessionManager);
      if (state.status !== 'active') {
        clearPendingContinuation();
        return;
      }

      // Recovery path: if a prior active goal turn stranded before agent_end
      // (for example after a tool result or app restart), session_start is the
      // next safe point to re-arm continuation instead of leaving the goal
      // visibly active but inert.
      scheduleContinuationIfActive(ctx);
    });
  };
}

// ── Desktop slash command handler ───────────────────────────────────────────

interface SlashGoalInput {
  commandName: string;
  argument: string;
  text: string;
  conversationId: string | null;
  cwd: string | null;
  draft: boolean;
}

interface SlashGoalResult {
  text?: string;
  prompt?: string;
  replaceComposerText?: string;
  appendComposerText?: string;
  notice?: { tone: 'accent' | 'danger'; text: string };
}

export async function handleSlashGoal(input: SlashGoalInput): Promise<SlashGoalResult> {
  const arg = input.argument.trim();

  if (!arg) {
    return {
      text: 'Set a goal with /goal <objective>.\nPause with /goal pause, resume with /goal resume, clear with /goal clear.',
    };
  }

  const lower = arg.toLowerCase();
  if (lower === 'pause' || lower === 'p') {
    return { prompt: 'Pause the current goal.' };
  }
  if (lower === 'resume' || lower === 'r') {
    return { prompt: 'Resume the current goal.' };
  }
  if (lower === 'clear' || lower === 'c') {
    return { prompt: 'Clear the current goal.' };
  }

  // Set a new goal
  return { prompt: `Set a goal: ${arg}` };
}
