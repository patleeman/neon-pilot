// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { formatModelTriggerLabel, MODEL_PICKER_MENU_STYLE, ModelPreferencesComposerControl } from './frontend';

describe('formatModelTriggerLabel', () => {
  it('keeps the model menu scrollable when shared menu chrome clips overflow', () => {
    expect(MODEL_PICKER_MENU_STYLE).toEqual({
      maxHeight: 'calc(min(20rem, calc(100vh - 4rem)) - 0.75rem)',
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

  it('shows service tier choices inside the combined picker for models that support them', () => {
    const selectServiceTier = vi.fn();
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
              supportedServiceTiers: ['auto', 'priority'],
            },
          ],
          currentModel: 'gpt-5.4',
          currentThinkingLevel: '',
          currentServiceTier: '',
          savingPreference: null,
          selectModel: vi.fn(),
          selectThinkingLevel: vi.fn(),
          selectServiceTier,
        },
      }),
    );

    expect(screen.getByLabelText('Conversation model preferences')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Conversation model preferences'));
    expect(screen.queryByText('Priority')).toBeNull();

    fireEvent.pointerEnter(screen.getByText('Speed'));

    expect(screen.getAllByText('Standard').length).toBeGreaterThan(0);
    expect(screen.getByText('Automatic')).toBeTruthy();
    expect(screen.getByText('Priority')).toBeTruthy();
    expect(screen.queryByText('Default speed')).toBeNull();

    fireEvent.click(screen.getByText('Priority'));
    expect(selectServiceTier).toHaveBeenCalledWith('priority');
  });

  it('uses a three-category parent menu with hover flyouts', () => {
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
              id: 'gpt-5.5',
              provider: 'openai-codex',
              name: 'GPT-5.5',
              context: 400000,
              input: ['text'],
              supportedServiceTiers: ['priority'],
              reasoning: true,
            },
          ],
          currentModel: 'gpt-5.5',
          currentThinkingLevel: 'medium',
          currentServiceTier: '',
          savingPreference: null,
          selectModel: vi.fn(),
          selectThinkingLevel: vi.fn(),
          selectServiceTier: vi.fn(),
        },
      }),
    );

    fireEvent.click(screen.getByLabelText('Conversation model preferences'));
    expect(screen.queryByText('X High')).toBeNull();

    const parentRows = screen
      .getAllByRole('menuitem')
      .filter(
        (item) => item.textContent === 'ModelGPT-5.5' || item.textContent === 'ThinkingMedium' || item.textContent === 'SpeedStandard',
      );
    expect(parentRows.map((item) => item.textContent)).toEqual(['ModelGPT-5.5', 'ThinkingMedium', 'SpeedStandard']);

    fireEvent.pointerEnter(screen.getByText('Thinking'));
    expect(screen.getByText('Low')).toBeTruthy();
    expect(screen.getByText('X High')).toBeTruthy();
  });

  it('labels an inherited visible service tier instead of the default placeholder', () => {
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
              id: 'gpt-5.4-mini',
              provider: 'openai-codex',
              name: 'GPT-5.4 mini',
              context: 272000,
              input: ['text'],
              supportedServiceTiers: ['priority'],
            },
          ],
          currentModel: 'gpt-5.4-mini',
          currentThinkingLevel: 'high',
          currentServiceTier: 'priority',
          savingPreference: null,
          selectModel: vi.fn(),
          selectThinkingLevel: vi.fn(),
          selectServiceTier: vi.fn(),
        },
      }),
    );

    expect(screen.getByLabelText('Conversation model preferences').textContent).toContain('Priority');
    expect(screen.getByText('Speed').parentElement?.textContent).toContain('Priority');
  });

  it('uses readable provider group labels in the combined composer picker', () => {
    const selectModel = vi.fn();
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
          models: [{ id: 'gpt-5.5', provider: 'openai-codex', name: 'GPT-5.5', context: 400000, input: ['text'] }],
          currentModel: 'gpt-5.5',
          currentThinkingLevel: '',
          currentServiceTier: '',
          savingPreference: null,
          selectModel,
          selectThinkingLevel: vi.fn(),
          selectServiceTier: vi.fn(),
        },
      }),
    );

    fireEvent.click(screen.getByLabelText('Conversation model preferences'));
    expect(screen.queryByText('OpenAI Codex')).toBeNull();
    fireEvent.pointerEnter(screen.getByText('Model'));
    expect(screen.getByText('OpenAI Codex')).toBeTruthy();
    expect(screen.queryByText('openai-codex')).toBeNull();

    fireEvent.click(screen.getAllByText('GPT-5.5').at(-1)!);
    expect(selectModel).toHaveBeenCalledWith('gpt-5.5');
  });
});
