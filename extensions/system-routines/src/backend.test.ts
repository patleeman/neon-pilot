import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runAgentTaskMock } = vi.hoisted(() => ({ runAgentTaskMock: vi.fn() }));
vi.mock('@neon-pilot/extensions/backend/agent', () => ({ runAgentTask: runAgentTaskMock }));

import { deleteRoutine, getState, moveRoutine, registerHookPoint, runHook, saveRoutine } from './backend.js';

function createCtx() {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
        return { ok: true };
      }),
    },
    ui: { invalidate: vi.fn() },
    extensions: { callAction: vi.fn(async () => ({ skills: [] })) },
  } as never;
}

beforeEach(() => {
  runAgentTaskMock.mockReset();
});

describe('system-routines backend', () => {
  it('seeds checkpoint routines and hook summaries', async () => {
    const result = (await getState({}, createCtx())) as { hooks: Array<{ id: string; summary: string }>; routines: unknown[] };
    expect(result.hooks.find((hook) => hook.id === 'checkpoint')?.summary).toContain('Review code changes');
    expect(result.routines.length).toBeGreaterThan(0);
  });

  it('blocks a hook when a decision routine returns a blocking enum outcome', async () => {
    runAgentTaskMock.mockResolvedValue({ text: 'OUTCOME: issues_found\nBug found.' });
    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, createCtx())) as {
      blocked: boolean;
      status: string;
      run: { steps: Array<{ outcome?: string; status: string }> };
    };
    expect(result.blocked).toBe(true);
    expect(result.status).toBe('blocked');
    expect(result.run.steps[0]).toMatchObject({ outcome: 'issues_found', status: 'blocked' });
  });

  it('continues a hook when decision routine returns pass', async () => {
    runAgentTaskMock.mockResolvedValueOnce({ text: 'OUTCOME: pass' }).mockResolvedValueOnce({ text: 'reported' });
    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, createCtx())) as {
      blocked: boolean;
      status: string;
    };
    expect(result.blocked).toBe(false);
    expect(result.status).toBe('passed');
  });

  it('passes routine model settings and retries with fallback model', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'model-routine',
        hookId: 'checkpoint',
        position: 'before',
        type: 'instruction',
        name: 'Model routine',
        instruction: 'Use configured model',
        enabled: true,
        order: -1,
        failureBehavior: 'continue',
        modelRef: 'primary/model',
        fallbackModelRef: 'backup/model',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({ text: 'backup ok', model: 'model', provider: 'backup' });

    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      run: { steps: Array<{ routineName: string; fallbackUsed?: boolean; provider?: string }> };
    };

    expect(runAgentTaskMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ modelRef: 'primary/model' }), ctx);
    expect(runAgentTaskMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ modelRef: 'backup/model' }), ctx);
    expect(result.run.steps.find((step) => step.routineName === 'Model routine')).toMatchObject({ fallbackUsed: true, provider: 'backup' });
  });

  it('runs only routines nested under the judge output route', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'nested-pass',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'pass',
        type: 'instruction',
        name: 'Pass instruction',
        instruction: 'Run only on pass',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    await saveRoutine(
      {
        id: 'nested-issues',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'issues_found',
        type: 'instruction',
        name: 'Issues instruction',
        instruction: 'Run only on issues',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock.mockResolvedValueOnce({ text: 'OUTCOME: pass' }).mockResolvedValueOnce({ text: 'pass child ran' });

    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      run: { steps: Array<{ routineName: string }> };
    };

    expect(result.run.steps.map((step) => step.routineName)).toContain('Pass instruction');
    expect(result.run.steps.map((step) => step.routineName)).not.toContain('Issues instruction');
  });

  it('deletes nested route routines when their judge is deleted', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'nested-pass',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'pass',
        type: 'instruction',
        name: 'Pass instruction',
        instruction: 'Run only on pass',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    const state = (await deleteRoutine({ routineId: 'checkpoint-review-code' }, ctx)) as { routines: Array<{ id: string }> };
    expect(state.routines.some((routine) => routine.id === 'checkpoint-review-code')).toBe(false);
    expect(state.routines.some((routine) => routine.id === 'nested-pass')).toBe(false);
  });

  it('saves custom routines', async () => {
    const ctx = createCtx();
    const saved = (await saveRoutine(
      { hookId: 'checkpoint', position: 'after', type: 'stop', name: 'Stop always', instruction: 'No', enabled: true },
      ctx,
    )) as { hooks: Array<{ id: string; summary: string }>; routines: Array<{ name: string }> };
    expect(saved.hooks.find((hook) => hook.id === 'checkpoint')?.summary).toContain('Stop always');
    expect(saved.routines.some((routine) => routine.name === 'Stop always')).toBe(true);
  });

  it('lets extensions register hook points', async () => {
    const ctx = createCtx();
    await registerHookPoint({ id: 'example.before', title: 'Example', group: 'Extensions', ownerExtensionId: 'example' }, ctx);
    const state = (await getState({}, ctx)) as { hooks: Array<{ id: string; title: string }> };
    expect(state.hooks).toContainEqual(expect.objectContaining({ id: 'example.before', title: 'Example' }));
  });

  it('repairs routines with invalid parents so they remain visible', async () => {
    const ctx = createCtx();
    await (ctx as { storage: { put: (key: string, value: unknown) => Promise<unknown> } }).storage.put('routines-state-v1', {
      version: 1,
      hookPoints: [],
      runs: [],
      routines: [
        {
          id: 'orphaned-routine',
          hookId: 'checkpoint',
          position: 'before',
          parentRoutineId: 'missing-judge',
          parentOutcomeId: 'pass',
          type: 'instruction',
          name: 'Orphaned routine',
          instruction: 'Still visible',
          enabled: true,
          order: 0,
          failureBehavior: 'continue',
          outcomes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const state = (await getState({}, ctx)) as { routines: Array<{ id: string; parentRoutineId?: string; parentOutcomeId?: string }> };
    const repaired = state.routines.find((routine) => routine.id === 'orphaned-routine');
    expect(repaired?.parentRoutineId).toBeUndefined();
    expect(repaired?.parentOutcomeId).toBeUndefined();
  });

  it('moves routines into judge routes', async () => {
    const ctx = createCtx();
    const initial = (await getState({}, ctx)) as { routines: Array<{ id: string; name: string; position: string; order: number }> };
    const report = initial.routines.find((routine) => routine.name === 'Report checkpoint');
    expect(report).toBeTruthy();

    const moved = (await moveRoutine(
      { routineId: report?.id, position: 'before', parentRoutineId: 'checkpoint-review-code', parentOutcomeId: 'pass' },
      ctx,
    )) as {
      routines: Array<{ id: string; name: string; position: string; parentRoutineId?: string; parentOutcomeId?: string }>;
    };
    expect(moved.routines.find((routine) => routine.id === report?.id)).toMatchObject({
      parentRoutineId: 'checkpoint-review-code',
      parentOutcomeId: 'pass',
    });
  });

  it('rejects moves that would nest a routine inside its own child route', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'child-judge',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'pass',
        type: 'decision',
        name: 'Child judge',
        instruction: 'Choose one',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [{ id: 'ok', label: 'OK', target: 'Continue', behavior: 'continue' }],
      },
      ctx,
    );

    await expect(
      moveRoutine({ routineId: 'checkpoint-review-code', position: 'before', parentRoutineId: 'child-judge', parentOutcomeId: 'ok' }, ctx),
    ).rejects.toThrow('own nested routes');
  });

  it('moves routines between lanes and reorders the target lane', async () => {
    const ctx = createCtx();
    const initial = (await getState({}, ctx)) as { routines: Array<{ id: string; name: string; position: string; order: number }> };
    const report = initial.routines.find((routine) => routine.name === 'Report checkpoint');
    const review = initial.routines.find((routine) => routine.name === 'Review code changes');
    expect(report).toBeTruthy();
    expect(review).toBeTruthy();

    const moved = (await moveRoutine({ routineId: report?.id, position: 'before', targetRoutineId: review?.id }, ctx)) as {
      routines: Array<{ id: string; name: string; position: string; order: number }>;
    };
    const before = moved.routines
      .filter((routine) => routine.position === 'before')
      .sort((left, right) => left.order - right.order)
      .map((routine) => routine.name);
    expect(before.slice(0, 2)).toEqual(['Report checkpoint', 'Review code changes']);
  });
});
