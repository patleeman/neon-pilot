// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageProbeSettings } from '../../../../../extensions/system-image-probe/src/frontend';
import { api } from '../client/api';
import { useApi } from '../hooks/useApi';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

function buildUseApiResult<T>(data: T) {
  return {
    data,
    loading: false,
    refreshing: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(data),
    replaceData: vi.fn(),
  };
}

function renderPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ImageProbeSettings />);
  });

  mountedRoots.push(root);
  return { container };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function updateSelectValue(select: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (!descriptor?.set) {
    throw new Error('Expected HTMLSelectElement value setter');
  }

  act(() => {
    descriptor.set?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ImageProbeSettings', () => {
  let updateModelPreferencesMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    updateModelPreferencesMock = vi.spyOn(api, 'updateModelPreferences').mockResolvedValue(undefined);
    vi.mocked(useApi).mockImplementation((fetcher) => {
      if (fetcher === api.models) {
        return buildUseApiResult({
          currentModel: 'text-only',
          currentVisionModel: '',
          currentThinkingLevel: 'medium',
          currentServiceTier: '',
          models: [
            {
              id: 'text-only',
              provider: 'openai-codex',
              name: 'Text Only',
              context: 200000,
              input: ['text'],
              supportedServiceTiers: [],
            },
            {
              id: 'gpt-5.4',
              provider: 'openai-codex',
              name: 'GPT-5.4',
              context: 200000,
              input: ['text', 'image'],
              supportedServiceTiers: ['auto', 'priority'],
            },
          ],
        });
      }
      return buildUseApiResult(null);
    });
  });

  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders image-capable models and saves the selected vision model', async () => {
    const { container } = renderPanel();
    await flushAsyncWork();

    const visionSelect = container.querySelector<HTMLSelectElement>('#settings-image-probe-vision-model');
    expect(visionSelect).toBeInstanceOf(HTMLSelectElement);
    expect(visionSelect!.disabled).toBe(false);
    expect(visionSelect!.value).toBe('');
    expect(container.textContent).toContain('Vision model');
    expect(container.textContent).toContain('Not configured');
    expect(container.textContent).toContain('GPT-5.4');
    expect(container.textContent).not.toContain('Text Only');
    expect(container.querySelector('.ui-panel')).toBeNull();

    updateSelectValue(visionSelect!, 'openai-codex/gpt-5.4');
    await flushAsyncWork();

    expect(updateModelPreferencesMock).toHaveBeenCalledWith({
      visionModel: 'openai-codex/gpt-5.4',
    });
  });

  it('shows the configured vision model label', async () => {
    vi.mocked(useApi).mockImplementation((fetcher) => {
      if (fetcher === api.models) {
        return buildUseApiResult({
          currentModel: 'text-only',
          currentVisionModel: 'openai-codex/gpt-5.4',
          currentThinkingLevel: 'medium',
          currentServiceTier: '',
          models: [
            {
              id: 'gpt-5.4',
              provider: 'openai-codex',
              name: 'GPT-5.4',
              context: 200000,
              input: ['text', 'image'],
              supportedServiceTiers: ['auto', 'priority'],
            },
          ],
        });
      }
      return buildUseApiResult(null);
    });

    const { container } = renderPanel();
    await flushAsyncWork();

    const visionSelect = container.querySelector<HTMLSelectElement>('#settings-image-probe-vision-model');
    expect(visionSelect).toBeInstanceOf(HTMLSelectElement);
    expect(visionSelect!.value).toBe('openai-codex/gpt-5.4');
    expect(container.textContent).toContain('Image questions use openai-codex/gpt-5.4.');
  });
});
