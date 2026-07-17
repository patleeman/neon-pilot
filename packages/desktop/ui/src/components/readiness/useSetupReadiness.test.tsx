// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SetupReadinessSnapshot } from '../../shared/types';
import { useSetupReadiness } from './useSetupReadiness';

const apiMock = vi.hoisted(() => ({
  setupReadiness: vi.fn<() => Promise<SetupReadinessSnapshot>>(),
  runSetupReadinessAction: vi.fn(),
  dismissSetupReadinessItem: vi.fn(),
  restoreSetupReadinessItem: vi.fn(),
}));

vi.mock('../../client/api', () => ({ api: apiMock }));

const emptySnapshot: SetupReadinessSnapshot = {
  generatedAt: '2026-07-16T00:00:00.000Z',
  items: [],
  counts: { total: 0, incomplete: 0, dismissed: 0 },
};

describe('useSetupReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.setupReadiness.mockResolvedValue(emptySnapshot);
  });

  it('turns rejected actions into visible safe feedback instead of rejecting', async () => {
    apiMock.runSetupReadinessAction.mockRejectedValue(new Error('file:///private/runtime/setup.js failed'));
    const { result } = renderHook(() => useSetupReadiness());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.runAction('fixture', 'driver', 'install')).resolves.toBe(false);
    });

    expect(result.current.error).toBe('Setup could not be updated. Try again.');
    expect(result.current.error).not.toContain('file:///');
  });

  it('does not expose refresh failure details', async () => {
    apiMock.setupReadiness.mockRejectedValue(new Error('/api/readiness leaked a private path'));
    const { result } = renderHook(() => useSetupReadiness());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Setup status could not be refreshed. Try again.');
    expect(result.current.error).not.toContain('/api/');
  });
});
