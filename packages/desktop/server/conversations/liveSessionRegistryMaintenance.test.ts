import { describe, expect, it, vi } from 'vitest';

import { refreshAllLiveSessionModelRegistries, reloadAllLiveSessionAuth } from './liveSessionRegistryMaintenance.js';

describe('live session registry maintenance', () => {
  it('reloads auth storage for entries that expose a reload method', () => {
    const reloadA = vi.fn();
    const reloadB = vi.fn();
    const entries = [
      { session: { modelRegistry: { authStorage: { reload: reloadA } } } },
      { session: { modelRegistry: { authStorage: {} } } },
      { session: { modelRegistry: {} } },
      { session: { modelRegistry: { authStorage: { reload: reloadB } } } },
    ];

    expect(reloadAllLiveSessionAuth(entries as never)).toBe(2);
    expect(reloadA).toHaveBeenCalledOnce();
    expect(reloadB).toHaveBeenCalledOnce();
  });

  it('refreshes model registries for entries that expose a refresh method', () => {
    const refreshA = vi.fn();
    const refreshB = vi.fn();
    const entries = [
      { session: { modelRegistry: { refresh: refreshA } } },
      { session: { modelRegistry: {} } },
      { session: {} },
      { session: { modelRegistry: { refresh: refreshB } } },
    ];

    expect(refreshAllLiveSessionModelRegistries(entries as never)).toBe(2);
    expect(refreshA).toHaveBeenCalledOnce();
    expect(refreshB).toHaveBeenCalledOnce();
  });
});
