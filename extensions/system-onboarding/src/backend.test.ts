import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensure, update } from './backend.js';

function createCtx(overrides: Record<string, unknown> = {}) {
  const storage = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({ ok: true }),
  };

  return {
    extensionId: 'system-onboarding',
    runtimeScope: 'shared',
    storage,
    ...overrides,
  };
}

describe('system-onboarding backend', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes unseen tour state without creating a conversation', async () => {
    const ctx = createCtx();

    const result = await ensure({ source: 'frontend' }, ctx as never);

    expect(result).toMatchObject({
      state: { status: 'unseen', stepIndex: 0 },
      shouldStart: true,
    });
    expect(ctx.storage.put).toHaveBeenCalledWith('onboarding:tour:v1', expect.objectContaining({ status: 'unseen', stepIndex: 0 }));
  });

  it('does not request auto-start for completed tours', async () => {
    const ctx = createCtx({
      storage: {
        get: vi.fn().mockResolvedValue({
          status: 'completed',
          stepIndex: 4,
          completedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        }),
        put: vi.fn(),
      },
    });

    await expect(ensure({ source: 'frontend' }, ctx as never)).resolves.toMatchObject({
      state: { status: 'completed', stepIndex: 4 },
      shouldStart: false,
    });
    expect(ctx.storage.put).not.toHaveBeenCalled();
  });

  it('updates status and clamps invalid step indexes', async () => {
    const storage = {
      get: vi.fn().mockResolvedValue({
        status: 'unseen',
        stepIndex: 0,
        updatedAt: '2026-06-25T00:00:00.000Z',
      }),
      put: vi.fn().mockResolvedValue({ ok: true }),
    };
    const ctx = createCtx({ storage });

    const result = await update({ status: 'active', stepIndex: 2.8 }, ctx as never);

    expect(result).toMatchObject({
      state: { status: 'active', stepIndex: 2 },
      shouldStart: false,
    });
    expect(storage.put).toHaveBeenCalledWith(
      'onboarding:tour:v1',
      expect.objectContaining({ status: 'active', stepIndex: 2, startedAt: expect.any(String) }),
    );
  });

  it('de-duplicates concurrent ensure calls', async () => {
    let resolveGet: ((value: null) => void) | null = null;
    const storage = {
      get: vi.fn().mockImplementation(
        () =>
          new Promise<null>((resolve) => {
            resolveGet = resolve;
          }),
      ),
      put: vi.fn().mockResolvedValue({ ok: true }),
    };
    const ctx = createCtx({ storage });

    const first = ensure({ source: 'frontend' }, ctx as never);
    const second = ensure({ source: 'frontend' }, ctx as never);

    await Promise.resolve();
    await Promise.resolve();
    expect(storage.get).toHaveBeenCalledTimes(1);

    resolveGet?.(null);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(storage.put).toHaveBeenCalledTimes(1);
  });
});
