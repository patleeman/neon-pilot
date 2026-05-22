import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ loadDurableRunAttentionState: vi.fn() }));

vi.mock('@neon-pilot/core', () => core);

import {
  decorateDurableRunAttention,
  decorateDurableRunsAttention,
  durableRunNeedsAttention,
  getDurableRunAttentionSignature,
} from './durableRunAttention.js';

function run(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    status: { status: 'completed', activeAttempt: null, updatedAt: '2026-05-22T00:00:00.000Z', completedAt: '2026-05-22T00:01:00.000Z' },
    problems: [],
    recoveryAction: 'none',
    ...overrides,
  } as never;
}

describe('durableRunAttention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    core.loadDurableRunAttentionState.mockReturnValue({ runs: {} });
  });

  it('detects runs needing attention from problems, recovery actions, and terminal statuses', () => {
    expect(durableRunNeedsAttention(run())).toBe(false);
    expect(durableRunNeedsAttention(run({ problems: ['missing status'] }))).toBe(true);
    expect(durableRunNeedsAttention(run({ recoveryAction: 'resume' }))).toBe(true);
    expect(durableRunNeedsAttention(run({ recoveryAction: 'rerun' }))).toBe(true);
    expect(durableRunNeedsAttention(run({ recoveryAction: 'attention' }))).toBe(true);
    expect(durableRunNeedsAttention(run({ recoveryAction: 'invalid' }))).toBe(true);
    expect(durableRunNeedsAttention(run({ status: { status: 'failed' }, recoveryAction: 'none' }))).toBe(true);
    expect(durableRunNeedsAttention(run({ status: { status: 'interrupted' }, recoveryAction: 'none' }))).toBe(true);
    expect(durableRunNeedsAttention(run({ status: { status: 'recovering' }, recoveryAction: 'none' }))).toBe(true);
  });

  it('builds stable signatures only for runs needing attention', () => {
    expect(getDurableRunAttentionSignature(run())).toBeNull();

    expect(JSON.parse(getDurableRunAttentionSignature(run({ problems: ['a', 'b'], recoveryAction: 'resume' })) ?? '{}')).toEqual({
      recoveryAction: 'resume',
      status: 'completed',
      activeAttempt: null,
      updatedAt: '2026-05-22T00:00:00.000Z',
      completedAt: '2026-05-22T00:01:00.000Z',
      problems: ['a', 'b'],
    });
  });

  it('decorates runs with attention signatures and dismissal state', () => {
    const candidate = run({ problems: ['a'] });
    const signature = getDurableRunAttentionSignature(candidate);

    expect(decorateDurableRunAttention(candidate, { runs: { 'run-1': { attentionSignature: signature } } } as never)).toMatchObject({
      runId: 'run-1',
      attentionSignature: signature,
      attentionDismissed: true,
    });
    expect(decorateDurableRunAttention(candidate, { runs: {} } as never)).toMatchObject({ attentionDismissed: false });
    expect(decorateDurableRunAttention(run(), { runs: {} } as never)).toMatchObject({
      attentionSignature: null,
      attentionDismissed: false,
    });
  });

  it('loads attention state by default for single and bulk decoration', () => {
    const candidate = run({ problems: ['a'] });
    const signature = getDurableRunAttentionSignature(candidate);
    core.loadDurableRunAttentionState.mockReturnValue({ runs: { 'run-1': { attentionSignature: signature } } });

    expect(decorateDurableRunAttention(candidate)).toMatchObject({ attentionDismissed: true });
    expect(decorateDurableRunsAttention([candidate])).toEqual([
      expect.objectContaining({ attentionDismissed: true, attentionSignature: signature }),
    ]);
    expect(core.loadDurableRunAttentionState).toHaveBeenCalledTimes(2);
  });
});
