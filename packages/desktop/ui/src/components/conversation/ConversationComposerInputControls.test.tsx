// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ModelInfo } from '../../shared/types';
import { COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, COMPOSER_OPEN_SETTINGS_COMMAND_EVENT } from './composerSettingsCommands';
import { ConversationComposerInputControls, setComposerFocusedCommandContext } from './ConversationComposerInputControls';
import { ConversationRunModePanel } from './ConversationRunModePanel';

const extensionRegistryState = vi.hoisted(() => ({
  composerControls: [
    {
      extensionId: 'system-composer-attachments',
      id: 'attach-files',
      component: 'AttachFilesComposerControl',
      slot: 'leading',
      priority: 0,
    },
    {
      extensionId: 'system-model-picker',
      id: 'model-preferences',
      component: 'ModelPreferencesComposerControl',
      slot: 'preferences',
      priority: 10,
    },
  ],
  composerInputTools: [] as Array<{
    extensionId: string;
    id: string;
    component: string;
    title?: string;
    priority?: number;
  }>,
  toolbarActions: [],
}));

const commandContextMock = vi.hoisted(() => ({
  setExtensionCommandContext: vi.fn(),
}));

vi.mock('../../extensions/commands', () => ({
  setExtensionCommandContext: commandContextMock.setExtensionCommandContext,
}));

vi.mock('../../extensions/ComposerButtonHost', () => ({
  ComposerButtonHost: ({
    controlContext,
    registration,
  }: {
    controlContext: { currentModel: string; currentThinkingLevel: string; models: ModelInfo[] };
    registration: { id: string };
  }) => {
    if (registration.id === 'attach-files') return <button title="Attach image or drawing">Attach</button>;
    if (registration.id === 'model-preferences') {
      const selectedModel = controlContext.models.find((model) => model.id === controlContext.currentModel);
      const modelLabel = selectedModel?.name ?? (controlContext.currentModel.trim() || 'Select model');
      const thinkingLabel = controlContext.currentThinkingLevel === 'xhigh' ? 'Extra high' : controlContext.currentThinkingLevel || 'Unset';
      return (
        <span data-control-id="extension-model-preferences">
          extension-model-preferences:{modelLabel}:{thinkingLabel}
          <button aria-label="Conversation model">{modelLabel}</button>
          <button aria-label="Conversation thinking level">{thinkingLabel}</button>
        </span>
      );
    }
    return <span>{registration.id}</span>;
  },
}));

vi.mock('../../extensions/ComposerInputToolHost', () => ({
  ComposerInputToolHost: ({ registration }: { registration: { id: string; title?: string } }) => (
    <button title={registration.title ?? registration.id}>{registration.id}</button>
  ),
}));

vi.mock('../../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => extensionRegistryState,
}));

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setTextAreaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

const models: ModelInfo[] = [
  {
    id: 'model-a',
    provider: 'Provider A',
    name: 'Model A',
    context: 128000,
    supportedServiceTiers: ['priority'],
  },
];

