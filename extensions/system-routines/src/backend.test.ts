import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runAgentTaskMock } = vi.hoisted(() => ({ runAgentTaskMock: vi.fn() }));
vi.mock('@neon-pilot/extensions/backend/agent', () => ({ runAgentTask: runAgentTaskMock }));

import { getState, moveRoutine, registerHookPoint, runHook, saveRoutine } from './backend.js';

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
