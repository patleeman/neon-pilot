import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invokeExtensionAction: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/data', () => ({
  api: {
    invokeExtensionAction: mocks.invokeExtensionAction,
  },
}));

import { knowledgeApi } from './knowledgeApi';

describe('knowledgeApi', () => {
  beforeEach(() => {
    mocks.invokeExtensionAction.mockReset();
  });

  it('returns action results', async () => {
    mocks.invokeExtensionAction.mockResolvedValue({ ok: true, result: { root: '/knowledge', files: [] } });

    await expect(knowledgeApi.listFiles()).resolves.toEqual({ root: '/knowledge', files: [] });
    expect(mocks.invokeExtensionAction).toHaveBeenCalledWith('system-knowledge', 'knowledgeListFiles', {});
  });

  it('throws extension action errors instead of returning undefined results', async () => {
    mocks.invokeExtensionAction.mockResolvedValue({ ok: false, error: 'Knowledge backend unavailable' });

    await expect(knowledgeApi.listFiles()).rejects.toThrow('Knowledge backend unavailable');
  });
});
