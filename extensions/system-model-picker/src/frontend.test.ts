// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { formatModelTriggerLabel, MODEL_PICKER_MENU_STYLE, ModelPreferencesComposerControl } from './frontend';

describe('formatModelTriggerLabel', () => {
  it('keeps the model menu scrollable when shared menu chrome clips overflow', () => {
    expect(MODEL_PICKER_MENU_STYLE).toEqual({
      maxHeight: 'min(20rem, calc(100vh - 7rem))',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    });
  });

  it('shows the saved current model while model metadata is still loading', () => {
    expect(formatModelTriggerLabel({ models: [], currentModel: 'gpt-5.4' })).toBe('gpt-5.4');
  });

  it('prefers the model display name once metadata is loaded', () => {
    expect(
      formatModelTriggerLabel({
        currentModel: 'gpt-5.4',
        models: [{ id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4', context: 272000, input: ['text'] }],
      }),
    ).toBe('GPT-5.4');
  });

  it('keeps DS4 health visible when composer preferences collapse into the menu', async () => {
    render(
      React.createElement(ModelPreferencesComposerControl, {
        pa: {
          extensions: {
            callAction: vi.fn(async () => ({
              reachable: false,
              runtime: { installed: true },
              server: { managedRunning: false },
            })),
          },
        },
        controlContext: {
          renderMode: 'menu',
          composerDisabled: false,
          streamIsStreaming: false,
          composerHasContent: false,
          openFilePicker: vi.fn(),
          addFiles: vi.fn(),
          insertText: vi.fn(),
          appendText: vi.fn(),
          models: [{ id: 'deepseek-v4-flash', provider: 'ds4', name: 'DeepSeek V4 Flash', context: 200000, input: ['text'] }],
          currentModel: 'deepseek-v4-flash',
          currentThinkingLevel: 'off',
          currentServiceTier: '',
          savingPreference: null,
          selectModel: vi.fn(),
          selectThinkingLevel: vi.fn(),
          selectServiceTier: vi.fn(),
        },
      }),
    );

    expect(screen.getByLabelText(/DS4 (checking|offline) menu/)).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('DS4 offline menu')).toBeTruthy());
  });

  it('shows service tier choices for models that support them', () => {
    render(
      React.createElement(ModelPreferencesComposerControl, {
        pa: { extensions: { callAction: vi.fn() } },
        controlContext: {
          renderMode: 'inline',
          composerDisabled: false,
          streamIsStreaming: false,
          composerHasContent: false,
          openFilePicker: vi.fn(),
          addFiles: vi.fn(),
          insertText: vi.fn(),
          appendText: vi.fn(),
          models: [
            {
              id: 'gpt-5.4',
              provider: 'openai-codex',
              name: 'GPT-5.4',
              context: 272000,
              input: ['text'],
              supportedServiceTiers: ['priority'],
            },
          ],
          currentModel: 'gpt-5.4',
          currentThinkingLevel: '',
          currentServiceTier: '',
          savingPreference: null,
          selectModel: vi.fn(),
          selectThinkingLevel: vi.fn(),
          selectServiceTier: vi.fn(),
        },
      }),
    );

    expect(screen.getByLabelText('Conversation service tier')).toBeTruthy();
    expect(screen.getAllByText('Automatic').length).toBeGreaterThan(0);
    expect(screen.getByText('Priority')).toBeTruthy();
  });
});
