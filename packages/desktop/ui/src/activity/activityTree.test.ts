import { describe, expect, it } from 'vitest';

import type { ExecutionRecord, ParallelPromptPreview, SessionMeta } from '../shared/types';
import {
  type ActivityTreeParallelPromptPreview,
  buildActivityTreeItems,
  buildConversationActivityId,
  buildExecutionActivityId,
  buildParallelPromptActivityId,
  buildRunActivityId,
} from './activityTree';

function session(overrides: Partial<SessionMeta> & Pick<SessionMeta, 'id' | 'title'>): SessionMeta {
  return {
    id: overrides.id,
    title: overrides.title,
    cwd: overrides.cwd ?? '/repo',
    createdAt: overrides.createdAt ?? '2026-05-12T10:00:00.000Z',
    timestamp: overrides.timestamp ?? '2026-05-12T10:00:00.000Z',
    isRunning: overrides.isRunning ?? false,
    parentSessionId: overrides.parentSessionId,
    offshootKind: overrides.offshootKind,
    sourceRunId: overrides.sourceRunId,
  };
}

function execution(overrides: Partial<ExecutionRecord> & Pick<ExecutionRecord, 'id'>): ExecutionRecord {
  return {
    id: overrides.id,
    kind: overrides.kind ?? 'background-command',
    visibility: overrides.visibility ?? 'primary',
    conversationId: overrides.conversationId,
    title: overrides.title ?? overrides.id,
    status: overrides.status ?? 'running',
    createdAt: overrides.createdAt ?? '2026-05-12T10:01:00.000Z',
    updatedAt: overrides.updatedAt,
    workerRole: overrides.workerRole,
    workerName: overrides.workerName,
    capabilities: overrides.capabilities ?? { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
  };
}

function parallelPrompt(
  overrides: Partial<ActivityTreeParallelPromptPreview> & Pick<ParallelPromptPreview, 'id' | 'childConversationId'>,
): ActivityTreeParallelPromptPreview {
  return {
    id: overrides.id,
    prompt: overrides.prompt ?? 'Review the diff',
    childConversationId: overrides.childConversationId,
    status: overrides.status ?? 'running',
    workerRole: 'worker',
    workerName: 'workerName' in overrides ? overrides.workerName : 'Focused Reviewer 1a2b3',
    imageCount: overrides.imageCount ?? 0,
    parentConversationId: overrides.parentConversationId,
  };
}

describe('buildActivityTreeItems', () => {
  it('turns conversations into root activity items', () => {
    const items = buildActivityTreeItems({
      conversations: [session({ id: 'conv-1', title: 'Build the thing', isRunning: true })],
    });

    expect(items).toEqual([
      expect.objectContaining({
        id: buildConversationActivityId('conv-1'),
        kind: 'conversation',
        title: 'Build the thing',
        status: 'running',
        route: '/conversations/conv-1',
        metadata: expect.objectContaining({ isRunning: true, needsAttention: false }),
      }),
    ]);
  });

  it('preserves caller-provided conversation order', () => {
    const items = buildActivityTreeItems({
      conversations: [
        session({ id: 'pinned', title: 'Pinned thread', timestamp: '2026-05-12T09:00:00.000Z' }),
        session({ id: 'recent', title: 'Recent thread', timestamp: '2026-05-12T10:00:00.000Z' }),
      ],
    });

    expect(items.map((activityItem) => activityItem.id)).toEqual([
      buildConversationActivityId('pinned'),
      buildConversationActivityId('recent'),
    ]);
  });

  it('nests child conversations under their parent conversation', () => {
    const items = buildActivityTreeItems({
      conversations: [
        session({ id: 'conv-parent', title: 'Parent conversation', timestamp: '2026-05-12T10:00:00.000Z' }),
        session({
          id: 'conv-child',
          title: 'Subagent conversation',
          parentSessionId: 'conv-parent',
          timestamp: '2026-05-12T10:01:00.000Z',
        }),
      ],
    });

    expect(items.find((item) => item.id === buildConversationActivityId('conv-child'))).toEqual(
      expect.objectContaining({ parentId: buildConversationActivityId('conv-parent') }),
    );
  });

  it('nests executions under their source conversation', () => {
    const items = buildActivityTreeItems({
      conversations: [session({ id: 'conv-1', title: 'Build the thing' })],
      executions: [execution({ id: 'run-1', conversationId: 'conv-1', title: 'Visual QA', status: 'running' })],
    });

    expect(items).toEqual([
      expect.objectContaining({
        id: buildConversationActivityId('conv-1'),
        kind: 'conversation',
        metadata: expect.objectContaining({ hasPendingRuns: true }),
      }),
      expect.objectContaining({
        id: buildExecutionActivityId('run-1'),
        kind: 'execution',
        parentId: buildConversationActivityId('conv-1'),
        title: 'Visual QA',
        status: 'running',
        route: '/conversations/conv-1?run=run-1',
      }),
    ]);
    expect(buildRunActivityId('run-1')).toBe(buildExecutionActivityId('run-1'));
  });

  it('does not mark running conversations as idle pending', () => {
    const items = buildActivityTreeItems({
      conversations: [session({ id: 'conv-1', title: 'Build the thing', isRunning: true })],
      executions: [execution({ id: 'run-1', conversationId: 'conv-1', status: 'running' })],
    });

    expect(items.find((item) => item.id === buildConversationActivityId('conv-1'))).toEqual(
      expect.objectContaining({ metadata: expect.objectContaining({ hasPendingRuns: false }) }),
    );
  });

  it('opens subagent executions at their captured conversation when available', () => {
    const items = buildActivityTreeItems({
      conversations: [
        session({ id: 'conv-1', title: 'Build the thing' }),
        session({ id: 'subagent-conv', title: 'Subagent smoke test', parentSessionId: 'conv-1', sourceRunId: 'run-1' }),
      ],
      executions: [
        execution({ id: 'run-1', kind: 'subagent', conversationId: 'conv-1', title: 'Subagent smoke test', status: 'completed' }),
      ],
    });

    expect(items.find((item) => item.id === buildExecutionActivityId('run-1'))).toEqual(
      expect.objectContaining({
        route: '/conversations/subagent-conv',
        metadata: expect.objectContaining({ conversationId: 'subagent-conv' }),
      }),
    );
  });

  it('keeps offshoot conversation rows titled like normal threads without prefixes', () => {
    const items = buildActivityTreeItems({
      conversations: [
        session({ id: 'conv-1', title: 'Build the thing' }),
        session({ id: 'subagent-conv', title: 'Smoke test', parentSessionId: 'conv-1', offshootKind: 'subagent' }),
        session({ id: 'fork-conv', title: 'Alternate path', parentSessionId: 'conv-1', offshootKind: 'fork' }),
        session({ id: 'rewind-conv', title: 'Earlier path', parentSessionId: 'conv-1', offshootKind: 'rewind' }),
        session({ id: 'duplicate-conv', title: 'Copy path', parentSessionId: 'conv-1', offshootKind: 'duplicate' }),
        session({ id: 'side-conv', title: 'Side quest', parentSessionId: 'conv-1', offshootKind: 'side' }),
      ],
    });

    expect(items.find((item) => item.id === buildConversationActivityId('subagent-conv'))?.title).toBe('Smoke test');
    expect(items.find((item) => item.id === buildConversationActivityId('fork-conv'))?.title).toBe('Alternate path');
    expect(items.find((item) => item.id === buildConversationActivityId('rewind-conv'))?.title).toBe('Earlier path');
    expect(items.find((item) => item.id === buildConversationActivityId('duplicate-conv'))?.title).toBe('Copy path');
    expect(items.find((item) => item.id === buildConversationActivityId('side-conv'))?.title).toBe('Side quest');
  });

  it('uses the worker name as the title for worker executions with a friendly subtitle', () => {
    const items = buildActivityTreeItems({
      conversations: [session({ id: 'conv-1', title: 'Build the thing' })],
      executions: [
        execution({
          id: 'run-1',
          kind: 'subagent',
          conversationId: 'conv-1',
          workerRole: 'worker',
          workerName: 'Focused Analyst 1a2b',
          title: 'code-review',
          status: 'running',
        }),
      ],
    });

    expect(items.find((item) => item.id === buildExecutionActivityId('run-1'))).toEqual(
      expect.objectContaining({
        title: 'Focused Analyst 1a2b',
        subtitle: 'Background worker',
        status: 'running',
      }),
    );
  });

  it('uses a human-friendly subtitle instead of the raw execution kind enum', () => {
    const items = buildActivityTreeItems({
      conversations: [session({ id: 'conv-1', title: 'Build the thing' })],
      executions: [
        execution({ id: 'run-bg', kind: 'background-command', conversationId: 'conv-1', title: 'pnpm test', status: 'running' }),
        execution({ id: 'run-sub', kind: 'subagent', conversationId: 'conv-1', title: 'Subagent smoke', status: 'running' }),
      ],
    });

    expect(items.find((item) => item.id === buildExecutionActivityId('run-bg'))?.subtitle).toBe('Background command');
    expect(items.find((item) => item.id === buildExecutionActivityId('run-sub'))?.subtitle).toBe('Subagent');
  });

  it('skips hidden and unlinked executions', () => {
    const items = buildActivityTreeItems({
      conversations: [session({ id: 'conv-1', title: 'Build the thing' })],
      executions: [
        execution({ id: 'run-hidden', conversationId: 'conv-1', visibility: 'hidden' }),
        execution({ id: 'run-missing', conversationId: 'missing', status: 'completed' }),
      ],
    });

    expect(items.find((item) => item.id === buildExecutionActivityId('run-hidden'))).toBeUndefined();
    expect(items.find((item) => item.id === buildExecutionActivityId('run-missing'))).toBeUndefined();
  });

  describe('parallel prompt worker projection', () => {
    it('projects parallel prompts as execution-kind worker children under the parent conversation', () => {
      const items = buildActivityTreeItems({
        conversations: [
          session({ id: 'conv-parent', title: 'Build the thing', isRunning: true }),
          session({ id: 'conv-child', title: 'Worker thread', parentSessionId: 'conv-parent' }),
        ],
        parallelPrompts: [
          parallelPrompt({
            id: 'prompt-1',
            childConversationId: 'conv-child',
            workerName: 'Focused Reviewer 1a2b3',
            status: 'running',
          }),
        ],
      });

      expect(items.find((item) => item.id === buildParallelPromptActivityId('prompt-1'))).toEqual(
        expect.objectContaining({
          id: buildParallelPromptActivityId('prompt-1'),
          kind: 'execution',
          parentId: buildConversationActivityId('conv-parent'),
          title: 'Focused Reviewer 1a2b3',
          subtitle: 'Background worker',
          status: 'running',
          route: '/conversations/conv-child',
          metadata: expect.objectContaining({
            parallelPromptId: 'prompt-1',
            childConversationId: 'conv-child',
            parentConversationId: 'conv-parent',
            workerRole: 'worker',
            workerName: 'Focused Reviewer 1a2b3',
          }),
        }),
      );
    });

    it('associates via an explicit parentConversationId without requiring the child conversation in the input', () => {
      const items = buildActivityTreeItems({
        conversations: [session({ id: 'conv-parent', title: 'Build the thing' })],
        parallelPrompts: [
          parallelPrompt({
            id: 'prompt-1',
            childConversationId: 'conv-child-elsewhere',
            parentConversationId: 'conv-parent',
            status: 'importing',
          }),
        ],
      });

      expect(items.find((item) => item.id === buildParallelPromptActivityId('prompt-1'))).toEqual(
        expect.objectContaining({
          parentId: buildConversationActivityId('conv-parent'),
          status: 'running',
        }),
      );
    });

    it('maps ready -> done and failed -> failed, and falls back to the prompt id when no workerName is present', () => {
      const items = buildActivityTreeItems({
        conversations: [session({ id: 'conv-parent', title: 'Build the thing' })],
        parallelPrompts: [
          parallelPrompt({
            id: 'prompt-ready',
            childConversationId: 'conv-child',
            parentConversationId: 'conv-parent',
            status: 'ready',
            workerName: undefined,
          }),
          parallelPrompt({
            id: 'prompt-failed',
            childConversationId: 'conv-child-2',
            parentConversationId: 'conv-parent',
            status: 'failed',
            workerName: '  ',
          }),
        ],
      });

      expect(items.find((item) => item.id === buildParallelPromptActivityId('prompt-ready'))).toEqual(
        expect.objectContaining({ title: 'prompt-ready', status: 'done' }),
      );
      expect(items.find((item) => item.id === buildParallelPromptActivityId('prompt-failed'))).toEqual(
        expect.objectContaining({ title: 'prompt-failed', status: 'failed' }),
      );
    });

    it('never surfaces parallel prompts as persona copies and ignores caller-spoofed workerRole metadata', () => {
      const items = buildActivityTreeItems({
        conversations: [session({ id: 'conv-parent', title: 'Build the thing' })],
        parallelPrompts: [
          // Caller tries to spoof a persona role; projection still forces worker.
          {
            ...parallelPrompt({
              id: 'prompt-1',
              childConversationId: 'conv-child',
              parentConversationId: 'conv-parent',
            }),
            workerRole: 'persona' as unknown as 'worker',
          },
        ],
      });

      const projected = items.find((item) => item.id === buildParallelPromptActivityId('prompt-1'));
      expect(projected).toBeDefined();
      expect(projected?.metadata?.workerRole).toBe('worker');
      expect(projected?.subtitle).toBe('Background worker');
    });

    it('skips parallel prompts whose parent conversation cannot be associated from the input', () => {
      const items = buildActivityTreeItems({
        conversations: [session({ id: 'conv-parent', title: 'Build the thing' })],
        parallelPrompts: [
          // No explicit parent and the child conversation is not in the input.
          parallelPrompt({ id: 'prompt-orphan', childConversationId: 'conv-missing', status: 'running' }),
          // Explicit parent that does not exist in the input.
          parallelPrompt({
            id: 'prompt-unknown-parent',
            childConversationId: 'conv-child',
            parentConversationId: 'conv-missing',
            status: 'running',
          }),
        ],
      });

      expect(items.find((item) => item.id === buildParallelPromptActivityId('prompt-orphan'))).toBeUndefined();
      expect(items.find((item) => item.id === buildParallelPromptActivityId('prompt-unknown-parent'))).toBeUndefined();
    });
  });
});
