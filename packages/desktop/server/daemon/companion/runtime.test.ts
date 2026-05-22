import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCompanionRuntimeProvider, resolveCompanionRuntime, setCompanionRuntimeProvider } from './runtime.js';

describe('companion runtime provider', () => {
  beforeEach(() => {
    setCompanionRuntimeProvider(undefined);
  });

  it('sets, gets, clears, and resolves the configured provider', async () => {
    expect(getCompanionRuntimeProvider()).toBeUndefined();
    await expect(resolveCompanionRuntime({} as never)).resolves.toBeNull();

    const runtime = { start: vi.fn(), stop: vi.fn() };
    const provider = vi.fn(async (_config) => runtime);
    setCompanionRuntimeProvider(provider as never);

    expect(getCompanionRuntimeProvider()).toBe(provider);
    await expect(resolveCompanionRuntime({ companion: { enabled: true } } as never)).resolves.toBe(runtime);
    expect(provider).toHaveBeenCalledWith({ companion: { enabled: true } });

    setCompanionRuntimeProvider(undefined);
    expect(getCompanionRuntimeProvider()).toBeUndefined();
  });
});
