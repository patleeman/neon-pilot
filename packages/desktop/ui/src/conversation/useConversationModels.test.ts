// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockModels = vi.hoisted(() => vi.fn());
const mockModelPreferences = vi.hoisted(() => vi.fn());

vi.mock('../client/api', () => ({
  api: {
    models: mockModels,
    modelPreferences: mockModelPreferences,
  },
}));

import { useConversationModels } from './useConversationModels.js';

describe('useConversationModels', () => {
  beforeEach(() => {
    mockModels.mockReset();
    mockModelPreferences.mockReset();
  });

  it('loads saved model preferences even when full model loading is disabled', async () => {
    mockModelPreferences.mockResolvedValue({
      currentModel: 'gpt-5.4',
      currentVisionModel: 'openai/gpt-4o',
      currentThinkingLevel: 'xhigh',
      currentServiceTier: 'priority',
    });

    const { result } = renderHook(() => useConversationModels(false));

    await waitFor(() => expect(result.current.defaultModel).toBe('gpt-5.4'));
    expect(result.current.models).toEqual([]);
    expect(result.current.defaultVisionModel).toBe('openai/gpt-4o');
    expect(result.current.defaultThinkingLevel).toBe('xhigh');
    expect(result.current.defaultServiceTier).toBe('priority');
    expect(mockModels).not.toHaveBeenCalled();
  });

  it('fetches models when enabled', async () => {
    mockModelPreferences.mockResolvedValue({
      currentModel: 'gpt-5',
      currentVisionModel: 'openai/gpt-4o',
      currentThinkingLevel: 'high',
      currentServiceTier: 'standard',
    });
    mockModels.mockResolvedValue({
      models: [{ id: 'gpt-5', name: 'GPT-5', provider: 'openai' }],
      currentModel: 'gpt-5',
      currentVisionModel: 'openai/gpt-4o',
      currentThinkingLevel: 'high',
      currentServiceTier: 'standard',
    });

    const { result } = renderHook(() => useConversationModels(true));

    await waitFor(() => expect(result.current.models.length).toBeGreaterThan(0));
    expect(result.current.defaultModel).toBe('gpt-5');
    expect(result.current.defaultVisionModel).toBe('openai/gpt-4o');
    expect(result.current.defaultThinkingLevel).toBe('high');
    expect(result.current.defaultServiceTier).toBe('standard');
  });

  it('handles api error gracefully', async () => {
    mockModelPreferences.mockRejectedValue(new Error('Network error'));
    mockModels.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useConversationModels(true));

    // Wait for effects to settle
    await vi.waitFor(() => {});
    expect(result.current.models).toEqual([]);
  });
});
