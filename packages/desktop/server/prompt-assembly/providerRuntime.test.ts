import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({ invokeExtensionAction: vi.fn() }));

vi.mock('../extensions/extensionBackend.js', () => backend);

import { invokePromptAssemblyProvider, isRecord } from './providerRuntime.js';

type Item = { id: string };
const provider = { extensionId: 'ext', id: 'provider', handler: 'getItems', title: 'Provider' };
const validateItem = (item: unknown): item is Item =>
  Boolean(item && typeof item === 'object' && !Array.isArray(item) && typeof (item as { id?: unknown }).id === 'string');

describe('providerRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns valid items from object or array provider results and diagnoses invalid items', async () => {
    backend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: { items: [{ id: 'one' }, { bad: true }, { id: 'two' }] } });

    await expect(invokePromptAssemblyProvider({ provider, payload: { cwd: '/repo' }, resultKey: 'items', validateItem })).resolves.toEqual({
      items: [{ id: 'one' }, { id: 'two' }],
      diagnostics: [
        {
          severity: 'warning',
          code: 'prompt-assembly-provider-invalid-item',
          message: 'Provider provider returned invalid items[1].',
          sourceId: 'ext/provider',
        },
      ],
    });
    expect(backend.invokeExtensionAction).toHaveBeenCalledWith('ext', 'getItems', { cwd: '/repo' });

    backend.invokeExtensionAction.mockResolvedValueOnce({ ok: true, result: [{ id: 'array' }] });
    await expect(invokePromptAssemblyProvider({ provider, payload: {}, resultKey: 'items', validateItem })).resolves.toEqual({
      items: [{ id: 'array' }],
      diagnostics: [],
    });
  });

  it('returns warning diagnostics for provider failures and thrown errors', async () => {
    backend.invokeExtensionAction.mockResolvedValueOnce({ ok: false });
    await expect(invokePromptAssemblyProvider({ provider, payload: {}, resultKey: 'items', validateItem })).resolves.toEqual({
      items: [],
      diagnostics: [expect.objectContaining({ code: 'prompt-assembly-provider-failed', sourceId: 'ext/provider' })],
    });

    backend.invokeExtensionAction.mockRejectedValueOnce(new Error('boom'));
    await expect(invokePromptAssemblyProvider({ provider, payload: {}, resultKey: 'items', validateItem })).resolves.toEqual({
      items: [],
      diagnostics: [expect.objectContaining({ code: 'prompt-assembly-provider-error', message: 'Provider provider error: boom' })],
    });
  });

  it('times out slow providers and clears timers', async () => {
    vi.useFakeTimers();
    backend.invokeExtensionAction.mockReturnValue(new Promise(() => undefined));
    const promise = invokePromptAssemblyProvider({ provider, payload: {}, resultKey: 'items', validateItem, timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    await expect(promise).resolves.toEqual({
      items: [],
      diagnostics: [
        expect.objectContaining({ code: 'prompt-assembly-provider-error', message: 'Provider provider error: Timed out after 25ms' }),
      ],
    });
    vi.useRealTimers();
  });

  it('identifies plain object records', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});
