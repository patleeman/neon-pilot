import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveDesktopRootLayout } from '@neon-pilot/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveDocumentsDbPathFromLayout } from '../documents/store.js';
import {
  abortExtensionShellSpawnHandlesForConversation,
  createExtensionBackendCapabilityDispatcher,
} from './extensionBackendCapabilities.js';

const findExtensionEntry = vi.hoisted(() =>
  vi.fn(() => ({
    manifest: {
      permissions: [
        'commands:execute',
        'commands:read',
        'conversations:readwrite',
        'filesystem:readwrite',
        'git:read',
        'secrets:read',
        'settings:readwrite',
        'shell:execute',
        'storage:readwrite',
        'automations:readwrite',
        'telemetry:write',
        'ui:confirm',
        'ui:invalidate',
        'ui:notify',
        'workspace:readwrite',
      ],
    },
  })),
);
const terminalSessions = vi.hoisted(() => ({
  closeTerminalSession: vi.fn(),
  createTerminalSession: vi.fn(async () => ({ id: 'term-1', pid: 123, usingPty: true, initialOutput: '' })),
  drainTerminalSession: vi.fn(),
  resizeTerminalSession: vi.fn(),
  streamTerminalSession: vi.fn(),
  writeTerminalSession: vi.fn(),
}));
const agentApi = vi.hoisted(() => ({
  createAgentConversation: vi.fn(async () => ({ conversationId: 'agent-conv-1' })),
  sendAgentMessage: vi.fn(async () => ({ ok: true })),
  runAgentTask: vi.fn(async () => ({ ok: true, result: 'task done' })),
  getAgentConversation: vi.fn(async () => ({ conversationId: 'agent-conv-1' })),
  listAgentConversations: vi.fn(async () => [{ conversationId: 'agent-conv-1' }]),
  abortAgentConversation: vi.fn(async () => ({ ok: true })),
  disposeAgentConversation: vi.fn(async () => ({ ok: true })),
  streamAgentMessage: vi.fn(async () => ({ events: [] })),
}));

const workbenchBrowserToolHost = vi.hoisted(() => ({
  cdp: vi.fn(async () => ({ ok: true })),
  isActive: vi.fn(async () => true),
  listTabs: vi.fn(async () => [{ id: 'tab-1', title: 'Docs' }]),
  screenshot: vi.fn(async () => ({ data: 'png' })),
  snapshot: vi.fn(async () => ({ title: 'Docs' })),
}));

vi.mock('./extensionRegistry.js', () => ({
  findExtensionCommandRegistration: vi.fn(),
  findExtensionEntry,
  listExtensionCommandRegistrations: vi.fn(() => []),
  listExtensionInstallSummaries: vi.fn(() => []),
  setExtensionEnabled: vi.fn(),
}));
vi.mock('./terminalSessions.js', () => terminalSessions);
vi.mock('./workbenchBrowserToolHost.js', () => ({
  getWorkbenchBrowserToolHost: vi.fn(() => workbenchBrowserToolHost),
}));
vi.mock('./backendApi/agent.js', () => agentApi);

