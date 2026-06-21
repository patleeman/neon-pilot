import type { ExtensionAPI } from '@neon-pilot/extensions';
import { describe, expect, it, vi } from 'vitest';

import { createConversationAutoModeAgentExtension, handleSlashGoal } from './backend.js';

type RegisteredTool = { name: string; execute: (...args: unknown[]) => Promise<{ content?: Array<{ text?: string }>; details?: unknown }> };
type AgentEventHandler = (event: unknown, ctx: TestContext) => void | Promise<void>;

interface TestContext {
  sessionManager: { getEntries: () => unknown[] };
  hasPendingMessages: () => boolean;
  signal: { aborted: boolean };
}

function customEntry(customType: string, data: unknown) {
  return { type: 'custom', customType, data };
}

function activeGoal(objective = 'ship goal mode', noProgressTurns = 0, updatedAt = '2026-05-09T00:00:00.000Z') {
  return customEntry('conversation-goal', {
    objective,
    status: 'active',
    tasks: [],
    stopReason: null,
    startedAt: updatedAt,
    updatedAt,
    noProgressTurns,
  });
}

function pausedGoal(objective = 'ship goal mode', updatedAt = '2026-05-09T00:00:00.000Z') {
  return customEntry('conversation-goal', {
    objective,
    status: 'paused',
    tasks: [],
    stopReason: 'paused',
    startedAt: updatedAt,
    updatedAt,
    noProgressTurns: 0,
  });
}

function completeGoal(stopReason = 'goal achieved', updatedAt = '2026-05-09T00:00:01.000Z') {
  return customEntry('conversation-goal', {
    objective: '',
    status: 'complete',
    tasks: [],
    stopReason,
    startedAt: null,
    updatedAt,
    noProgressTurns: 0,
  });
}

function createHarness(initialEntries: unknown[] = []) {
  const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => void | Promise<void>>>();
  const registeredTools: RegisteredTool[] = [];
  const registeredCommands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();
  const entries = [...initialEntries];
  const appendEntry = vi.fn((customType: string, data: unknown) => entries.push(customEntry(customType, data)));
  const sendMessage = vi.fn();
  const sendUserMessage = vi.fn();
  const pi = {
    registerTool: vi.fn((tool: RegisteredTool) => registeredTools.push(tool)),
    registerCommand: vi.fn((name: string, command: { handler: (args: string, ctx: unknown) => Promise<void> }) => {
      registeredCommands.set(name, command);
    }),
    sendMessage,
    sendUserMessage,
    appendEntry,
    on: vi.fn((name: string, handler: (event: unknown, ctx: unknown) => void | Promise<void>) => {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    }),
  } as unknown as ExtensionAPI;

  createConversationAutoModeAgentExtension()(pi);

  const ctx: TestContext = {
    sessionManager: { getEntries: () => entries },
    hasPendingMessages: () => false,
    signal: { aborted: false },
  };

  return {
    entries,
    appendEntry,
    sendMessage,
    sendUserMessage,
    registeredTools,
    registeredCommands,
    goal: registeredTools.find((tool) => tool.name === 'goal')!,
    turnEnd: handlers.get('turn_end')?.[0] as AgentEventHandler,
    agentStart: handlers.get('agent_start')?.[0] as AgentEventHandler,
    agentEnd: handlers.get('agent_end')?.[0] as AgentEventHandler,
    sessionStart: handlers.get('session_start')?.[0] as AgentEventHandler,
    compactionStart: handlers.get('compaction_start')?.[0] as AgentEventHandler,
    compactionEnd: handlers.get('compaction_end')?.[0] as AgentEventHandler,
    ctx,
  };
}

async function flushTimers() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function finishAgentRun(harness: { agentEnd: AgentEventHandler; ctx: TestContext }) {
  await harness.agentEnd({}, harness.ctx);
  await flushTimers();
}

