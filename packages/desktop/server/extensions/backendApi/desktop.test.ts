import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callServerModuleExport } = vi.hoisted(() => ({
  callServerModuleExport: vi.fn(),
}));

vi.mock('./serverModuleResolver.js', () => ({
  callServerModuleExport,
}));

import { readDesktopState } from './desktop.js';

describe('backendApi/desktop', () => {
  beforeEach(() => {
    callServerModuleExport.mockReset();
  });

  it('forwards desktop state reads through the server module resolver', async () => {
    const state = {
      windows: [],
      focusedWindowId: null,
      theme: null,
      publishedAt: null,
      revision: null,
      publisherId: null,
    };
    callServerModuleExport.mockResolvedValue(state);

    await expect(readDesktopState()).resolves.toEqual(state);
    expect(callServerModuleExport).toHaveBeenCalledWith('../../desktop/desktopState.js', 'readDesktopStateSnapshot');
  });
});