function renderInteractive(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });

  return {
    container,
    rerender: (nextElement: React.ReactElement) => {
      act(() => {
        root.render(nextElement);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function renderControls(overrides: Partial<React.ComponentProps<typeof ConversationComposerInputControls>> = {}) {
  return renderToString(
    <ConversationComposerInputControls
      fileInputRef={{ current: null }}
      textareaRef={{ current: null }}
      input=""
      pendingAskUserQuestion={false}
      composerDisabled={false}
      composerShellWidth={800}
      streamIsStreaming={false}
      models={models}
      currentModel="model-a"
      currentThinkingLevel="medium"
      currentServiceTier=""
      savingPreference={null}
      conversationNeedsTakeover={false}
      composerHasContent={false}
      composerShowsQuestionSubmit={false}
      composerQuestionCanSubmit={false}
      composerQuestionRemainingCount={0}
      composerQuestionSubmitting={false}
      composerSubmitLabel="Send"
      composerAltHeld={false}
      onFilesSelected={vi.fn()}
      onInputChange={vi.fn()}
      onRememberComposerSelection={vi.fn()}
      onKeyDown={vi.fn()}
      onPaste={vi.fn()}
      onOpenFilePicker={vi.fn()}
      onUpsertDrawingAttachment={vi.fn()}
      onSelectModel={vi.fn()}
      onSelectThinkingLevel={vi.fn()}
      onSelectServiceTier={vi.fn()}
      onInsertComposerText={vi.fn()}
      onAppendComposerText={vi.fn()}
      onSubmitComposerQuestion={vi.fn()}
      onSubmitComposerActionForModifiers={vi.fn()}
      onAbortStream={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ConversationComposerInputControls', () => {
  beforeEach(() => {
    commandContextMock.setExtensionCommandContext.mockClear();
    extensionRegistryState.composerControls = [
      {
        extensionId: 'system-composer-attachments',
        id: 'attach-files',
        component: 'AttachFilesComposerControl',
        slot: 'leading',
        priority: 0,
      },
      {
        extensionId: 'system-model-picker',
        id: 'model-preferences',
        component: 'ModelPreferencesComposerControl',
        slot: 'preferences',
        priority: 10,
      },
    ];
    extensionRegistryState.composerInputTools = [];
  });

  it('renders textarea, attachment controls, preferences, and disabled send', () => {
    const html = renderControls();

    expect(html).toContain('Message Neon Pilot');
    expect(html).toContain('Attach image or drawing');
    expect(html).toContain('extension-model-preferences:');
    expect(html).toContain('Model A');
    expect(html).toContain('medium');
    expect(html).not.toContain('<select');
    expect(html).toContain('Create drawing');
    expect(html).toContain('aria-label="Send"');
  });

  it('falls back to core composer controls when extension registry controls are unavailable', () => {
    extensionRegistryState.composerControls = [];
    extensionRegistryState.composerInputTools = [];

    const html = renderControls();

    expect(html).toContain('Attach image or drawing');
    expect(html).toContain('Conversation model');
    expect(html).toContain('Create drawing');
  });

  it('segments core model options by provider', () => {
    extensionRegistryState.composerControls = [];
    extensionRegistryState.composerInputTools = [];

    const html = renderControls({
      models: [
        { id: 'model-a', provider: 'Provider A', name: 'Model A', context: 128000 },
        { id: 'model-b', provider: 'Provider B', name: 'Model B', context: 128000 },
      ],
    });

    expect(html).toContain('<optgroup label="Provider A">');
    expect(html).toContain('<optgroup label="Provider B">');
  });

  it('allows the composer action row to wrap in narrow rail layouts', () => {
    const html = renderControls({ composerShellWidth: 320 });

    expect(html).toContain('border-t border-dashed border-border-subtle px-1 py-2 pb-0');
    expect(html).toContain('flex min-w-0 flex-wrap items-center gap-1.5 border-t border-dashed border-border-subtle px-1 py-2 pb-0');
    expect(html).toContain('flex min-w-0 flex-1 flex-wrap items-center gap-1.5');
    expect(html).toContain('More composer settings');
    expect(html).not.toContain('aria-label="Conversation model"');
    expect(html).not.toContain('aria-label="Thinking level"');
    expect(html).not.toContain(
      'flex min-w-0 flex-wrap items-center gap-1.5 border-t border-dashed border-border-subtle px-1 py-2 pb-0 flex-nowrap',
    );
    expect(html).toContain('ml-auto shrink-0');
  });

  it('opens model and thinking controls from the narrow composer settings menu', () => {
    const rendered = renderInteractive(
      <ConversationComposerInputControls
        fileInputRef={{ current: null }}
        textareaRef={{ current: null }}
        input=""
        pendingAskUserQuestion={false}
        composerDisabled={false}
        composerShellWidth={320}
        streamIsStreaming={false}
        models={models}
        currentModel="model-a"
        currentThinkingLevel="medium"
        currentServiceTier=""
        savingPreference={null}
        conversationNeedsTakeover={false}
        composerHasContent={false}
        composerShowsQuestionSubmit={false}
        composerQuestionCanSubmit={false}
        composerQuestionRemainingCount={0}
        composerQuestionSubmitting={false}
        composerSubmitLabel="Send"
        composerAltHeld={false}
        onFilesSelected={vi.fn()}
        onInputChange={vi.fn()}
        onRememberComposerSelection={vi.fn()}
        onKeyDown={vi.fn()}
        onPaste={vi.fn()}
        onOpenFilePicker={vi.fn()}
        onUpsertDrawingAttachment={vi.fn()}
        onSelectModel={vi.fn()}
        onSelectThinkingLevel={vi.fn()}
        onSelectServiceTier={vi.fn()}
        onInsertComposerText={vi.fn()}
        onAppendComposerText={vi.fn()}
        onSubmitComposerQuestion={vi.fn()}
        onSubmitComposerActionForModifiers={vi.fn()}
        onAbortStream={vi.fn()}
      />,
    );

    try {
      const menuButton = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="More composer settings"]');
      expect(menuButton).toBeTruthy();

      act(() => {
        menuButton!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      const menu = document.body.querySelector('[aria-label="Composer settings"]');
      expect(menu).toBeTruthy();
      expect(menu?.className).toContain('ui-context-menu-shell');
      expect(menu?.querySelector('[aria-label="Conversation model"]')).toBeTruthy();
      expect(menu?.querySelector('[aria-label="Conversation thinking level"]')).toBeTruthy();
      expect(menu?.textContent).toContain('extension-model-preferences:Model A:medium');
      expect(menuButton?.getAttribute('aria-expanded')).toBe('true');

      act(() => {
        window.dispatchEvent(new CustomEvent(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT));
      });

      expect(document.body.querySelector('[aria-label="Composer settings"]')).toBeNull();
      expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
    } finally {
      rendered.unmount();
    }
  });

  it('opens the narrow composer settings menu from the shared command event', () => {
    const rendered = renderInteractive(
      <ConversationComposerInputControls
        fileInputRef={{ current: null }}
        textareaRef={{ current: null }}
        input=""
        pendingAskUserQuestion={false}
        composerDisabled={false}
        composerShellWidth={320}
        streamIsStreaming={false}
        models={models}
        currentModel="model-a"
        currentThinkingLevel="medium"
        currentServiceTier=""
        savingPreference={null}
        conversationNeedsTakeover={false}
        composerHasContent={false}
        composerShowsQuestionSubmit={false}
        composerQuestionCanSubmit={false}
        composerQuestionRemainingCount={0}
        composerQuestionSubmitting={false}
        composerSubmitLabel="Send"
        composerAltHeld={false}
        onFilesSelected={vi.fn()}
        onInputChange={vi.fn()}
        onRememberComposerSelection={vi.fn()}
        onKeyDown={vi.fn()}
        onPaste={vi.fn()}
        onOpenFilePicker={vi.fn()}
        onUpsertDrawingAttachment={vi.fn()}
        onSelectModel={vi.fn()}
        onSelectThinkingLevel={vi.fn()}
        onSelectServiceTier={vi.fn()}
        onInsertComposerText={vi.fn()}
        onAppendComposerText={vi.fn()}
        onSubmitComposerQuestion={vi.fn()}
        onSubmitComposerActionForModifiers={vi.fn()}
        onAbortStream={vi.fn()}
      />,
    );

    try {
      expect(document.body.querySelector('[aria-label="Composer settings"]')).toBeNull();

      act(() => {
        window.dispatchEvent(new CustomEvent(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT));
      });

      const menu = document.body.querySelector('[aria-label="Composer settings"]');
      const menuButton = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="More composer settings"]');
      expect(menu).toBeTruthy();
      expect(menu?.querySelector('[aria-label="Conversation model"]')).toBeTruthy();
      expect(menu?.querySelector('[aria-label="Conversation thinking level"]')).toBeTruthy();
      expect(menu?.textContent).toContain('extension-model-preferences:Model A:medium');
      expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
    } finally {
      rendered.unmount();
    }
  });

  it('keeps the composer action row inline when the measured composer is wide enough', () => {
    const html = renderControls({ composerShellWidth: 640 });

    expect(html).toContain('flex-nowrap');
  });

  it('renders saved thinking preference labels before model metadata is loaded', () => {
    const html = renderControls({
      currentModel: 'openai/gpt-5.4',
      currentThinkingLevel: 'xhigh',
      models: [],
    });

    expect(html).toContain('openai/gpt-5.4');
    expect(html).toContain('Extra high');
  });

  it('renders question-submit states', () => {
    const html = renderControls({
      pendingAskUserQuestion: true,
      composerShowsQuestionSubmit: true,
      composerQuestionCanSubmit: true,
      composerSubmitLabel: 'Send',
    });

    expect(html).toContain('Answer 1-9, or type to skip…');
    expect(html).toContain('Submit answers');
  });

  it('keeps composer typing local when parent input echoes stale text', () => {
    const textareaRef: React.RefObject<HTMLTextAreaElement> = { current: null };
    const onInputChange = vi.fn();
    const baseProps: React.ComponentProps<typeof ConversationComposerInputControls> = {
      fileInputRef: { current: null },
      textareaRef,
      input: '',
      pendingAskUserQuestion: false,
      composerDisabled: false,
      composerShellWidth: 800,
      streamIsStreaming: false,
      models,
      currentModel: 'model-a',
      currentThinkingLevel: 'medium',
      currentServiceTier: '',
      savingPreference: null,
      conversationNeedsTakeover: false,
      composerHasContent: false,
      composerShowsQuestionSubmit: false,
      composerQuestionCanSubmit: false,
      composerQuestionRemainingCount: 0,
      composerQuestionSubmitting: false,
      composerSubmitLabel: 'Send',
      composerAltHeld: false,
      onFilesSelected: vi.fn(),
      onInputChange,
      onRememberComposerSelection: vi.fn(),
      onKeyDown: vi.fn(),
      onPaste: vi.fn(),
      onOpenFilePicker: vi.fn(),
      onUpsertDrawingAttachment: vi.fn(),
      onSelectModel: vi.fn(),
      onSelectThinkingLevel: vi.fn(),
      onSelectServiceTier: vi.fn(),
      onInsertComposerText: vi.fn(),
      onAppendComposerText: vi.fn(),
      onSubmitComposerQuestion: vi.fn(),
      onSubmitComposerActionForModifiers: vi.fn(),
      onAbortStream: vi.fn(),
    };
    const rendered = renderInteractive(<ConversationComposerInputControls {...baseProps} />);

    try {
      const textarea = rendered.container.querySelector<HTMLTextAreaElement>('textarea');
      expect(textarea).toBeTruthy();

      act(() => {
        textarea!.focus();
        setTextAreaValue(textarea!, 'ab');
      });
      expect(textarea!.value).toBe('ab');
      expect(onInputChange).toHaveBeenCalledWith('ab', textarea);

      rendered.rerender(<ConversationComposerInputControls {...baseProps} input="a" />);
      expect(textarea!.value).toBe('ab');

      rendered.rerender(<ConversationComposerInputControls {...baseProps} input="" />);
      expect(textarea!.value).toBe('');
    } finally {
      rendered.unmount();
    }
  });

  it('publishes composer focus command context for scoped keybindings', () => {
    const textareaRef: React.RefObject<HTMLTextAreaElement> = { current: null };
    const rendered = renderInteractive(
      <ConversationComposerInputControls
        fileInputRef={{ current: null }}
        textareaRef={textareaRef}
        input=""
        pendingAskUserQuestion={false}
        composerDisabled={false}
        composerShellWidth={800}
        streamIsStreaming={false}
        models={models}
        currentModel="model-a"
        currentThinkingLevel="medium"
        currentServiceTier=""
        savingPreference={null}
        conversationNeedsTakeover={false}
        composerHasContent={false}
        composerShowsQuestionSubmit={false}
        composerQuestionCanSubmit={false}
        composerQuestionRemainingCount={0}
        composerQuestionSubmitting={false}
        composerSubmitLabel="Send"
        composerAltHeld={false}
        onFilesSelected={vi.fn()}
        onInputChange={vi.fn()}
        onRememberComposerSelection={vi.fn()}
        onKeyDown={vi.fn()}
        onPaste={vi.fn()}
        onOpenFilePicker={vi.fn()}
        onUpsertDrawingAttachment={vi.fn()}
        onSelectModel={vi.fn()}
        onSelectThinkingLevel={vi.fn()}
        onSelectServiceTier={vi.fn()}
        onInsertComposerText={vi.fn()}
        onAppendComposerText={vi.fn()}
        onSubmitComposerQuestion={vi.fn()}
        onSubmitComposerActionForModifiers={vi.fn()}
        onAbortStream={vi.fn()}
      />,
    );

    try {
      const textarea = rendered.container.querySelector<HTMLTextAreaElement>('textarea');
      expect(textarea).toBeTruthy();

      act(() => {
        textarea!.focus();
      });
      expect(commandContextMock.setExtensionCommandContext).toHaveBeenLastCalledWith('composer.focused', true);

      act(() => {
        textarea!.blur();
      });
      expect(commandContextMock.setExtensionCommandContext).toHaveBeenLastCalledWith('composer.focused', false);

      act(() => {
        setComposerFocusedCommandContext(true);
      });
      rendered.unmount();
      expect(commandContextMock.setExtensionCommandContext).toHaveBeenCalledWith('composer.focused', null);
    } finally {
      if (document.body.contains(rendered.container)) {
        rendered.unmount();
      }
    }
  });

  it('renders active mission tasks in the run-mode shelf', () => {
    const html = renderToString(
      <ConversationRunModePanel
        mode="mission"
        running
        mission={{
          goal: 'Fix the page',
          tasks: [
            { id: 't1', description: 'Run tests', status: 'done' },
            { id: 't2', description: 'Patch bug', status: 'pending' },
          ],
        }}
        onAddMissionTask={vi.fn()}
      />,
    );

    expect(html).toContain('Tasks');
    expect(html).toContain('Patch bug');
    expect(html).toContain('aria-label="Mission goal"');
    expect(html).toContain('aria-label="Add mission task"');
    expect(html).not.toContain('aria-label="Mission goal" disabled');
    expect(html).not.toContain('Goal: what should be accomplished?');
  });

  it('commits mission goal edit on blur', () => {
    const onDraftMissionChange = vi.fn();
    const rendered = renderInteractive(
      <ConversationRunModePanel
        mode="mission"
        running
        mission={{
          goal: 'Fix the page',
          tasks: [{ id: 't1', description: 'Run tests', status: 'pending' }],
        }}
        onDraftMissionChange={onDraftMissionChange}
      />,
    );

    try {
      const goal = rendered.container.querySelector<HTMLInputElement>('input[aria-label="Mission goal"]');
      expect(goal).toBeTruthy();

      act(() => {
        setInputValue(goal!, 'Ship the thing');
        goal!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });
      expect(onDraftMissionChange).toHaveBeenLastCalledWith({ goal: 'Ship the thing' });
    } finally {
      rendered.unmount();
    }
  });

  it('submits and clears manually added mission tasks', () => {
    const onAddMissionTask = vi.fn();
    const rendered = renderInteractive(
      <ConversationRunModePanel
        mode="mission"
        running
        mission={{
          goal: 'Fix the page',
          tasks: [],
        }}
        onAddMissionTask={onAddMissionTask}
      />,
    );

    try {
      const taskInput = rendered.container.querySelector<HTMLInputElement>('input[aria-label="Add mission task"]');
      const addButton = rendered.container.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(taskInput).toBeTruthy();
      expect(addButton).toBeTruthy();
      expect(addButton!.disabled).toBe(true);

      act(() => {
        setInputValue(taskInput!, '  Inspect persistence  ');
      });
      expect(addButton!.disabled).toBe(false);

      act(() => {
        addButton!.click();
      });
      expect(onAddMissionTask).toHaveBeenCalledWith('Inspect persistence');
      expect(taskInput!.value).toBe('');
      expect(addButton!.disabled).toBe(true);
    } finally {
      rendered.unmount();
    }
  });

  it('keeps active loop controls visible in the run-mode shelf', () => {
    const html = renderToString(
      <ConversationRunModePanel
        mode="loop"
        running
        draftLoop={{ prompt: 'Find bugs', maxIterations: 5, delay: '2s' }}
        loop={{
          prompt: 'Find bugs',
          maxIterations: 5,
          iterationsUsed: 2,
          delay: '2s',
        }}
      />,
    );

    expect(html).toContain('Run');
    expect(html).toContain('Prompt to repeat each iteration');
    expect(html).toContain('aria-label="Loop prompt"');
    expect(html).toContain('aria-label="Loop max iterations"');
    expect(html).toContain('aria-label="Loop delay"');
    expect(html).toContain('<select');
    expect(html).toContain('value="2s"');
    expect(html).not.toContain('>Repeat</span>');
  });
});