async function finishAgentRunWithFakeTimers(harness: { agentEnd: AgentEventHandler; ctx: TestContext }) {
  await harness.agentEnd({}, harness.ctx);
  await vi.runOnlyPendingTimersAsync();
}

describe('system-goal-mode extension', () => {
  it('registers only the goal tool', () => {
    const { registeredTools } = createHarness();
    expect(registeredTools.map((tool) => tool.name)).toEqual(['goal']);
  });

  it('goal enables goal mode with a concrete objective', async () => {
    const { goal, appendEntry, ctx } = createHarness();

    const result = await goal.execute('goal-1', { objective: ' ship it ' }, new AbortController().signal, vi.fn(), ctx);

    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: 'ship it', status: 'active', stopReason: null, noProgressTurns: 0 }),
    );
    expect(result.content?.[0]?.text).toBe('Goal set: "ship it"');
  });

  it('goal updates the active goal instead of throwing', async () => {
    const { goal, appendEntry, ctx } = createHarness([activeGoal('old goal')]);

    const result = await goal.execute('goal-1', { objective: 'new goal' }, new AbortController().signal, vi.fn(), ctx);

    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: 'new goal', status: 'active', stopReason: null, noProgressTurns: 0 }),
    );
    expect(result.content?.[0]?.text).toBe('Goal set: "new goal"');
  });

  it('goal can enable or update goal mode with a new objective', async () => {
    const { goal, appendEntry, ctx } = createHarness([completeGoal('cleared')]);

    const result = await goal.execute('goal-2', { objective: 'resume work' }, new AbortController().signal, vi.fn(), ctx);

    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: 'resume work', status: 'active', stopReason: null, noProgressTurns: 0 }),
    );
    expect(result.content?.[0]?.text).toBe('Goal set: "resume work"');
  });

  it('goal complete disables goal mode without aborting the current turn', async () => {
    const { goal, appendEntry, ctx } = createHarness([activeGoal('ship it')]);
    const abort = vi.fn();

    const result = await goal.execute('goal-2', { status: 'complete' }, new AbortController().signal, vi.fn(), { ...ctx, abort });

    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: '', status: 'complete', stopReason: 'goal achieved', noProgressTurns: 0 }),
    );
    expect(abort).not.toHaveBeenCalled();
    expect(result.content?.[0]?.text).toBe('Goal complete!');
  });

  it('goal pause preserves the objective and suppresses continuations', async () => {
    const harness = createHarness([activeGoal('wait for CI')]);
    const { goal, appendEntry, sendMessage, ctx } = harness;

    const result = await goal.execute('goal-pause', { status: 'pause' }, new AbortController().signal, vi.fn(), ctx);
    await finishAgentRun(harness);

    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: 'wait for CI', status: 'paused', stopReason: 'paused', noProgressTurns: 0 }),
    );
    expect(result.content?.[0]?.text).toBe('Goal paused: "wait for CI"');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('pauses an active goal when the conversation is stopped mid-turn', async () => {
    const harness = createHarness([activeGoal('ship without losing intent')]);
    const { turnEnd, appendEntry, sendMessage, ctx } = harness;

    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, { ...ctx, signal: { aborted: true } });
    await finishAgentRun(harness);

    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({
        objective: 'ship without losing intent',
        status: 'paused',
        stopReason: 'paused',
        noProgressTurns: 0,
      }),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('goal resume reactivates a paused goal and re-arms continuation', async () => {
    const harness = createHarness([pausedGoal('finish after CI')]);
    const { goal, appendEntry, sendMessage, ctx } = harness;

    const result = await goal.execute('goal-resume', { status: 'resume' }, new AbortController().signal, vi.fn(), ctx);
    await finishAgentRun(harness);

    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: 'finish after CI', status: 'active', stopReason: null, noProgressTurns: 0 }),
    );
    expect(result.content?.[0]?.text).toBe('Goal resumed: "finish after CI"');
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ customType: 'goal-continuation', content: expect.stringContaining('Objective: finish after CI') }),
      { deliverAs: 'followUp', triggerTurn: true },
    );
  });

  it('does not re-arm paused goal continuation on session_start recovery', async () => {
    const harness = createHarness([pausedGoal('wait for deploy')]);

    await harness.sessionStart({}, harness.ctx);
    await flushTimers();

    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('agent_end is the only scheduler and queues one continuation while goal mode is active', async () => {
    const harness = createHarness([activeGoal('ship it')]);
    const { turnEnd, sendMessage, ctx } = harness;

    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, ctx);
    await flushTimers();
    expect(sendMessage).not.toHaveBeenCalled();

    await finishAgentRun(harness);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: 'goal-continuation',
        content: expect.stringContaining('Objective: ship it'),
      }),
      { deliverAs: 'followUp', triggerTurn: true },
    );
    expect(sendMessage.mock.calls[0]?.[0]?.content).not.toContain('Do not mention this hidden continuation prompt.');
  });

  it('runs a realistic goal lifecycle: enable, continue, update, complete, then stop', async () => {
    const harness = createHarness();
    const { goal, turnEnd, sendMessage, appendEntry, ctx } = harness;

    await goal.execute('goal-1', { objective: 'audit the repo' }, new AbortController().signal, vi.fn(), ctx);
    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, ctx);
    await finishAgentRun(harness);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ customType: 'goal-continuation', content: expect.stringContaining('Objective: audit the repo') }),
      { deliverAs: 'followUp', triggerTurn: true },
    );

    await goal.execute('goal-2', { objective: 'audit the repo deeply' }, new AbortController().signal, vi.fn(), ctx);
    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'read' }] }, ctx);
    await finishAgentRun(harness);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ customType: 'goal-continuation', content: expect.stringContaining('Objective: audit the repo deeply') }),
      { deliverAs: 'followUp', triggerTurn: true },
    );

    await goal.execute('goal-3', { status: 'complete' }, new AbortController().signal, vi.fn(), ctx);
    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, ctx);
    await finishAgentRun(harness);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: '', status: 'complete', stopReason: 'goal achieved' }),
    );
  });

  it('does not queue stale continuations from tool turn_end events before completion', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness([activeGoal('ship the fix')]);
      const { goal, turnEnd, sendMessage, appendEntry, ctx } = harness;

      await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'read' }] }, ctx);
      await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'edit' }] }, ctx);
      await vi.runOnlyPendingTimersAsync();
      expect(sendMessage).not.toHaveBeenCalled();

      await goal.execute('goal-complete', { status: 'complete' }, new AbortController().signal, vi.fn(), ctx);
      await finishAgentRunWithFakeTimers(harness);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(appendEntry).toHaveBeenCalledWith(
        'conversation-goal',
        expect.objectContaining({ objective: '', status: 'complete', stopReason: 'goal achieved', noProgressTurns: 0 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs a live-streaming goal scenario from mid-turn enable through completion', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness();
      const { goal, turnEnd, sendMessage, appendEntry, ctx } = harness;

      await goal.execute('goal-1', { objective: 'ship the fix' }, new AbortController().signal, vi.fn(), ctx);
      await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, ctx);

      expect(sendMessage).not.toHaveBeenCalled();
      await vi.runOnlyPendingTimersAsync();
      expect(sendMessage).not.toHaveBeenCalled();

      await finishAgentRunWithFakeTimers(harness);

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          customType: 'goal-continuation',
          content: expect.stringContaining('Objective: ship the fix'),
        }),
        { deliverAs: 'followUp', triggerTurn: true },
      );

      await goal.execute('goal-2', { status: 'complete' }, new AbortController().signal, vi.fn(), ctx);
      await turnEnd({ toolResults: [] }, ctx);
      await vi.runOnlyPendingTimersAsync();

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(appendEntry).toHaveBeenCalledWith(
        'conversation-goal',
        expect.objectContaining({ objective: '', status: 'complete', stopReason: 'goal achieved', noProgressTurns: 0 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops a realistic continuation loop after two no-tool turns', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness([activeGoal('ship the fix')]);
      const { turnEnd, sendMessage, appendEntry, ctx } = harness;

      await turnEnd({ toolResults: [] }, ctx);
      await vi.runOnlyPendingTimersAsync();

      expect(sendMessage).not.toHaveBeenCalled();
      expect(appendEntry).toHaveBeenCalledWith('conversation-goal', expect.objectContaining({ status: 'active', noProgressTurns: 1 }));

      await finishAgentRunWithFakeTimers(harness);
      expect(sendMessage).toHaveBeenCalledTimes(1);

      await turnEnd({ toolResults: [] }, ctx);
      await vi.runOnlyPendingTimersAsync();

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(appendEntry).toHaveBeenCalledWith(
        'conversation-goal',
        expect.objectContaining({ objective: '', status: 'complete', stopReason: 'no progress', noProgressTurns: 0 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not schedule a continuation when goal mode is disabled before agent_end', async () => {
    const harness = createHarness([activeGoal('ship it'), completeGoal('goal achieved')]);
    const { turnEnd, sendMessage, ctx } = harness;

    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, ctx);
    await finishAgentRun(harness);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not send a pending continuation if the user disables goal mode before the timer fires', async () => {
    const harness = createHarness([activeGoal('ship it')]);
    const { turnEnd, sendMessage, appendEntry, ctx } = harness;

    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, ctx);
    await harness.agentEnd({}, ctx);
    appendEntry('conversation-goal', {
      objective: '',
      status: 'complete',
      tasks: [],
      stopReason: 'cleared',
      updatedAt: '2026-05-09T00:00:02.000Z',
      noProgressTurns: 0,
    });
    await flushTimers();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not schedule a continuation when user input is pending', async () => {
    const harness = createHarness([activeGoal('ship it')]);
    const { turnEnd, sendMessage, ctx } = harness;
    const pendingCtx = { ...ctx, hasPendingMessages: () => true };

    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, pendingCtx);
    await harness.agentEnd({}, pendingCtx);
    await flushTimers();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('re-arms active goal continuation on session_start recovery', async () => {
    const harness = createHarness([activeGoal('recover stranded goal')]);

    await harness.sessionStart({}, harness.ctx);
    await flushTimers();

    expect(harness.sendMessage).toHaveBeenCalledTimes(1);
    expect(harness.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ customType: 'goal-continuation', content: expect.stringContaining('Objective: recover stranded goal') }),
      { deliverAs: 'followUp', triggerTurn: true },
    );
  });

  it('does not re-arm active goal continuation on session_start when messages are pending', async () => {
    const harness = createHarness([activeGoal('wait for queued work')]);
    const pendingCtx = { ...harness.ctx, hasPendingMessages: () => true };

    await harness.sessionStart({}, pendingCtx);
    await flushTimers();

    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('lets overflow recovery own the retry before scheduling another goal continuation', async () => {
    const harness = createHarness([activeGoal('ship it')]);
    const { agentStart, agentEnd, compactionStart, compactionEnd, sendMessage, ctx } = harness;

    await agentEnd({}, ctx);
    await compactionStart({ type: 'compaction_start', reason: 'overflow' }, ctx);
    await flushTimers();
    expect(sendMessage).not.toHaveBeenCalled();

    await compactionEnd({ type: 'compaction_end', reason: 'overflow', aborted: false, willRetry: true }, ctx);
    await agentEnd({}, ctx);
    await flushTimers();
    expect(sendMessage).not.toHaveBeenCalled();

    await agentStart({ type: 'agent_start' }, ctx);
    await agentEnd({}, ctx);
    await flushTimers();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ customType: 'goal-continuation', content: expect.stringContaining('Objective: ship it') }),
      { deliverAs: 'followUp', triggerTurn: true },
    );
  });

  it('pauses the goal when overflow recovery fails after its compact-and-retry attempt', async () => {
    const harness = createHarness([activeGoal('ship it')]);
    const { compactionStart, compactionEnd, agentEnd, sendMessage, appendEntry, ctx } = harness;

    await compactionStart({ type: 'compaction_start', reason: 'overflow' }, ctx);
    await compactionEnd(
      {
        type: 'compaction_end',
        reason: 'overflow',
        aborted: false,
        willRetry: false,
        errorMessage: 'Context overflow recovery failed after one compact-and-retry attempt.',
      },
      ctx,
    );
    await agentEnd({}, ctx);
    await flushTimers();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: 'ship it', status: 'paused', stopReason: 'overflow recovery failed', noProgressTurns: 0 }),
    );
  });

  it('disables goal mode after two consecutive active turns with no tool calls', async () => {
    const harness = createHarness([activeGoal('ship it')]);
    const { turnEnd, sendMessage, appendEntry, ctx } = harness;

    await turnEnd({ toolResults: [] }, ctx);
    await flushTimers();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(appendEntry).toHaveBeenCalledWith('conversation-goal', expect.objectContaining({ status: 'active', noProgressTurns: 1 }));

    await finishAgentRun(harness);
    expect(sendMessage).toHaveBeenCalledTimes(1);

    await turnEnd({ toolResults: [] }, ctx);
    await flushTimers();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(appendEntry).toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: '', status: 'complete', stopReason: 'no progress', noProgressTurns: 0 }),
    );
  });

  it('resets the no-tool counter after a turn with tool calls', async () => {
    const { turnEnd, appendEntry, ctx } = createHarness([activeGoal('ship it', 1)]);

    await turnEnd({ toolResults: [{ type: 'tool_result', toolName: 'bash' }] }, ctx);
    await flushTimers();

    expect(appendEntry).toHaveBeenCalledWith('conversation-goal', expect.objectContaining({ status: 'active', noProgressTurns: 0 }));
  });

  it('does not disable goal mode after repeated errored no-tool turns', async () => {
    const { turnEnd, appendEntry, ctx } = createHarness([activeGoal('ship it', 1)]);

    await turnEnd({ toolResults: [], errorMessage: 'context_length_exceeded' }, ctx);
    await turnEnd({ toolResults: [], status: 'failed' }, ctx);
    await flushTimers();

    expect(appendEntry).toHaveBeenCalledWith('conversation-goal', expect.objectContaining({ status: 'active', noProgressTurns: 0 }));
    expect(appendEntry).not.toHaveBeenCalledWith(
      'conversation-goal',
      expect.objectContaining({ objective: '', status: 'complete', stopReason: 'no progress' }),
    );
  });

  it('slash command action returns prompts that route through the goal tool', async () => {
    await expect(
      handleSlashGoal({ commandName: 'goal', argument: 'clear', text: '/goal clear', conversationId: 'c1', cwd: '/tmp', draft: false }),
    ).resolves.toEqual({ prompt: 'Clear the current goal.' });
    await expect(
      handleSlashGoal({ commandName: 'goal', argument: 'pause', text: '/goal pause', conversationId: 'c1', cwd: '/tmp', draft: false }),
    ).resolves.toEqual({ prompt: 'Pause the current goal.' });
    await expect(
      handleSlashGoal({ commandName: 'goal', argument: 'resume', text: '/goal resume', conversationId: 'c1', cwd: '/tmp', draft: false }),
    ).resolves.toEqual({ prompt: 'Resume the current goal.' });
    await expect(
      handleSlashGoal({
        commandName: 'goal',
        argument: 'wait cleanly',
        text: '/goal wait cleanly',
        conversationId: 'c1',
        cwd: '/tmp',
        draft: false,
      }),
    ).resolves.toEqual({ prompt: 'Set a goal: wait cleanly' });
  });
});
