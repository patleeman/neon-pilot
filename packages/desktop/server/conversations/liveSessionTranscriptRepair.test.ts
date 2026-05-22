import { beforeEach, describe, expect, it, vi } from 'vitest';

const recovery = vi.hoisted(() => ({ resolveTranscriptTailRecoveryPlan: vi.fn() }));
vi.mock('./liveSessionRecovery.js', () => recovery);

import { repairLiveSessionTranscriptTail } from './liveSessionTranscriptRepair.js';

describe('live session transcript repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function callbacks() {
    return {
      broadcastSnapshot: vi.fn(),
      clearContextUsageTimer: vi.fn(),
      broadcastContextUsage: vi.fn(),
      publishSessionMetaChanged: vi.fn(),
    };
  }

  function entry(sessionManager: unknown) {
    return { currentTurnError: 'failed', session: { sessionManager, state: { messages: [{ role: 'old' }] } } };
  }

  it('reports not recoverable when session manager cannot be inspected or no plan exists', () => {
    expect(repairLiveSessionTranscriptTail(entry({}) as never, callbacks())).toEqual({ recoverable: false, repaired: false, reason: null });

    const manager = { getBranch: vi.fn(), getEntry: vi.fn() };
    recovery.resolveTranscriptTailRecoveryPlan.mockReturnValueOnce(null);
    expect(repairLiveSessionTranscriptTail(entry(manager) as never, callbacks())).toEqual({
      recoverable: false,
      repaired: false,
      reason: null,
    });
    expect(recovery.resolveTranscriptTailRecoveryPlan).toHaveBeenCalledWith(manager);
  });

  it('reports recoverable but unrepaired when required mutation APIs are missing', () => {
    recovery.resolveTranscriptTailRecoveryPlan.mockReturnValueOnce({
      targetEntryId: 'entry-1',
      reason: 'trailing_user_message',
      summary: 'Remove trailing user',
    });
    const manager = { getBranch: vi.fn(), getEntry: vi.fn(), resetLeaf: vi.fn(), buildSessionContext: vi.fn() };

    expect(repairLiveSessionTranscriptTail(entry(manager) as never, callbacks())).toEqual({
      recoverable: true,
      repaired: false,
      reason: 'trailing_user_message',
      summary: 'Remove trailing user',
    });
  });

  it('resets leaf for root repairs and refreshes session state', () => {
    recovery.resolveTranscriptTailRecoveryPlan.mockReturnValueOnce({
      targetEntryId: null,
      reason: 'empty_context',
      summary: 'Reset transcript',
    });
    const manager = {
      getBranch: vi.fn(),
      getEntry: vi.fn(),
      resetLeaf: vi.fn(),
      buildSessionContext: vi.fn(() => ({ messages: [{ role: 'new' }] })),
    };
    const e = entry(manager);
    const cb = callbacks();

    expect(repairLiveSessionTranscriptTail(e as never, cb)).toEqual({
      recoverable: true,
      repaired: true,
      reason: 'empty_context',
      summary: 'Reset transcript',
    });
    expect(manager.resetLeaf).toHaveBeenCalledOnce();
    expect(e.session.state.messages).toEqual([{ role: 'new' }]);
    expect(e.currentTurnError).toBeNull();
    expect(cb.broadcastSnapshot).toHaveBeenCalledWith(e);
    expect(cb.clearContextUsageTimer).toHaveBeenCalledWith(e);
    expect(cb.broadcastContextUsage).toHaveBeenCalledWith(e, true);
    expect(cb.publishSessionMetaChanged).toHaveBeenCalledOnce();
  });

  it('prefers branchWithSummary over branch for targeted repairs', () => {
    recovery.resolveTranscriptTailRecoveryPlan.mockReturnValueOnce({
      targetEntryId: 'entry-1',
      reason: 'trailing_tool_use',
      summary: 'Repair',
      details: { ok: true },
    });
    const manager = {
      getBranch: vi.fn(),
      getEntry: vi.fn(),
      resetLeaf: vi.fn(),
      branchWithSummary: vi.fn(),
      branch: vi.fn(),
      buildSessionContext: vi.fn(() => ({ messages: [] })),
    };

    repairLiveSessionTranscriptTail(entry(manager) as never, callbacks());

    expect(manager.branchWithSummary).toHaveBeenCalledWith('entry-1', 'Repair', { ok: true });
    expect(manager.branch).not.toHaveBeenCalled();
  });

  it('falls back to branch when branchWithSummary is unavailable', () => {
    recovery.resolveTranscriptTailRecoveryPlan.mockReturnValueOnce({
      targetEntryId: 'entry-1',
      reason: 'trailing_tool_use',
      summary: 'Repair',
    });
    const manager = {
      getBranch: vi.fn(),
      getEntry: vi.fn(),
      resetLeaf: vi.fn(),
      branch: vi.fn(),
      buildSessionContext: vi.fn(() => ({ messages: [] })),
    };

    repairLiveSessionTranscriptTail(entry(manager) as never, callbacks());

    expect(manager.branch).toHaveBeenCalledWith('entry-1');
  });
});