describe('extension backend capability dispatcher', () => {
  beforeEach(() => {
    findExtensionEntry.mockReturnValue({
      manifest: {
        permissions: [
          'commands:execute',
          'commands:read',
          'conversations:readwrite',
          'filesystem:readwrite',
          'git:read',
          'secrets:read',
          'settings:readwrite',
          'shell:execute',
          'storage:readwrite',
          'automations:readwrite',
          'telemetry:write',
          'ui:confirm',
          'ui:invalidate',
          'ui:notify',
          'workspace:readwrite',
        ],
      },
    });
    agentApi.createAgentConversation.mockClear();
    agentApi.sendAgentMessage.mockClear();
    agentApi.runAgentTask.mockClear();
    agentApi.getAgentConversation.mockClear();
    agentApi.listAgentConversations.mockClear();
    agentApi.abortAgentConversation.mockClear();
    agentApi.disposeAgentConversation.mockClear();
    agentApi.streamAgentMessage.mockClear();
  });

  it('dispatches extension-scoped live conversation capability calls', async () => {
    const conversations = {
      get: vi.fn(async () => ({ id: 'conv-1', running: false, toolNames: ['read'] })),
      getMeta: vi.fn(async () => ({ id: 'conv-1', currentModel: 'gpt-5' })),
      getBlocks: vi.fn(async () => ({ blocks: [{ type: 'user', text: 'Prompt' }] })),
      create: vi.fn(async () => ({ id: 'conv-2', conversationId: 'conv-2' })),
      setActiveTools: vi.fn(async () => ({ conversationId: 'conv-1', toolNames: ['read'] })),
      appendCustomEntry: vi.fn(async () => ({ ok: true })),
      appendTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
      updateTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
      getWorkspace: vi.fn(async () => ({ openConversationIds: ['conv-1'], activeConversationId: 'conv-1' })),
      updateWorkspace: vi.fn(async () => ({ openConversationIds: ['conv-1', 'conv-2'], activeConversationId: 'conv-2' })),
      rollback: vi.fn(async () => ({ rolledBackTo: 'entry-1' })),
      ensureLive: vi.fn(async () => ({ id: 'conv-1', conversationId: 'conv-1' })),
      requestWorkingDirectoryChange: vi.fn(async () => ({ conversationId: 'conv-1', cwd: '/next', queued: true })),
      sendMessage: vi.fn(async () => ({ accepted: true })),
      abort: vi.fn(async () => ({ ok: true })),
      compact: vi.fn(async () => ({ ok: true })),
      fork: vi.fn(async () => ({ id: 'conv-fork', conversationId: 'conv-fork' })),
      setTitle: vi.fn(async () => ({ ok: true })),
      delete: vi.fn(async () => ({ ok: true, deleted: [{ id: 'conv-old' }] })),
      metadata: {
        get: vi.fn(),
        set: vi.fn(),
        query: vi.fn(),
      },
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'get',
          input: { conversationId: 'conv-1' },
        }),
      ),
    ).resolves.toEqual({ id: 'conv-1', running: false, toolNames: ['read'] });
    await expect(
      Promise.resolve(
        dispatch({
          id: 17,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'getMeta',
          input: { conversationId: 'conv-1' },
        }),
      ),
    ).resolves.toEqual({ id: 'conv-1', currentModel: 'gpt-5' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 18,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'getBlocks',
          input: { conversationId: 'conv-1', tailBlocks: 120 },
        }),
      ),
    ).resolves.toEqual({ blocks: [{ type: 'user', text: 'Prompt' }] });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'setActiveTools',
          input: { conversationId: 'conv-1', toolNames: ['read'] },
        }),
      ),
    ).resolves.toEqual({ conversationId: 'conv-1', toolNames: ['read'] });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'appendCustomEntry',
          input: { conversationId: 'conv-1', customType: 'conversation-tools-state', data: { enabled: true } },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'system-onboarding',
          capability: 'conversations',
          operation: 'create',
          input: { cwd: '/repo', title: 'Welcome', live: false },
        }),
      ),
    ).resolves.toEqual({ id: 'conv-2', conversationId: 'conv-2' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 5,
          kind: 'capabilityRequest',
          extensionId: 'system-onboarding',
          capability: 'conversations',
          operation: 'appendTranscriptBlock',
          input: { conversationId: 'conv-2', blockType: 'onboarding_intro', title: 'Welcome', data: { source: 'system-onboarding' } },
        }),
      ),
    ).resolves.toEqual({ blockId: 'block-1' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 6,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'updateTranscriptBlock',
          input: { conversationId: 'conv-2', blockType: 'note', blockId: 'block-1', title: 'Note', data: { ok: false } },
        }),
      ),
    ).resolves.toEqual({ blockId: 'block-1' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 7,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'getWorkspace',
          input: {},
        }),
      ),
    ).resolves.toEqual({ openConversationIds: ['conv-1'], activeConversationId: 'conv-1' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 8,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'updateWorkspace',
          input: { openConversationIds: ['conv-1', 'conv-2'], activeConversationId: 'conv-2' },
        }),
      ),
    ).resolves.toEqual({ openConversationIds: ['conv-1', 'conv-2'], activeConversationId: 'conv-2' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 9,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'rollback',
          input: { conversationId: 'conv-1', count: 2 },
        }),
      ),
    ).resolves.toEqual({ rolledBackTo: 'entry-1' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 10,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'ensureLive',
          input: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      ),
    ).resolves.toEqual({ id: 'conv-1', conversationId: 'conv-1' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 11,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'requestWorkingDirectoryChange',
          input: { conversationId: 'conv-1', cwd: '/next', continuePrompt: 'Continue there.' },
        }),
      ),
    ).resolves.toEqual({ conversationId: 'conv-1', cwd: '/next', queued: true });
    expect(conversations.requestWorkingDirectoryChange).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', '/next', {
      continuePrompt: 'Continue there.',
    });
    await expect(
      Promise.resolve(
        dispatch({
          id: 12,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'sendMessage',
          input: {
            conversationId: 'conv-1',
            text: 'Go',
            steer: true,
            images: [{ data: 'abc', mimeType: 'image/png', name: 'image.png' }],
          },
        }),
      ),
    ).resolves.toEqual({ accepted: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 13,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'abort',
          input: { conversationId: 'conv-1' },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 13,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'compact',
          input: { conversationId: 'conv-1', customInstructions: 'short' },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 14,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'fork',
          input: {
            conversationId: 'conv-1',
            targetCwd: '/fork',
            atBlockId: 'user-1-x0',
            beforeEntry: true,
            title: 'Fork',
            model: 'anthropic/claude-sonnet',
          },
        }),
      ),
    ).resolves.toEqual({ id: 'conv-fork', conversationId: 'conv-fork' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 15,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'setTitle',
          input: { conversationId: 'conv-1', title: 'New Title' },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 16,
          kind: 'capabilityRequest',
          extensionId: 'system-conversation-tools',
          capability: 'conversations',
          operation: 'delete',
          input: {
            conversationIds: ['conv-old'],
            runtimeScope: 'shared',
            runtimeSettingsFilePath: '/runtime/settings.json',
          },
        }),
      ),
    ).resolves.toEqual({ ok: true, deleted: [{ id: 'conv-old' }] });

    expect(conversations.get).toHaveBeenCalledWith('system-conversation-tools', 'conv-1');
    expect(conversations.getMeta).toHaveBeenCalledWith('system-conversation-tools', 'conv-1');
    expect(conversations.getBlocks).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', { tailBlocks: 120 });
    expect(conversations.setActiveTools).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', ['read']);
    expect(conversations.appendCustomEntry).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', 'conversation-tools-state', {
      enabled: true,
    });
    expect(conversations.create).toHaveBeenCalledWith('system-onboarding', { cwd: '/repo', title: 'Welcome', live: false });
    expect(conversations.appendTranscriptBlock).toHaveBeenCalledWith('system-onboarding', {
      conversationId: 'conv-2',
      blockType: 'onboarding_intro',
      title: 'Welcome',
      data: { source: 'system-onboarding' },
    });
    expect(conversations.updateTranscriptBlock).toHaveBeenCalledWith('system-conversation-tools', {
      conversationId: 'conv-2',
      blockType: 'note',
      blockId: 'block-1',
      title: 'Note',
      data: { ok: false },
    });
    expect(conversations.getWorkspace).toHaveBeenCalledWith('system-conversation-tools', {});
    expect(conversations.updateWorkspace).toHaveBeenCalledWith('system-conversation-tools', {
      openConversationIds: ['conv-1', 'conv-2'],
      activeConversationId: 'conv-2',
    });
    expect(conversations.rollback).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', 2);
    expect(conversations.ensureLive).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', { cwd: '/repo' });
    expect(conversations.sendMessage).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', 'Go', {
      steer: true,
      images: [{ data: 'abc', mimeType: 'image/png', name: 'image.png' }],
    });
    expect(conversations.abort).toHaveBeenCalledWith('system-conversation-tools', 'conv-1');
    expect(conversations.compact).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', 'short');
    expect(conversations.fork).toHaveBeenCalledWith('system-conversation-tools', {
      conversationId: 'conv-1',
      targetCwd: '/fork',
      atBlockId: 'user-1-x0',
      beforeEntry: true,
      title: 'Fork',
      model: 'anthropic/claude-sonnet',
    });
    expect(conversations.setTitle).toHaveBeenCalledWith('system-conversation-tools', 'conv-1', 'New Title');
    expect(conversations.delete).toHaveBeenCalledWith('system-conversation-tools', {
      conversationIds: ['conv-old'],
      runtimeScope: 'shared',
      runtimeSettingsFilePath: '/runtime/settings.json',
    });
  });

  it('returns final run-turn text from agent_end when no text deltas are emitted', async () => {
    const conversations = {
      runTurn: vi.fn(
        async (_extensionId: string, _conversationId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
          options?.onEvent?.({ type: 'agent_end', text: 'final answer' });
          return { accepted: true };
        },
      ),
      metadata: { get: vi.fn(), set: vi.fn(), query: vi.fn() },
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(
      Promise.resolve(
        dispatch(
          {
            id: 1,
            kind: 'capabilityRequest',
            extensionId: 'system-conversation-tools',
            capability: 'conversations',
            operation: 'runTurn',
            input: {
              conversationId: 'conv-1',
              text: 'Use a tool',
              runTurnEventHandleId: 'events-1',
            },
          },
          vi.fn(),
        ),
      ),
    ).resolves.toEqual({ accepted: true, text: 'final answer' });
  });

  it('rejects malformed live conversation capability inputs', async () => {
    const conversations = {
      get: vi.fn(),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
      metadata: { get: vi.fn(), set: vi.fn(), query: vi.fn() },
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'system-conversation-tools',
        capability: 'conversations',
        operation: 'setActiveTools',
        input: { conversationId: 'conv-1', toolNames: ['read', 1] },
      }),
    ).rejects.toThrow('Conversation tool names must be an array of strings.');
  });

  it('dispatches extension-scoped conversation metadata capability calls', async () => {
    const conversations = {
      get: vi.fn(),
      setActiveTools: vi.fn(),
      appendCustomEntry: vi.fn(),
      metadata: {
        get: vi.fn(async () => ({ items: [] })),
        set: vi.fn(async () => ({ items: [{ id: 'todo-1' }] })),
        query: vi.fn(async () => [{ conversationId: 'conv-1', metadata: { items: [] } }]),
      },
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-todo',
          capability: 'conversations',
          operation: 'metadata.get',
          input: { conversationId: 'conv-1', namespace: 'todos', runtimeScope: 'shared' },
        }),
      ),
    ).resolves.toEqual({ items: [] });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'system-todo',
          capability: 'conversations',
          operation: 'metadata.set',
          input: { conversationId: 'conv-1', values: { items: [{ id: 'todo-1' }] }, runtimeScope: 'shared' },
        }),
      ),
    ).resolves.toEqual({ items: [{ id: 'todo-1' }] });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'system-todo',
          capability: 'conversations',
          operation: 'metadata.query',
          input: { namespace: 'todos', where: [{ key: 'status', op: 'eq', value: 'open' }], limit: 5, runtimeScope: 'shared' },
        }),
      ),
    ).resolves.toEqual([{ conversationId: 'conv-1', metadata: { items: [] } }]);

    expect(conversations.metadata.get).toHaveBeenCalledWith('system-todo', {
      conversationId: 'conv-1',
      namespace: 'todos',
      runtimeScope: 'shared',
    });
    expect(conversations.metadata.set).toHaveBeenCalledWith('system-todo', {
      conversationId: 'conv-1',
      values: { items: [{ id: 'todo-1' }] },
      runtimeScope: 'shared',
    });
    expect(conversations.metadata.query).toHaveBeenCalledWith('system-todo', {
      namespace: 'todos',
      where: [{ key: 'status', op: 'eq', value: 'open' }],
      limit: 5,
      runtimeScope: 'shared',
    });
  });

  it('rejects malformed conversation metadata capability inputs', async () => {
    const conversations = { metadata: { get: vi.fn(), set: vi.fn(), query: vi.fn() } };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'system-todo',
        capability: 'conversations',
        operation: 'metadata.set',
        input: { conversationId: 'conv-1', values: [] },
      }),
    ).rejects.toThrow('Conversation metadata values must be an object when provided.');
  });

  it('dispatches extension-scoped event publish capability calls', async () => {
    const events = {
      publish: vi.fn(async () => undefined),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ events });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'events',
          operation: 'publish',
          input: { event: 'task:completed', payload: { taskId: 'task-1' } },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(events.publish).toHaveBeenCalledWith('ext', 'task:completed', { taskId: 'task-1' });
  });

  it('rejects malformed event publish capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ events: { publish: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'events',
        operation: 'publish',
        input: { event: 1, payload: {} },
      }),
    ).rejects.toThrow('Event name must be a string.');
  });

  it('dispatches extension registry capability calls', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: {
        permissions: ['extensions:read', 'extensions:write'],
      },
    });
    const extensions = {
      listActions: vi.fn(() => [{ extensionId: 'ext-a', extensionName: 'Ext A', actions: [{ id: 'run' }] }]),
      getStatus: vi.fn(() => ({ enabled: true, healthy: true })),
      setEnabled: vi.fn(() => undefined),
      setPermissionGranted: vi.fn(() => undefined),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ extensions });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'extensions',
          operation: 'listActions',
        }),
      ),
    ).resolves.toEqual([{ extensionId: 'ext-a', extensionName: 'Ext A', actions: [{ id: 'run' }] }]);
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'extensions',
          operation: 'getStatus',
          input: { extensionId: 'ext-a' },
        }),
      ),
    ).resolves.toEqual({ enabled: true, healthy: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'extensions',
          operation: 'setEnabled',
          input: { extensionId: 'ext-a', enabled: false },
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'extensions',
          operation: 'setPermissionGranted',
          input: { extensionId: 'ext-a', permission: 'storage:read', granted: false },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(extensions.listActions).toHaveBeenCalled();
    expect(extensions.getStatus).toHaveBeenCalledWith('ext-a');
    expect(extensions.setEnabled).toHaveBeenCalledWith('ext-a', false);
    expect(extensions.setPermissionGranted).toHaveBeenCalledWith('ext-a', 'storage:read', false);
  });

  it('denies extension registry reads without extensions:read permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const extensions = { listActions: vi.fn(), getStatus: vi.fn(), setEnabled: vi.fn(), setPermissionGranted: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ extensions });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'extensions',
        operation: 'listActions',
      }),
    ).rejects.toThrow('requires permission extensions:read');
    expect(extensions.listActions).not.toHaveBeenCalled();
  });

  it('denies extension registry writes without extensions:write permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['extensions:read'] } });
    const extensions = { listActions: vi.fn(), getStatus: vi.fn(), setEnabled: vi.fn(), setPermissionGranted: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ extensions });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'extensions',
        operation: 'setEnabled',
        input: { extensionId: 'ext-a', enabled: false },
      }),
    ).rejects.toThrow('requires permission extensions:write');
    expect(extensions.setEnabled).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'extensions',
        operation: 'setPermissionGranted',
        input: { extensionId: 'ext-a', permission: 'storage:read', granted: false },
      }),
    ).rejects.toThrow('requires permission extensions:write');
    expect(extensions.setPermissionGranted).not.toHaveBeenCalled();
  });

  it('rejects malformed extension registry capability inputs', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['extensions:write'] } });
    const extensions = { listActions: vi.fn(), getStatus: vi.fn(), setEnabled: vi.fn(), setPermissionGranted: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ extensions });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'extensions',
        operation: 'setEnabled',
        input: { extensionId: 'ext-a', enabled: 'false' },
      }),
    ).rejects.toThrow('Extension enabled must be a boolean.');

    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'extensions',
        operation: 'setPermissionGranted',
        input: { extensionId: 'ext-a', permission: 'storage:read', granted: 'false' },
      }),
    ).rejects.toThrow('Extension permission granted must be a boolean.');
  });

  it('dispatches browser capability calls with declared browser permissions', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['browser:read', 'browser:control'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'browser',
          operation: 'listTabs',
        }),
      ),
    ).resolves.toEqual([{ id: 'tab-1', title: 'Docs' }]);
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'browser',
          operation: 'snapshot',
          input: { conversationId: 'conv-1', tabId: 'tab-1' },
        }),
      ),
    ).resolves.toEqual({ title: 'Docs' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'browser',
          operation: 'cdp',
          input: { conversationId: 'conv-1', tabId: 'tab-1', command: { method: 'Runtime.evaluate' } },
        }),
      ),
    ).resolves.toEqual({ ok: true });

    expect(workbenchBrowserToolHost.listTabs).toHaveBeenCalled();
    expect(workbenchBrowserToolHost.snapshot).toHaveBeenCalledWith('conv-1', 'tab-1');
    expect(workbenchBrowserToolHost.cdp).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      tabId: 'tab-1',
      command: { method: 'Runtime.evaluate' },
    });
  });

  it('denies browser reads without browser:read permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    workbenchBrowserToolHost.listTabs.mockClear();
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'browser',
        operation: 'listTabs',
      }),
    ).rejects.toThrow('requires permission browser:read');
    expect(workbenchBrowserToolHost.listTabs).not.toHaveBeenCalled();
  });

  it('denies browser CDP without browser:control permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['browser:read'] } });
    workbenchBrowserToolHost.cdp.mockClear();
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'browser',
        operation: 'cdp',
        input: { conversationId: 'conv-1', command: { method: 'Runtime.evaluate' } },
      }),
    ).rejects.toThrow('requires permission browser:control');
    expect(workbenchBrowserToolHost.cdp).not.toHaveBeenCalled();
  });

  it('denies desktop control capability calls without desktop:control permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'desktop',
        operation: 'control',
        input: { action: 'focus', windowId: 'chat:draft' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission desktop:control to use desktop.control.');
  });

  it('denies desktop screenshot capability calls without desktop:control permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'desktop',
        operation: 'screenshot',
        input: { windowId: 'chat:draft' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission desktop:control to use desktop.screenshot.');
  });

  it('denies desktop state capability calls without desktop:control permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'desktop',
        operation: 'state',
      }),
    ).rejects.toThrow('Extension "ext" requires permission desktop:control to use desktop.state.');
  });

  it('denies desktop event capability calls without desktop:control permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'desktop',
        operation: 'events',
        input: { lastEventId: 'desktop-user-action-test-1' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission desktop:control to use desktop.events.');
  });

  it('dispatches extension-scoped git capability calls', async () => {
    const git = {
      status: vi.fn(() => ({ porcelain: '## main' })),
      diff: vi.fn(() => ({ diff: 'diff --git a/file b/file' })),
      log: vi.fn(() => ({ log: 'abc123 commit' })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ git });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'git',
          operation: 'status',
          input: { cwd: '/repo' },
        }),
      ),
    ).resolves.toEqual({ porcelain: '## main' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'git',
          operation: 'diff',
          input: { cwd: '/repo', path: 'file.ts', staged: true },
        }),
      ),
    ).resolves.toEqual({ diff: 'diff --git a/file b/file' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'git',
          operation: 'log',
          input: { cwd: '/repo', maxCount: 5 },
        }),
      ),
    ).resolves.toEqual({ log: 'abc123 commit' });

    expect(git.status).toHaveBeenCalledWith({ cwd: '/repo' });
    expect(git.diff).toHaveBeenCalledWith({ cwd: '/repo', path: 'file.ts', staged: true });
    expect(git.log).toHaveBeenCalledWith({ cwd: '/repo', maxCount: 5 });
  });

  it('rejects malformed git capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({
      git: { status: vi.fn(), diff: vi.fn(), log: vi.fn() },
    });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'git',
        operation: 'diff',
        input: { cwd: '/repo', staged: 'yes' },
      }),
    ).rejects.toThrow('Git staged must be a boolean when provided.');
  });

  it('requires declared permissions for sensitive backend capabilities', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const commands = { list: vi.fn(), execute: vi.fn() };
    const conversations = { get: vi.fn() };
    const git = { status: vi.fn(), diff: vi.fn(), log: vi.fn() };
    const notify = { toast: vi.fn(), system: vi.fn(), setBadge: vi.fn(), clearBadge: vi.fn(), isSystemAvailable: vi.fn() };
    const secrets = { get: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ commands, conversations, git, notify, secrets });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'conversations',
        operation: 'get',
        input: { conversationId: 'conv-1' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission conversations:read to use conversations.get.');
    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'secrets',
        operation: 'get',
        input: { secretId: 'apiKey' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission secrets:read to use secrets.get.');
    await expect(async () =>
      dispatch({
        id: 3,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'commands',
        operation: 'execute',
        input: { commandId: 'app.open' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission commands:execute to use commands.execute.');
    await expect(async () =>
      dispatch({ id: 4, kind: 'capabilityRequest', extensionId: 'ext', capability: 'git', operation: 'status', input: { cwd: '/repo' } }),
    ).rejects.toThrow('Extension "ext" requires permission git:read to use git.status.');
    await expect(async () =>
      dispatch({
        id: 5,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'notify',
        operation: 'toast',
        input: { message: 'Saved' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission ui:notify to use notify.toast.');

    expect(commands.execute).not.toHaveBeenCalled();
    expect(conversations.get).not.toHaveBeenCalled();
    expect(git.status).not.toHaveBeenCalled();
    expect(notify.toast).not.toHaveBeenCalled();
    expect(secrets.get).not.toHaveBeenCalled();
  });

  it('requires automation permissions before dispatching worker automation helpers', async () => {
    const automations = { call: vi.fn(async () => ({ ok: true })) };
    const dispatch = createExtensionBackendCapabilityDispatcher({ automations });

    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'automations',
        operation: 'loadScheduledTasksForProfile',
        input: { args: ['runtime'] },
      }),
    ).rejects.toThrow('Extension "ext" requires permission automations:read to use automations.loadScheduledTasksForProfile.');
    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'automations',
        operation: 'createStoredAutomation',
        input: { args: [{ title: 'Task' }] },
      }),
    ).rejects.toThrow('Extension "ext" requires permission automations:write to use automations.createStoredAutomation.');
    await expect(async () =>
      dispatch({
        id: 3,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'automations',
        operation: 'startScheduledTaskRun',
        input: { args: ['task-1'] },
      }),
    ).rejects.toThrow('Extension "ext" requires permission automations:run to use automations.startScheduledTaskRun.');
    expect(automations.call).not.toHaveBeenCalled();

    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['automations:readwrite', 'automations:run'] } });
    await expect(
      dispatch({
        id: 4,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'automations',
        operation: 'deleteStoredAutomation',
        input: { args: ['task-1'] },
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      dispatch({
        id: 5,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'automations',
        operation: 'startScheduledTaskRun',
        input: { args: ['task-1'] },
      }),
    ).resolves.toEqual({ ok: true });
    expect(automations.call).toHaveBeenCalledWith('deleteStoredAutomation', { args: ['task-1'] });
    expect(automations.call).toHaveBeenCalledWith('startScheduledTaskRun', { args: ['task-1'] });
  });

  it('requires conversation write permission for metadata writes', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['conversations:read'] } });
    const conversations = { metadata: { set: vi.fn() } };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'conversations',
        operation: 'metadata.set',
        input: { conversationId: 'conv-1', values: { items: [] } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission conversations:write to use conversations.metadata.set.');

    expect(conversations.metadata.set).not.toHaveBeenCalled();
  });

  it('dispatches extension-scoped workspace capability calls', async () => {
    const workspace = {
      readText: vi.fn(async () => ({ path: 'README.md', content: 'hello', sha256: 'abc' })),
      writeText: vi.fn(async () => ({ path: 'README.md', bytes: 5 })),
      list: vi.fn(async () => [{ path: 'src', type: 'directory' }]),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ workspace });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'workspace',
          operation: 'readText',
          input: { cwd: '/repo', path: 'README.md', maxBytes: 100 },
        }),
      ),
    ).resolves.toEqual({ path: 'README.md', content: 'hello', sha256: 'abc' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'workspace',
          operation: 'writeText',
          input: { cwd: '/repo', path: 'README.md', content: 'hello' },
        }),
      ),
    ).resolves.toEqual({ path: 'README.md', bytes: 5 });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'workspace',
          operation: 'list',
          input: { cwd: '/repo', path: '.', depth: 2 },
        }),
      ),
    ).resolves.toEqual([{ path: 'src', type: 'directory' }]);

    expect(workspace.readText).toHaveBeenCalledWith('ext', { cwd: '/repo', path: 'README.md', maxBytes: 100 });
    expect(workspace.writeText).toHaveBeenCalledWith('ext', { cwd: '/repo', path: 'README.md', content: 'hello' });
    expect(workspace.list).toHaveBeenCalledWith('ext', { cwd: '/repo', path: '.', depth: 2 });
  });

  it('requires workspace write or readwrite permission for workspace writes', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['workspace:read'] } });
    const workspace = {
      readText: vi.fn(),
      writeText: vi.fn(),
      list: vi.fn(),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ workspace });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'workspace',
        operation: 'writeText',
        input: { cwd: '/repo', path: 'README.md', content: 'hello' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission workspace:write to use workspace.writeText.');
    expect(workspace.writeText).not.toHaveBeenCalled();
  });

  it('dispatches host-owned filesystem root handles', async () => {
    const root = {
      root: { kind: 'extension-storage', id: 'ext:app', path: '/state/ext/files', displayName: 'ext app files' },
      subject: { type: 'extension', extensionId: 'ext' },
      readBytes: vi.fn(async () => Uint8Array.from([1, 2, 3])),
      readText: vi.fn(async () => 'hello'),
      writeBytes: vi.fn(async () => undefined),
      writeText: vi.fn(async () => undefined),
      readJson: vi.fn(async () => ({ ok: true })),
      writeJson: vi.fn(async () => undefined),
      list: vi.fn(async () => [{ name: 'file.txt', path: 'file.txt', type: 'file', size: 5 }]),
      stat: vi.fn(async () => ({ type: 'file', size: 5, modifiedAt: '2026-06-01T00:00:00.000Z' })),
      exists: vi.fn(async () => true),
      createDirectory: vi.fn(async () => undefined),
      move: vi.fn(async () => undefined),
      copyIn: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      createTempWorkspace: vi.fn(async () => ({
        ...root,
        root: { kind: 'temp', id: 'tmp', path: '/tmp/fs' },
      })),
    };
    const filesystem = {
      requestRoot: vi.fn(async () => root),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ filesystem });

    const requested = (await dispatch({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'filesystem',
      operation: 'requestRoot',
      input: { kind: 'app', access: ['read', 'write'], reason: 'test app files' },
    })) as { handleId: string; root: unknown };

    expect(requested.handleId).toMatch(/^fs-/);
    expect(requested.root).toEqual({ kind: 'extension-storage', id: 'ext:app', path: '/state/ext/files', displayName: 'ext app files' });
    expect(filesystem.requestRoot).toHaveBeenCalledWith('ext', { kind: 'app', access: ['read', 'write'], reason: 'test app files' });

    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'filesystem',
          operation: 'writeText',
          input: { handleId: requested.handleId, path: 'file.txt', data: 'hello', atomic: false },
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'filesystem',
          operation: 'list',
          input: { handleId: requested.handleId, path: '.', depth: 1, excludeNames: ['node_modules'] },
        }),
      ),
    ).resolves.toEqual([{ name: 'file.txt', path: 'file.txt', type: 'file', size: 5 }]);
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'filesystem',
          operation: 'createTempWorkspace',
          input: { handleId: requested.handleId, prefix: 'worker-' },
        }),
      ),
    ).resolves.toEqual({
      handleId: expect.stringMatching(/^fs-/),
      root: { kind: 'temp', id: 'tmp', path: '/tmp/fs' },
    });

    expect(root.writeText).toHaveBeenCalledWith('file.txt', 'hello', { atomic: false });
    expect(root.list).toHaveBeenCalledWith('.', { depth: 1, excludeNames: ['node_modules'] });
    expect(root.createTempWorkspace).toHaveBeenCalledWith({ prefix: 'worker-' });
  });

  it('requires filesystem write or readwrite permission for writable filesystem roots', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['filesystem:read'] } });
    const filesystem = {
      requestRoot: vi.fn(),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ filesystem });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'filesystem',
        operation: 'requestRoot',
        input: { kind: 'app', access: ['read', 'write'], reason: 'test app files' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission filesystem:write to use filesystem.requestRoot.');
    expect(filesystem.requestRoot).not.toHaveBeenCalled();
  });

  it('rejects malformed workspace capability inputs', async () => {
    const workspace = { readText: vi.fn(), writeText: vi.fn(), list: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ workspace });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'workspace',
        operation: 'readText',
        input: { cwd: '/repo', path: 1 },
      }),
    ).rejects.toThrow('Workspace path must be a string.');
  });

  it('dispatches extension-scoped log capability calls', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ log });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'log',
          operation: 'warn',
          input: { message: 'careful', fields: { detail: 'test' } },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith('extension:ext careful', { detail: 'test' });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('dispatches model capability calls', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: {
        permissions: ['models:readwrite'],
      },
    });
    const models = {
      list: vi.fn(async () => [{ id: 'model-1', provider: 'provider-a' }]),
      saveProvider: vi.fn(async () => ({ provider: 'ds4' })),
      saveProviderModel: vi.fn(async () => ({ modelId: 'deepseek-v4-flash' })),
      deleteProvider: vi.fn(async () => ({ ok: true })),
      deleteProviderModel: vi.fn(async () => ({ ok: true })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ models });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'models',
          operation: 'list',
        }),
      ),
    ).resolves.toEqual([{ id: 'model-1', provider: 'provider-a' }]);
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'models',
          operation: 'saveProvider',
          input: {
            input: { provider: 'ds4', baseUrl: 'http://127.0.0.1:8000/v1' },
            runtimeScope: 'shared',
            repoRoot: '/repo',
            authFile: '/agent/auth.json',
            stateRoot: '/state',
          },
        }),
      ),
    ).resolves.toEqual({ provider: 'ds4' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'models',
          operation: 'saveProviderModel',
          input: { input: { provider: 'ds4', modelId: 'deepseek-v4-flash' }, runtimeScope: 'shared', authFile: '/agent/auth.json' },
        }),
      ),
    ).resolves.toEqual({ modelId: 'deepseek-v4-flash' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'models',
          operation: 'deleteProvider',
          input: { provider: 'ds4', runtimeScope: 'shared', authFile: '/agent/auth.json' },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 5,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'models',
          operation: 'deleteProviderModel',
          input: { input: { provider: 'ds4', modelId: 'deepseek-v4-flash' }, runtimeScope: 'shared', authFile: '/agent/auth.json' },
        }),
      ),
    ).resolves.toEqual({ ok: true });

    expect(models.list).toHaveBeenCalled();
    expect(models.saveProvider).toHaveBeenCalledWith(
      { provider: 'ds4', baseUrl: 'http://127.0.0.1:8000/v1' },
      { runtimeScope: 'shared', repoRoot: '/repo', authFile: '/agent/auth.json', stateRoot: '/state' },
    );
    expect(models.saveProviderModel).toHaveBeenCalledWith(
      { provider: 'ds4', modelId: 'deepseek-v4-flash' },
      { runtimeScope: 'shared', authFile: '/agent/auth.json' },
    );
    expect(models.deleteProvider).toHaveBeenCalledWith('ds4', { runtimeScope: 'shared', authFile: '/agent/auth.json' });
    expect(models.deleteProviderModel).toHaveBeenCalledWith(
      { provider: 'ds4', modelId: 'deepseek-v4-flash' },
      { runtimeScope: 'shared', authFile: '/agent/auth.json' },
    );
  });

  it('requires model permissions before dispatching model capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const models = {
      list: vi.fn(async () => [{ id: 'model-1' }]),
      saveProvider: vi.fn(async () => ({ provider: 'ds4' })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ models });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'models',
        operation: 'list',
      }),
    ).rejects.toThrow('requires permission models:read');
    expect(models.list).not.toHaveBeenCalled();

    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['models:read'] } });
    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'models',
        operation: 'saveProvider',
        input: { input: { provider: 'ds4' } },
      }),
    ).rejects.toThrow('requires permission models:write');
    expect(models.saveProvider).not.toHaveBeenCalled();
  });

  it('rejects unsupported model capability operations', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['models:readwrite'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher({ models: { list: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'models',
        operation: 'unknown',
        input: {},
      }),
    ).rejects.toThrow('Unsupported models capability operation: unknown');
  });

  it('dispatches extension-scoped notify capability calls', async () => {
    const notify = {
      toast: vi.fn(),
      system: vi.fn(() => true),
      setBadge: vi.fn(() => ({ badge: 3, aggregated: 5 })),
      clearBadge: vi.fn(),
      isSystemAvailable: vi.fn(() => true),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ notify });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'toast',
          input: { message: 'Saved', type: 'warning' },
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'system',
          input: { title: 'Title', message: 'Body', subtitle: 'Sub', persistent: true, actionPayload: { route: '/x' } },
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'setBadge',
          input: { count: 3 },
        }),
      ),
    ).resolves.toEqual({ badge: 3, aggregated: 5 });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'clearBadge',
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      Promise.resolve(
        dispatch({
          id: 5,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'isSystemAvailable',
        }),
      ),
    ).resolves.toBe(true);

    expect(notify.toast).toHaveBeenCalledWith('ext', 'Saved', 'warning');
    expect(notify.system).toHaveBeenCalledWith('ext', {
      message: 'Body',
      title: 'Title',
      subtitle: 'Sub',
      persistent: true,
      actionPayload: { route: '/x' },
    });
    expect(notify.setBadge).toHaveBeenCalledWith('ext', 3);
    expect(notify.clearBadge).toHaveBeenCalledWith('ext');
    expect(notify.isSystemAvailable).toHaveBeenCalled();
  });

  it('rejects malformed notify capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({
      notify: { toast: vi.fn(), system: vi.fn(), setBadge: vi.fn(), clearBadge: vi.fn(), isSystemAvailable: vi.fn() },
    });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'notify',
        operation: 'toast',
        input: { message: 'Saved', type: 'success' },
      }),
    ).rejects.toThrow('Notify type must be info, warning, or error when provided.');
  });

  it('dispatches extension settings through the active state root', async () => {
    const settings = {
      read: vi.fn(() => ({ 'caffeinate.autoStart': true })),
      readSchema: vi.fn(() => [{ key: 'caffeinate.autoStart', type: 'boolean' }]),
      update: vi.fn(() => ({ 'caffeinate.autoStart': false })),
      reset: vi.fn(() => ({ 'caffeinate.autoStart': true })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ settings });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-caffeinate',
          capability: 'settings',
          operation: 'read',
          context: { stateRoot: '/state-root' },
        }),
      ),
    ).resolves.toEqual({ 'caffeinate.autoStart': true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'system-caffeinate',
          capability: 'settings',
          operation: 'readSchema',
          context: { stateRoot: '/state-root' },
        }),
      ),
    ).resolves.toEqual([{ key: 'caffeinate.autoStart', type: 'boolean' }]);
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'system-caffeinate',
          capability: 'settings',
          operation: 'update',
          input: { overrides: { 'caffeinate.autoStart': false } },
          context: { stateRoot: '/state-root' },
        }),
      ),
    ).resolves.toEqual({ 'caffeinate.autoStart': false });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'system-caffeinate',
          capability: 'settings',
          operation: 'reset',
          input: { keys: ['caffeinate.autoStart'] },
          context: { stateRoot: '/state-root' },
        }),
      ),
    ).resolves.toEqual({ 'caffeinate.autoStart': true });

    expect(settings.read).toHaveBeenCalledWith('/state-root');
    expect(settings.readSchema).toHaveBeenCalledWith('/state-root');
    expect(settings.update).toHaveBeenCalledWith({ 'caffeinate.autoStart': false }, '/state-root');
    expect(settings.reset).toHaveBeenCalledWith(['caffeinate.autoStart'], '/state-root');
  });

  it('rejects unsupported capabilities and malformed log inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });

    await expect(async () =>
      dispatch({ id: 1, kind: 'capabilityRequest', extensionId: 'ext', capability: 'database', operation: 'query' }),
    ).rejects.toThrow('Unsupported extension backend capability: database');

    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'log',
        operation: 'info',
        input: {},
      }),
    ).rejects.toThrow('Log capability input must include a string message.');
  });

  it('dispatches extension-scoped storage capability calls', async () => {
    const storage = {
      get: vi.fn(() => ({ saved: true })),
      put: vi.fn(() => ({ ok: true })),
      delete: vi.fn(() => ({ ok: true, deleted: true })),
      list: vi.fn(() => [{ key: 'tasks/one', value: 1 }]),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ storage });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'get',
          input: { key: 'tasks/one' },
        }),
      ),
    ).resolves.toEqual({ saved: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'put',
          input: { key: 'tasks/one', value: { done: true }, expectedVersion: 3 },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'delete',
          input: { key: 'tasks/one' },
        }),
      ),
    ).resolves.toEqual({ ok: true, deleted: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'list',
          input: { prefix: 'tasks/' },
        }),
      ),
    ).resolves.toEqual([{ key: 'tasks/one', value: 1 }]);

    expect(storage.get).toHaveBeenCalledWith('ext', 'tasks/one');
    expect(storage.put).toHaveBeenCalledWith('ext', 'tasks/one', { done: true }, { expectedVersion: 3 });
    expect(storage.delete).toHaveBeenCalledWith('ext', 'tasks/one');
    expect(storage.list).toHaveBeenCalledWith('ext', 'tasks/');
  });

  it('routes documents capability through host-owned system-data-tools without exposing host authority to ordinary extensions', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'extension-documents-capability-test-'));
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['documents:readwrite'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher({ documents: { stateRoot: tmpDir } });

    try {
      await expect(
        Promise.resolve(
          dispatch({
            id: 1,
            kind: 'capabilityRequest',
            extensionId: 'ordinary-extension',
            capability: 'documents',
            operation: 'putDocument',
            input: { owner: 'other-owner', collection: 'items', id: 'doc-1', body: { hidden: true } },
          }),
        ),
      ).rejects.toThrow('Collection "other-owner/items" not found');

      await expect(
        Promise.resolve(
          dispatch({
            id: 2,
            kind: 'capabilityRequest',
            extensionId: 'system-data-tools',
            capability: 'documents',
            operation: 'putDocument',
            input: { owner: 'other-owner', collection: 'items', id: 'doc-1', body: { hidden: true } },
          }),
        ),
      ).resolves.toMatchObject({ owner: 'other-owner', collection: 'items', id: 'doc-1', body: { hidden: true } });

      await expect(
        Promise.resolve(
          dispatch({
            id: 3,
            kind: 'capabilityRequest',
            extensionId: 'system-data-tools',
            capability: 'documents',
            operation: 'listCollections',
            input: {},
          }),
        ),
      ).resolves.toEqual([expect.objectContaining({ owner: 'other-owner', collection: 'items' })]);

      // system-data-tools can read the cross-owner document (trusted host broker)
      await expect(
        Promise.resolve(
          dispatch({
            id: 4,
            kind: 'capabilityRequest',
            extensionId: 'system-data-tools',
            capability: 'documents',
            operation: 'getDocument',
            input: { owner: 'other-owner', collection: 'items', id: 'doc-1' },
          }),
        ),
      ).resolves.toMatchObject({ owner: 'other-owner', collection: 'items', id: 'doc-1' });

      // ordinary extension with documents:readwrite still cannot read the
      // cross-owner private collection (no grant, not the owner)
      await expect(
        Promise.resolve(
          dispatch({
            id: 5,
            kind: 'capabilityRequest',
            extensionId: 'ordinary-extension',
            capability: 'documents',
            operation: 'listDocuments',
            input: { owner: 'other-owner', collection: 'items' },
          }),
        ),
      ).rejects.toThrow('Document collection access denied');

      // ordinary extension still cannot write to the cross-owner private collection
      await expect(
        Promise.resolve(
          dispatch({
            id: 6,
            kind: 'capabilityRequest',
            extensionId: 'ordinary-extension',
            capability: 'documents',
            operation: 'putDocument',
            input: { owner: 'other-owner', collection: 'items', id: 'doc-2', body: { malicious: true } },
          }),
        ),
      ).rejects.toThrow('Document collection access denied');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('uses request context desktop root layout for documents capability calls', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'extension-documents-context-state-'));
    const desktopRootLayout = resolveDesktopRootLayout({ root: join(stateRoot, 'desktop-root') });
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['documents:readwrite'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    try {
      await expect(
        Promise.resolve(
          dispatch({
            id: 1,
            kind: 'capabilityRequest',
            extensionId: 'system-data-tools',
            capability: 'documents',
            operation: 'putDocument',
            input: { owner: 'other-owner', collection: 'items', id: 'doc-1', body: { visible: true } },
            context: { stateRoot, desktopRootLayout },
          }),
        ),
      ).resolves.toMatchObject({ owner: 'other-owner', collection: 'items', id: 'doc-1', body: { visible: true } });

      expect(existsSync(resolveDocumentsDbPathFromLayout(desktopRootLayout))).toBe(true);
      expect(existsSync(join(stateRoot, 'documents', 'documents.db'))).toBe(false);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });

  it('requires documents permission before dispatching documents capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    expect(() =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'documents',
        operation: 'listCollections',
        input: {},
      }),
    ).toThrow('Extension "ext" requires permission documents:read to use documents.listCollections.');
  });

  it('dispatches documents collection grant management capability calls', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'extension-documents-grant-test-'));
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['documents:readwrite'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher({ documents: { stateRoot: tmpDir } });

    try {
      // Owner can list grants (read operation, manage-gated)
      await expect(
        Promise.resolve(
          dispatch({
            id: 1,
            kind: 'capabilityRequest',
            extensionId: 'app-owner',
            capability: 'documents',
            operation: 'listGrants',
            input: { owner: 'app-owner', collection: 'col' },
          }),
        ),
      ).resolves.toEqual([]);

      // Non-owner cannot list grants
      await expect(
        Promise.resolve(
          dispatch({
            id: 2,
            kind: 'capabilityRequest',
            extensionId: 'other-app',
            capability: 'documents',
            operation: 'listGrants',
            input: { owner: 'app-owner', collection: 'col' },
          }),
        ),
      ).rejects.toThrow('Document collection access denied');

      // Owner can get own grant by name (grantee matches caller)
      await expect(
        Promise.resolve(
          dispatch({
            id: 3,
            kind: 'capabilityRequest',
            extensionId: 'app-owner',
            capability: 'documents',
            operation: 'getGrant',
            input: { owner: 'app-owner', collection: 'col', granteeAppId: 'app-owner' },
          }),
        ),
      ).resolves.toBeNull();

      // Non-owner can inspect its own grant (grantee matches caller)
      await expect(
        Promise.resolve(
          dispatch({
            id: 4,
            kind: 'capabilityRequest',
            extensionId: 'other-app',
            capability: 'documents',
            operation: 'getGrant',
            input: { owner: 'app-owner', collection: 'col', granteeAppId: 'other-app' },
          }),
        ),
      ).resolves.toBeNull();

      // Non-owner cannot get another app's grant
      await expect(
        Promise.resolve(
          dispatch({
            id: 5,
            kind: 'capabilityRequest',
            extensionId: 'other-app',
            capability: 'documents',
            operation: 'getGrant',
            input: { owner: 'app-owner', collection: 'col', granteeAppId: 'some-other-app' },
          }),
        ),
      ).rejects.toThrow('Document collection access denied');

      // Owner can set a grant
      await expect(
        Promise.resolve(
          dispatch({
            id: 6,
            kind: 'capabilityRequest',
            extensionId: 'app-owner',
            capability: 'documents',
            operation: 'setGrant',
            input: { owner: 'app-owner', collection: 'col', granteeAppId: 'other-app', canRead: true, canWrite: false },
          }),
        ),
      ).resolves.toMatchObject({ granteeAppId: 'other-app', canRead: true, canWrite: false });

      // Non-owner cannot set a grant
      await expect(
        Promise.resolve(
          dispatch({
            id: 7,
            kind: 'capabilityRequest',
            extensionId: 'other-app',
            capability: 'documents',
            operation: 'setGrant',
            input: { owner: 'app-owner', collection: 'col', granteeAppId: 'nobody', canRead: true, canWrite: false },
          }),
        ),
      ).rejects.toThrow('Document collection access denied');

      // Owner can delete a grant
      await expect(
        Promise.resolve(
          dispatch({
            id: 8,
            kind: 'capabilityRequest',
            extensionId: 'app-owner',
            capability: 'documents',
            operation: 'deleteGrant',
            input: { owner: 'app-owner', collection: 'col', granteeAppId: 'other-app' },
          }),
        ),
      ).resolves.toEqual({ deleted: true });

      // Non-owner cannot delete a grant
      await expect(
        Promise.resolve(
          dispatch({
            id: 9,
            kind: 'capabilityRequest',
            extensionId: 'other-app',
            capability: 'documents',
            operation: 'deleteGrant',
            input: { owner: 'app-owner', collection: 'col', granteeAppId: 'other-app' },
          }),
        ),
      ).rejects.toThrow('Document collection access denied');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dispatches extension-scoped secrets capability calls', async () => {
    const secrets = {
      get: vi.fn(() => 'stored-secret'),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ secrets });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'secrets',
          operation: 'get',
          input: { secretId: 'apiKey' },
        }),
      ),
    ).resolves.toBe('stored-secret');

    expect(secrets.get).toHaveBeenCalledWith('ext', 'apiKey');
  });

  it('rejects malformed secrets capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ secrets: { get: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'secrets',
        operation: 'get',
        input: { secretId: 1 },
      }),
    ).rejects.toThrow('Secret id must be a string.');
  });

  it('dispatches extension-scoped telemetry capability calls', async () => {
    const telemetry = {
      record: vi.fn(),
      readTrace: vi.fn(async () => [{ id: 'trace-1' }]),
      queryApp: vi.fn(async () => [{ id: 'app-1' }]),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ telemetry });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'telemetry',
          operation: 'record',
          input: {
            category: 'extension',
            name: 'done',
            source: 'agent',
            sessionId: 'session-1',
            status: 200,
            durationMs: 12,
            metadata: { ok: true },
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(telemetry.record).toHaveBeenCalledWith('ext', {
      category: 'extension',
      name: 'done',
      source: 'agent',
      sessionId: 'session-1',
      status: 200,
      durationMs: 12,
      metadata: { ok: true },
    });

    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['telemetry:read'] } });

    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'telemetry',
          operation: 'readTrace',
          input: { since: '2026-05-22T00:00:00.000Z', limit: 1_000_000 },
        }),
      ),
    ).resolves.toEqual([{ id: 'trace-1' }]);
    expect(telemetry.readTrace).toHaveBeenCalledWith({ since: '2026-05-22T00:00:00.000Z', limit: 100_000 });

    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'telemetry',
          operation: 'queryApp',
          input: { since: '2026-05-22T00:00:00.000Z', limit: Number.NaN },
        }),
      ),
    ).resolves.toEqual([{ id: 'app-1' }]);
    expect(telemetry.queryApp).toHaveBeenCalledWith({ since: '2026-05-22T00:00:00.000Z', limit: 200 });
  });

  it('requires telemetry write permission before dispatching telemetry capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const telemetry = {
      record: vi.fn(),
      readTrace: vi.fn(),
      queryApp: vi.fn(),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ telemetry });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'telemetry',
        operation: 'record',
        input: { category: 'extension', name: 'done' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission telemetry:write to use telemetry.record.');
    expect(telemetry.record).not.toHaveBeenCalled();
  });

  it('requires telemetry read permission before dispatching telemetry read capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['telemetry:write'] } });
    const telemetry = {
      record: vi.fn(),
      readTrace: vi.fn(),
      queryApp: vi.fn(),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ telemetry });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'telemetry',
        operation: 'readTrace',
        input: { since: '2026-05-22T00:00:00.000Z' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission telemetry:read to use telemetry.readTrace.');
    expect(telemetry.readTrace).not.toHaveBeenCalled();
  });

  it('rejects malformed telemetry capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ telemetry: { record: vi.fn(), readTrace: vi.fn(), queryApp: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'telemetry',
        operation: 'record',
        input: { category: 'extension', name: 'done', source: 'ui' },
      }),
    ).rejects.toThrow('Telemetry source must be server, renderer, agent, or system when provided.');
  });

  it('dispatches shell exec capability calls', async () => {
    const shell = {
      exec: vi.fn(async () => ({ stdout: 'done', stderr: '' })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'shell',
          operation: 'exec',
          input: {
            command: 'git',
            args: ['status', '--short'],
            cwd: '/repo',
            timeoutMs: 1000,
            maxBuffer: 2048,
            env: { A: 'B' },
          },
        }),
      ),
    ).resolves.toEqual({ stdout: 'done', stderr: '' });

    expect(shell.exec).toHaveBeenCalledWith({
      command: 'git',
      args: ['status', '--short'],
      cwd: '/repo',
      timeoutMs: 1000,
      maxBuffer: 2048,
      env: { A: 'B' },
    });
  });

  it('requires shell execute permission for shell capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const shell = {
      exec: vi.fn(),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'exec',
        input: { command: 'git' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission shell:execute to use shell.exec.');
    expect(shell.exec).not.toHaveBeenCalled();
  });

  it('requires shell execute permission for terminal capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    terminalSessions.createTerminalSession.mockClear();
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'terminal',
        operation: 'create',
        input: { cwd: '/repo' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission shell:execute to use terminal.create.');
    expect(terminalSessions.createTerminalSession).not.toHaveBeenCalled();
  });

  it('dispatches terminal capability calls with shell execute permission', async () => {
    terminalSessions.createTerminalSession.mockClear();
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'terminal',
          operation: 'create',
          input: { cwd: '/repo' },
        }),
      ),
    ).resolves.toEqual({ id: 'term-1', pid: 123, usingPty: true, initialOutput: '' });

    expect(terminalSessions.createTerminalSession).toHaveBeenCalledWith({ cwd: '/repo' });
  });

  it('defaults terminal capability creation to the desktop root when cwd is omitted', async () => {
    terminalSessions.createTerminalSession.mockClear();
    const desktopRootLayout = resolveDesktopRootLayout({ root: '/desktop-root' });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'terminal',
          operation: 'create',
          input: {},
          context: { desktopRootLayout },
        }),
      ),
    ).resolves.toEqual({ id: 'term-1', pid: 123, usingPty: true, initialOutput: '' });

    expect(terminalSessions.createTerminalSession).toHaveBeenCalledWith({ cwd: '/desktop-root' });
  });

  it('preserves explicit terminal cwd over the desktop root default', async () => {
    terminalSessions.createTerminalSession.mockClear();
    const desktopRootLayout = resolveDesktopRootLayout({ root: '/desktop-root' });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'terminal',
          operation: 'create',
          input: { cwd: '/explicit' },
          context: { desktopRootLayout },
        }),
      ),
    ).resolves.toEqual({ id: 'term-1', pid: 123, usingPty: true, initialOutput: '' });

    expect(terminalSessions.createTerminalSession).toHaveBeenCalledWith({ cwd: '/explicit' });
  });

  it('dispatches host-owned shell spawn handle capability calls', async () => {
    const handle = {
      pid: 123,
      usingPty: false,
      executionWrappers: [{ id: 'sandbox', label: 'Sandbox' }],
      kill: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
    };
    const shell = {
      exec: vi.fn(),
      spawn: vi.fn(async () => handle),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell });
    const emitted: unknown[] = [];

    await expect(
      Promise.resolve(
        dispatch(
          {
            id: 1,
            kind: 'capabilityRequest',
            extensionId: 'ext',
            capability: 'shell',
            operation: 'spawn',
            input: {
              handleId: 'handle-1',
              command: 'caffeinate',
              args: ['-dimsu'],
              cwd: '/repo',
              env: { A: 'B' },
              pty: { cols: 120, rows: 32 },
              onStdout: true,
              onStderr: true,
              onExit: true,
            },
          },
          (event) => emitted.push(event),
        ),
      ),
    ).resolves.toEqual({ pid: 123, usingPty: false, executionWrappers: [{ id: 'sandbox', label: 'Sandbox' }] });

    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'shell',
          operation: 'write',
          input: { handleId: 'handle-1', data: 'hello' },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'shell',
          operation: 'resize',
          input: { handleId: 'handle-1', cols: 80, rows: 24 },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'shell',
          operation: 'kill',
          input: { handleId: 'handle-1' },
        }),
      ),
    ).resolves.toEqual({ ok: true });

    expect(shell.spawn).toHaveBeenCalledWith({
      command: 'caffeinate',
      args: ['-dimsu'],
      cwd: '/repo',
      env: { A: 'B' },
      pty: { cols: 120, rows: 32 },
      onStdout: expect.any(Function),
      onStderr: expect.any(Function),
      onExit: expect.any(Function),
    });
    const spawnInput = shell.spawn.mock.calls[0][0];
    spawnInput.onStdout?.('out');
    spawnInput.onStderr?.('err');
    spawnInput.onExit?.({ code: 0, signal: null });
    expect(emitted).toEqual([
      {
        kind: 'capabilityEvent',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'stdout',
        input: { handleId: 'handle-1', chunk: 'out' },
      },
      {
        kind: 'capabilityEvent',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'stderr',
        input: { handleId: 'handle-1', chunk: 'err' },
      },
      {
        kind: 'capabilityEvent',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'exit',
        input: { handleId: 'handle-1', code: 0, signal: null },
      },
    ]);
    expect(handle.write).toHaveBeenCalledWith('hello');
    expect(handle.resize).toHaveBeenCalledWith(80, 24);
    expect(handle.kill).toHaveBeenCalledOnce();
  });

  it('kills host-owned shell spawn handles for an aborted worker request', async () => {
    const matchingHandle = {
      pid: 123,
      usingPty: false,
      executionWrappers: [],
      kill: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(),
    };
    const otherRequestHandle = {
      pid: 456,
      usingPty: false,
      executionWrappers: [],
      kill: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(),
    };
    const otherExtensionHandle = {
      pid: 789,
      usingPty: false,
      executionWrappers: [],
      kill: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(),
    };
    const shell = {
      exec: vi.fn(),
      spawn: vi.fn(async () => matchingHandle),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell });

    await dispatch({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'shell',
      operation: 'spawn',
      input: { handleId: 'matching', command: 'sleep', args: ['120'] },
      context: { workerRequestId: 77 },
    });
    shell.spawn.mockResolvedValueOnce(otherRequestHandle);
    await dispatch({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'shell',
      operation: 'spawn',
      input: { handleId: 'other-request', command: 'sleep', args: ['120'] },
      context: { workerRequestId: 88 },
    });
    shell.spawn.mockResolvedValueOnce(otherExtensionHandle);
    await dispatch({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'other-ext',
      capability: 'shell',
      operation: 'spawn',
      input: { handleId: 'other-extension', command: 'sleep', args: ['120'] },
      context: { workerRequestId: 77 },
    });

    await expect(
      dispatch({
        id: 4,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'abortOwner',
        input: { workerRequestId: 77 },
      }),
    ).resolves.toEqual({ ok: true, killed: 1 });

    expect(matchingHandle.kill).toHaveBeenCalledOnce();
    expect(otherRequestHandle.kill).not.toHaveBeenCalled();
    expect(otherExtensionHandle.kill).not.toHaveBeenCalled();
    await expect(
      dispatch({
        id: 5,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'write',
        input: { handleId: 'other-request', data: 'still alive' },
      }),
    ).resolves.toEqual({ ok: true });
    expect(otherRequestHandle.write).toHaveBeenCalledWith('still alive');
  });

  it('kills host-owned shell spawn handles for an aborted conversation', async () => {
    const matchingHandle = {
      pid: 123,
      usingPty: false,
      executionWrappers: [],
      kill: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(),
    };
    const otherHandle = {
      pid: 456,
      usingPty: false,
      executionWrappers: [],
      kill: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(),
    };
    const shell = {
      exec: vi.fn(),
      spawn: vi.fn(async () => matchingHandle),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell });

    await dispatch({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'shell',
      operation: 'spawn',
      input: { handleId: 'matching', command: 'sleep', args: ['120'] },
      context: { agentToolContext: { conversationId: 'conv-1', sessionId: 'conv-1' } },
    });
    shell.spawn.mockResolvedValueOnce(otherHandle);
    await dispatch({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'shell',
      operation: 'spawn',
      input: { handleId: 'other', command: 'sleep', args: ['120'] },
      context: { agentToolContext: { conversationId: 'conv-2', sessionId: 'conv-2' } },
    });

    await expect(abortExtensionShellSpawnHandlesForConversation('conv-1')).resolves.toEqual({ ok: true, killed: 1 });
    expect(matchingHandle.kill).toHaveBeenCalledOnce();
    expect(otherHandle.kill).not.toHaveBeenCalled();
  });

  it('cleans up ownerless shell spawn handles when conversation ownership is missing', async () => {
    const ownerlessHandle = {
      pid: 123,
      usingPty: false,
      executionWrappers: [],
      kill: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(),
    };
    const shell = {
      exec: vi.fn(),
      spawn: vi.fn(async () => ownerlessHandle),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell });

    await dispatch({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'shell',
      operation: 'spawn',
      input: { handleId: 'ownerless', command: 'sleep', args: ['120'] },
    });

    const result = await abortExtensionShellSpawnHandlesForConversation('conv-with-missing-owner');
    expect(result.ok).toBe(true);
    expect(result.killed).toBeGreaterThanOrEqual(1);
    expect(ownerlessHandle.kill).toHaveBeenCalledOnce();
  });

  it('rejects malformed shell capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell: { exec: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'exec',
        input: { command: 'git', args: ['status', 1] },
      }),
    ).rejects.toThrow('Shell args must be an array of strings when provided.');
  });

  it('dispatches UI invalidation capability calls', async () => {
    const ui = { invalidate: vi.fn(), confirm: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'ui',
          operation: 'invalidate',
          input: { topics: ['sessions', 'checkpoints'] },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ui.invalidate).toHaveBeenCalledWith(['sessions', 'checkpoints']);
  });

  it('dispatches host-owned UI confirmation capability calls', async () => {
    const ui = { invalidate: vi.fn(), confirm: vi.fn(async () => ({ confirmed: true, status: 'confirmed' })) };
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'ui',
          operation: 'confirm',
          input: {
            title: 'Install community skill',
            message: 'Install Reviewer from Community Skills?',
            confirmLabel: 'Install',
            cancelLabel: 'Cancel',
            timeoutMs: 60_000,
            details: [{ label: 'Source', value: 'Community Skills' }],
          },
        }),
      ),
    ).resolves.toEqual({ confirmed: true, status: 'confirmed' });

    expect(ui.confirm).toHaveBeenCalledWith('ext', {
      title: 'Install community skill',
      message: 'Install Reviewer from Community Skills?',
      confirmLabel: 'Install',
      cancelLabel: 'Cancel',
      timeoutMs: 60_000,
      details: [{ label: 'Source', value: 'Community Skills' }],
    });
  });

  it('requires UI invalidate permission before dispatching UI invalidation capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const ui = { invalidate: vi.fn(), confirm: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'ui',
        operation: 'invalidate',
        input: { topics: ['sessions'] },
      }),
    ).rejects.toThrow('Extension "ext" requires permission ui:invalidate to use ui.invalidate.');

    expect(ui.invalidate).not.toHaveBeenCalled();
  });

  it('requires UI confirm permission before dispatching UI confirmation capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['ui:invalidate'] } });
    const ui = { invalidate: vi.fn(), confirm: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'ui',
        operation: 'confirm',
        input: { message: 'Install skill?' },
      }),
    ).rejects.toThrow('Extension "ext" requires permission ui:confirm to use ui.confirm.');

    expect(ui.confirm).not.toHaveBeenCalled();
  });

  it('dispatches host-owned image generation capability calls', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: {
        permissions: ['images:write'],
      },
    });
    const image = { generate: vi.fn(async () => ({ text: 'generated' })) };
    const dispatch = createExtensionBackendCapabilityDispatcher({ image });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-codex-profile',
          capability: 'image',
          operation: 'generate',
          input: {
            input: { prompt: 'draw smoke' },
            toolContext: { sessionFile: '/tmp/session.json', preferredVisionModel: 'openai/gpt-4o' },
          },
        }),
      ),
    ).resolves.toEqual({ text: 'generated' });

    expect(image.generate).toHaveBeenCalledWith('system-codex-profile', {
      input: { prompt: 'draw smoke' },
      toolContext: { sessionFile: '/tmp/session.json', preferredVisionModel: 'openai/gpt-4o' },
    });
  });

  it('passes active session context to video frame extraction capabilities', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['videos:read'] } });
    const video = {
      extractFrame: vi.fn(async () => ({ text: 'frame' })),
      sampleFrames: vi.fn(async () => ({ text: 'frames' })),
      transcribe: vi.fn(async () => ({ text: 'transcript' })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ video });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-image-probe',
          capability: 'video',
          operation: 'sampleFrames',
          input: { videoId: 'vid_aaaaaaaaaaaa', startSec: 0, endSec: 1, count: 1 },
          context: { toolContext: { sessionId: 'session-1' } },
        }),
      ),
    ).resolves.toEqual({ text: 'frames' });

    expect(video.sampleFrames).toHaveBeenCalledWith(
      { videoId: 'vid_aaaaaaaaaaaa', startSec: 0, endSec: 1, count: 1 },
      { sessionId: 'session-1' },
    );
  });

  it('requires image write permission before dispatching host-owned image generation', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const image = { generate: vi.fn(async () => ({ text: 'generated' })) };
    const dispatch = createExtensionBackendCapabilityDispatcher({ image });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'image',
        operation: 'generate',
        input: { input: { prompt: 'draw smoke' } },
      }),
    ).rejects.toThrow('requires permission images:write');
    expect(image.generate).not.toHaveBeenCalled();
  });

  it('rejects malformed UI invalidation inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui: { invalidate: vi.fn(), confirm: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'ui',
        operation: 'invalidate',
        input: { topics: ['sessions', 1] },
      }),
    ).rejects.toThrow('UI topics must be a string or array of strings.');
  });

  it('rejects malformed UI confirmation inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui: { invalidate: vi.fn(), confirm: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'ui',
        operation: 'confirm',
        input: { message: 'Install skill?', details: [{ label: 'Source', value: 7 }] },
      }),
    ).rejects.toThrow('UI confirmation detail labels and values must be strings.');
  });

  it('dispatches host-owned runtime refresh capability calls', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['mcp:write'] } });
    const runtime = { refreshSkillMcpConfig: vi.fn(async () => ({ mcpConfigPath: '/runtime/mcp_servers.json' })) };
    const dispatch = createExtensionBackendCapabilityDispatcher({ runtime });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-prompt-assembly',
          capability: 'runtime',
          operation: 'refreshSkillMcpConfig',
          input: { runtimeScope: 'shared', repoRoot: '/repo', runtimeDir: '/runtime' },
        }),
      ),
    ).resolves.toEqual({ mcpConfigPath: '/runtime/mcp_servers.json' });

    expect(runtime.refreshSkillMcpConfig).toHaveBeenCalledWith({
      runtimeScope: 'shared',
      repoRoot: '/repo',
      runtimeDir: '/runtime',
    });
  });

  it('denies host-owned runtime refresh capability calls without mcp:write permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const runtime = { refreshSkillMcpConfig: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ runtime });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'system-prompt-assembly',
        capability: 'runtime',
        operation: 'refreshSkillMcpConfig',
        input: { runtimeScope: 'shared', repoRoot: '/repo', runtimeDir: '/runtime' },
      }),
    ).rejects.toThrow('requires permission mcp:write');
    expect(runtime.refreshSkillMcpConfig).not.toHaveBeenCalled();
  });

  it('permits agent conversation operations with agent:conversations and agent task runs with agent:run', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['agent:conversations', 'agent:run'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'agent',
          operation: 'createConversation',
          input: { input: { title: 'Test', visibility: 'hidden', persistence: 'ephemeral' } },
        }),
      ),
    ).resolves.toEqual({ conversationId: 'agent-conv-1' });

    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'agent',
          operation: 'runTask',
          input: { input: { cwd: '/repo', prompt: 'Do something' } },
        }),
      ),
    ).resolves.toEqual({ ok: true, result: 'task done' });

    expect(agentApi.createAgentConversation).toHaveBeenCalled();
    expect(agentApi.runAgentTask).toHaveBeenCalled();
  });

  it('denies agent operations without required agent permissions', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const dispatch = createExtensionBackendCapabilityDispatcher();

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'createConversation',
        input: { input: { title: 'Test' } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:conversations to use agent.createConversation.');
    expect(agentApi.createAgentConversation).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'runTask',
        input: { input: { cwd: '/repo', prompt: 'Do something' } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:run to use agent.runTask.');
    expect(agentApi.runAgentTask).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 3,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'sendMessage',
        input: { input: { conversationId: 'agent-conv-1', text: 'Hello' } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:conversations to use agent.sendMessage.');
    expect(agentApi.sendAgentMessage).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 4,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'disposeConversation',
        input: { input: { conversationId: 'agent-conv-1' } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:conversations to use agent.disposeConversation.');
    expect(agentApi.disposeAgentConversation).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 5,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'getConversation',
        input: { input: { conversationId: 'agent-conv-1' } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:conversations to use agent.getConversation.');
    expect(agentApi.getAgentConversation).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 6,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'listConversations',
        input: { input: {} },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:conversations to use agent.listConversations.');
    expect(agentApi.listAgentConversations).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 7,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'abortConversation',
        input: { input: { conversationId: 'agent-conv-1' } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:conversations to use agent.abortConversation.');
    expect(agentApi.abortAgentConversation).not.toHaveBeenCalled();

    await expect(async () =>
      dispatch({
        id: 8,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'agent',
        operation: 'streamMessage',
        input: { handleId: 'handle-1', input: { conversationId: 'agent-conv-1', text: 'Hello' } },
      }),
    ).rejects.toThrow('Extension "ext" requires permission agent:conversations to use agent.streamMessage.');
    expect(agentApi.streamAgentMessage).not.toHaveBeenCalled();
  });

  it('dispatches network fetch capability calls with network:read permission', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: {
        permissions: ['network:read'],
      },
    });
    const network = {
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        text: '<html>hello</html>',
        bodyBase64: Buffer.from('<html>hello</html>').toString('base64'),
        url: 'https://example.com',
      })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ network });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-web-tools',
          capability: 'network',
          operation: 'fetch',
          input: { url: 'https://example.com', redirect: 'manual', timeoutMs: 15000 },
        }),
      ),
    ).resolves.toEqual({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' },
      text: '<html>hello</html>',
      bodyBase64: Buffer.from('<html>hello</html>').toString('base64'),
      url: 'https://example.com',
    });

    expect(network.fetch).toHaveBeenCalledWith({
      url: 'https://example.com',
      redirect: 'manual',
      timeoutMs: 15000,
    });
  });

  it('returns byte-preserving network fetch bodies from the default host fetch implementation', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: {
        permissions: ['network:read'],
      },
    });
    const body = Buffer.from([0x1f, 0x8b, 0x08, 0xff]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/gzip' },
      }),
    );
    const dispatch = createExtensionBackendCapabilityDispatcher({});

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-skill-search',
          capability: 'network',
          operation: 'fetch',
          input: { url: 'https://example.com/archive.tar.gz' },
        }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: 200,
      headers: { 'content-type': 'application/gzip' },
      bodyBase64: body.toString('base64'),
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/archive.tar.gz', expect.objectContaining({ signal: undefined }));
    fetchSpy.mockRestore();
  });

  it('denies network fetch without network:read permission', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: [] } });
    const network = { fetch: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ network });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: { url: 'https://example.com' },
      }),
    ).rejects.toThrow('requires permission network:read');
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed network fetch inputs', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['network:read'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher({ network: { fetch: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: { url: 1 },
      }),
    ).rejects.toThrow('Network url must be a string.');

    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: { url: 'https://example.com', redirect: 'bananas' },
      }),
    ).rejects.toThrow('Network redirect must be "follow", "error", or "manual".');

    await expect(async () =>
      dispatch({
        id: 3,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: null,
      }),
    ).rejects.toThrow('Network capability input must be an object.');
  });

  it('rejects unsupported network operations', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['network:read'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher({ network: { fetch: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'listen',
        input: { url: 'https://example.com' },
      }),
    ).rejects.toThrow('Unsupported network capability operation: listen');
  });

  it('dispatcher passes a text body through to network.fetch', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['network:read'] } });
    const network = {
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        text: '{"created":true}',
        bodyBase64: Buffer.from('{"created":true}').toString('base64'),
        url: 'https://example.com/api',
      })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ network });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-web-tools',
          capability: 'network',
          operation: 'fetch',
          input: {
            url: 'https://example.com/api',
            method: 'POST',
            body: '{"hello":"world"}',
          },
        }),
      ),
    ).resolves.toEqual({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      text: '{"created":true}',
      bodyBase64: Buffer.from('{"created":true}').toString('base64'),
      url: 'https://example.com/api',
    });

    expect(network.fetch).toHaveBeenCalledWith({
      url: 'https://example.com/api',
      method: 'POST',
      body: '{"hello":"world"}',
    });
  });

  it('default host fetch sends request body to global fetch', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['network:read'] } });
    const responseBody = Buffer.from('{"result":"ok"}');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(responseBody, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      }),
    );
    const dispatch = createExtensionBackendCapabilityDispatcher({});

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-web-tools',
          capability: 'network',
          operation: 'fetch',
          input: {
            url: 'https://example.com/api',
            method: 'PUT',
            body: '{"key":"value"}',
          },
        }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: 200,
      bodyBase64: responseBody.toString('base64'),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'PUT',
        body: '{"key":"value"}',
      }),
    );
    fetchSpy.mockRestore();
  });

  it('default host fetch sends bodyBase64 as decoded binary to global fetch', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['network:read'] } });
    const responseBody = Buffer.from([0x01, 0x02, 0x03]);
    const rawBody = 'Hello World';
    const rawBodyBase64 = Buffer.from(rawBody).toString('base64');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(responseBody, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    const dispatch = createExtensionBackendCapabilityDispatcher({});

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-web-tools',
          capability: 'network',
          operation: 'fetch',
          input: {
            url: 'https://example.com/upload',
            method: 'POST',
            bodyBase64: rawBodyBase64,
          },
        }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: 200,
      bodyBase64: responseBody.toString('base64'),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/upload',
      expect.objectContaining({
        method: 'POST',
        body: Buffer.from(rawBodyBase64, 'base64'),
      }),
    );
    fetchSpy.mockRestore();
  });

  it('rejects malformed body input with both body and bodyBase64', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['network:read'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher({ network: { fetch: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: {
          url: 'https://example.com/api',
          method: 'POST',
          body: 'text body',
          bodyBase64: Buffer.from('also binary').toString('base64'),
        },
      }),
    ).rejects.toThrow('Network fetch body must be either body or bodyBase64, not both.');
  });

  it('rejects malformed body type for bodyBase64', async () => {
    findExtensionEntry.mockReturnValue({ manifest: { permissions: ['network:read'] } });
    const dispatch = createExtensionBackendCapabilityDispatcher({ network: { fetch: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: {
          url: 'https://example.com/api',
          body: 42,
        },
      }),
    ).rejects.toThrow('Network body must be a string.');

    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: {
          url: 'https://example.com/api',
          bodyBase64: 42,
        },
      }),
    ).rejects.toThrow('Network bodyBase64 must be a string.');

    await expect(async () =>
      dispatch({
        id: 3,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'network',
        operation: 'fetch',
        input: {
          url: 'https://example.com/api',
          bodyBase64: 'not base64!',
        },
      }),
    ).rejects.toThrow('Network bodyBase64 must be valid base64.');
  });
});
