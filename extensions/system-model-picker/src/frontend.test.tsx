import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ComposerControlContext } from '@neon-pilot/extensions/composer';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

vi.mock('@neon-pilot/extensions/ui', () => ({
  cx: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

import { ModelPreferencesComposerControl } from './frontend.js';

function createContext(overrides: Partial<ComposerControlContext> = {}): ComposerControlContext {
  return {
    composerDisabled: false,
    streamIsStreaming: false,
    composerHasContent: false,
    renderMode: 'inline',
    openFilePicker: vi.fn(),
    addFiles: vi.fn(),
    insertText: vi.fn(),
    appendText: vi.fn(),
    models: [
      { id: 'kimi-k2.5', provider: 'opencode-go', name: 'Kimi K2.5', context: 128_000 },
      { id: 'qwen3.7-max', provider: 'opencode-go', name: 'Qwen3.7 Max', context: 128_000 },
    ],
    currentModel: 'kimi-k2.5',
    currentThinkingLevel: 'off',
    savingPreference: null,
    selectModel: vi.fn(),
    selectThinkingLevel: vi.fn(),
    ...overrides,
  };
}

describe('ModelPreferencesComposerControl', () => {
  it('does not render stale current model ids as selectable options', () => {
    const html = renderToStaticMarkup(
      <ModelPreferencesComposerControl buttonContext={createContext({ currentModel: 'gpt-5.4' })} />,
    );

    expect(html).toContain('Kimi K2.5');
    expect(html).toContain('Qwen3.7 Max');
    expect(html).not.toContain('gpt-5.4');
  });
});
