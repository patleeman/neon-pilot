import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SseEvent } from '../conversations/liveSessionEvents.js';

const state = vi.hoisted(() => ({
  attachGatewayConversation: vi.fn(),
  findGatewayChatTarget: vi.fn(),
  findGatewayChatTargetByConversation: vi.fn(),
  readGatewayState: vi.fn(() => ({ connections: [], bindings: [], chatTargets: [], events: [] })),
  recordGatewayEvent: vi.fn(),
  updateGatewayConnectionStatus: vi.fn(),
  upsertGatewayChatTarget: vi.fn(),
}));
const commands = vi.hoisted(() => ({
  formatTelegramGatewayHelp: vi.fn(() => 'help text'),
  parseTelegramGatewayCommand: vi.fn(() => null),
}));
const appEvents = vi.hoisted(() => ({ invalidateAppTopics: vi.fn() }));

vi.mock('./gatewayState.js', () => state);
vi.mock('./telegramCommands.js', () => commands);
vi.mock('../shared/appEvents.js', () => appEvents);

import {
  buildTelegramPromptText,
  formatTelegramToolSummary,
  renderTelegramHtml,
  renderTelegramToolStatus,
  splitTelegramMessage,
  TelegramGatewayRuntime,
} from './telegramGateway.js';

describe('TelegramGatewayRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function deps(overrides: Record<string, unknown> = {}) {
    return {
      stateRoot: mkdtempSync(join(tmpdir(), 'telegram-gateway-test-')),
      profile: 'shared',
      authFile: '/auth',
      createConversation: vi.fn(async () => ({ id: 'conv-new' })),
      listConversations: vi.fn(() => [
        { id: 'conv-1', title: 'Existing' },
        { id: 'conv-2', title: 'Project planning' },
      ]),
      listModels: vi.fn(() => [
        { id: 'provider/model-a', label: 'Model A' },
        { id: 'provider/model-b', label: 'Model B' },
      ]),
      submitPrompt: vi.fn(async () => undefined),
      renameConversation: vi.fn(async () => undefined),
      compactConversation: vi.fn(async () => undefined),
      archiveConversation: vi.fn(async () => undefined),
      getCurrentModel: vi.fn(() => 'model-1'),
      setModel: vi.fn(async () => undefined),
      readBotToken: vi.fn(() => 'token'),
      readAccessPolicy: vi.fn(() => ({ approvedUserIds: ['777'], approvedChatIds: ['123', 'C1'] })),
      notifyNewConversation: vi.fn(),
      fetch: vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, result: true }) })),
      ...overrides,
    };
  }

  it('renders Telegram-safe rich HTML from common markdown', () => {
    expect(renderTelegramHtml('**bold** `code` <x>')).toBe('<b>bold</b> <code>code</code> &lt;x&gt;');
    expect(renderTelegramHtml('- [x] shipped\n- [ ] test')).toBe('☑ shipped\n☐ test');
    expect(renderTelegramHtml('| Name | Status |\n| --- | --- |\n| Gateway | Ready |')).toBe('• Name: Gateway\n  Status: Ready');
    expect(renderTelegramHtml('```ts\nconst x = 1 < 2;\n```')).toBe('<pre>ts\nconst x = 1 &lt; 2;\n</pre>');
    expect(splitTelegramMessage('a'.repeat(9000)).length).toBeGreaterThan(1);
  });

  it('formats compact Telegram tool status lines', () => {
    expect(formatTelegramToolSummary('bash', { cmd: 'git status --short' })).toBe('bash: git status --short');
    expect(formatTelegramToolSummary('web.run', { search_query: [{ q: 'Hermes Agent Telegram speech to text' }] })).toBe(
      'run: search_query=[Hermes Agent Telegram speech to text]',
    );
    expect(renderTelegramToolStatus({ toolName: 'bash', summary: 'bash: pnpm test', status: 'running' })).toBe(
      '🔧 Running: bash: pnpm test',
    );
  });

  it('ignores updates without messages and creates/binds conversations for new chats', async () => {
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1 });
    await runtime.processUpdate({
      update_id: 2,
      message: { message_id: 10, chat: { id: 123, first_name: ' Pat ', last_name: ' Lee ' }, text: ' hello ' },
    });

    expect(d.createConversation).toHaveBeenCalledWith({ title: 'Telegram: Pat Lee' });
    expect(d.notifyNewConversation).toHaveBeenCalledWith('conv-new');
    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'telegram', externalChatId: '123', externalChatLabel: 'Pat Lee', conversationId: 'conv-new' }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-new', externalChatId: '123' }),
    );
    expect(d.renameConversation).toHaveBeenCalledWith('conv-new', 'Telegram: Pat Lee');
    expect(d.submitPrompt).toHaveBeenCalledWith({ conversationId: 'conv-new', text: 'hello', images: undefined });
  });

  it('binds every new Telegram chat so replies can route back to that chat', async () => {
    const d = deps({
      createConversation: vi.fn(async ({ title }: { title: string }) => ({
        id: title.endsWith('Group B') ? 'conv-b' : 'conv-a',
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 'A', title: 'Group A' }, from: { id: 777 }, text: 'first' },
    });
    await runtime.processUpdate({
      update_id: 2,
      message: { message_id: 11, chat: { id: 'B', title: 'Group B' }, from: { id: 777 }, text: 'second' },
    });

    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-a', externalChatId: 'A', externalChatLabel: 'Group A' }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-b', externalChatId: 'B', externalChatLabel: 'Group B' }),
    );
  });

  it('reuses existing chat targets and reports unsupported message types', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 'C1', title: 'Group' } } });

    expect(d.createConversation).not.toHaveBeenCalled();
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({
        body: expect.stringContaining('Unsupported Telegram message type'),
      }),
    );
  });

  it('reports command failures without throwing so Telegram can acknowledge the update', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'compact' });
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({ compactConversation: vi.fn().mockRejectedValue(new Error('Nothing to compact')) });
    const runtime = new TelegramGatewayRuntime(d as never);

    await expect(
      runtime.processUpdate({
        update_id: 1,
        message: { message_id: 10, chat: { id: 'C1', title: 'Group' }, from: { id: 777 }, text: '/compact' },
      }),
    ).resolves.toBeUndefined();

    expect(state.findGatewayChatTarget).toHaveBeenCalledWith(expect.objectContaining({ externalChatId: 'C1' }));
    expect(d.compactConversation).toHaveBeenCalledWith('conv-1');
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Telegram command failed: Nothing to compact') }),
    );
  });

  it('does not submit normal messages while replies are paused for the chat target', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing', repliesEnabled: false });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 'C1', title: 'Group' }, from: { id: 777 }, text: 'do not answer' },
    });

    expect(d.submitPrompt).not.toHaveBeenCalled();
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Telegram replies are paused') }),
    );
  });

  it('recreates stale chat targets that point at missing conversations', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'missing-conv', conversationTitle: 'Missing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 'C1', title: 'Group' }, from: { id: 777 }, text: 'hello again' },
    });

    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'routing', message: expect.stringContaining('pointed at a missing conversation') }),
    );
    expect(d.createConversation).toHaveBeenCalledWith({ title: 'Telegram: Group' });
    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(
      expect.objectContaining({ externalChatId: 'C1', conversationId: 'conv-new', conversationTitle: 'Telegram: Group' }),
    );
    expect(d.submitPrompt).toHaveBeenCalledWith({ conversationId: 'conv-new', text: 'hello again', images: undefined });
  });

  it('handles diagnostics commands even when the attached conversation is not in the active list', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'diagnostics' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'missing-conv', conversationTitle: 'Missing' });
    state.readGatewayState.mockReturnValueOnce({
      connections: [{ provider: 'telegram', status: 'active', enabled: true }],
      bindings: [],
      chatTargets: [],
      events: [],
    });
    const d = deps({
      listConversations: vi.fn(() => []),
      createConversation: vi.fn(async () => {
        throw new Error('should not create');
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 'C1', title: 'Group' }, from: { id: 777 }, text: '/diagnostics' },
    });

    expect(d.listConversations).not.toHaveBeenCalled();
    expect(d.createConversation).not.toHaveBeenCalled();
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Telegram diagnostics:') }),
    );
  });

  it('filters diagnostics events to the current runtime', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T12:00:00.000Z'));
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'diagnostics' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    state.readGatewayState.mockReturnValueOnce({
      connections: [{ provider: 'telegram', status: 'active', enabled: true }],
      bindings: [],
      chatTargets: [],
      events: [
        { provider: 'telegram', kind: 'error', message: 'old startup error', createdAt: '2026-06-28T11:59:59.000Z' },
        { provider: 'telegram', kind: 'status', message: 'runtime healthy', createdAt: '2026-06-28T12:00:01.000Z' },
      ],
    });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: '/diagnostics' },
    });

    const body = JSON.parse(String(d.fetch.mock.calls.at(-1)?.[1]?.body)) as { text: string };
    expect(body.text).toContain('runtime healthy');
    expect(body.text).not.toContain('old startup error');
  });

  it('builds prompt text from Telegram voice transcripts and captions', () => {
    expect(buildTelegramPromptText({ voiceTranscript: 'pick up milk' })).toBe(
      '[The user sent a Telegram voice message. Transcript: "pick up milk"]',
    );
    expect(buildTelegramPromptText({ text: 'also compare this', hasPhoto: true, voiceTranscript: 'what do you think?' })).toBe(
      '[The user sent a Telegram voice message. Transcript: "what do you think?"]\n\nalso compare this\n\n[The user also attached a Telegram photo.]',
    );
  });

  it('transcribes Telegram voice messages before submitting them as prompts', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const transcribeAudio = vi.fn(async () => ({ text: 'hello from voice' }));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/getFile')) {
        return { ok: true, json: async () => ({ ok: true, result: { file_path: 'voice/file_1.ogg' } }) };
      }
      if (url.includes('/file/bottoken/voice/file_1.ogg')) {
        const bytes = Buffer.from('voice bytes');
        return {
          ok: true,
          headers: { get: () => 'audio/ogg' },
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        };
      }
      return { ok: true, json: async () => ({ ok: true, result: { message_id: init?.body?.toString().includes('Working') ? 20 : 21 } }) };
    });
    const d = deps({ fetch: fetchMock, transcribeAudio });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: 123 },
        from: { id: 777 },
        voice: { file_id: 'voice-file', mime_type: 'audio/ogg', duration: 2 },
      },
    });

    expect(transcribeAudio).toHaveBeenCalledWith({
      dataBase64: Buffer.from('voice bytes').toString('base64'),
      mimeType: 'audio/ogg',
      fileName: 'file_1.ogg',
    });
    expect(d.submitPrompt).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      text: '[The user sent a Telegram voice message. Transcript: "hello from voice"]',
      images: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('hello from voice') }),
    );
  });

  it('treats /reset as starting a new Telegram conversation', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'new' });
    state.findGatewayChatTarget.mockReturnValueOnce({
      conversationId: 'old-conv',
      conversationTitle: 'Old',
      defaultCwd: '/repo',
      defaultModel: 'provider/model',
      mirrorMode: 'notify_only',
      pinnedConversationIds: ['old-conv'],
    });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 123, username: 'pat' }, from: { id: 777 }, text: '/reset' },
    });

    expect(d.createConversation).toHaveBeenCalledWith({ title: 'Telegram: pat', cwd: '/repo', model: 'provider/model' });
    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-new',
        mirrorMode: 'notify_only',
        pinnedConversationIds: ['old-conv'],
        defaultCwd: '/repo',
        defaultModel: 'provider/model',
      }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Started a new Telegram conversation.') }),
    );
  });

  it('handles command messages after ensuring chat target', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'model', model: 'provider/model' });
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 123, username: 'pat' }, text: '/model provider/model' },
    });

    expect(d.setModel).toHaveBeenCalledWith('conv-1', 'provider/model');
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Model set to provider/model.') }),
    );
    expect(d.submitPrompt).not.toHaveBeenCalled();
  });

  it('lists and switches Telegram chats between conversations', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'threads' }).mockReturnValueOnce({ kind: 'switch', target: '2' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/threads' } });
    await runtime.processUpdate({ update_id: 2, message: { message_id: 11, chat: { id: 123 }, text: '/switch 2' } });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Thread: Project planning') }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-2', conversationTitle: 'Project planning', externalChatId: '123' }),
    );
  });

  it('remembers the shown thread picker for numeric switches', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'threads' }).mockReturnValueOnce({ kind: 'switch', target: '2' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      listConversations: vi.fn((input?: { scope?: string }) => {
        if (input?.scope === 'active') {
          return [
            { id: 'conv-1', title: 'First shown' },
            { id: 'conv-2', title: 'Second shown' },
          ];
        }
        return [{ id: 'conv-1', title: 'Existing' }];
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/threads' } });
    await runtime.processUpdate({ update_id: 2, message: { message_id: 11, chat: { id: 123 }, text: '/switch 2' } });

    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-2', conversationTitle: 'Second shown', externalChatId: '123' }),
    );
  });

  it('previews conversations without switching and lists choices when /peek has no target', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'peek' }).mockReturnValueOnce({ kind: 'peek', target: '2' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      readConversationTail: vi.fn(async () => [
        { role: 'user', text: 'What changed?' },
        { role: 'assistant', text: 'The gateway preview works.' },
      ]),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/peek' } });
    await runtime.processUpdate({ update_id: 2, message: { message_id: 11, chat: { id: 123 }, text: '/peek 2' } });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"peek:conv-2') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('This was only a preview') }),
    );
    expect(state.attachGatewayConversation).not.toHaveBeenCalled();
  });

  it('searches archived conversations separately from active threads', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'archives', query: 'old' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      listConversations: vi.fn((input?: { scope?: string; query?: string }) => {
        if (input?.scope === 'archived' && input.query === 'old') {
          return [{ id: 'archived-1', title: 'Old build plan', placement: 'archived' }];
        }
        return [{ id: 'conv-1', title: 'Existing' }];
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/archives old' } });

    expect(d.listConversations).toHaveBeenCalledWith({ scope: 'archived', query: 'old' });
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Archived conversations matching') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"peek:archived-1') }),
    );
  });

  it('uses readConversationTail for /tail previews', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'tail', count: 5 });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      readConversationTail: vi.fn(async () => [
        { role: 'user', text: 'Where are we?' },
        { role: 'assistant', text: 'In the Telegram gateway.' },
      ]),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/tail 5' } });

    expect(d.readConversationTail).toHaveBeenCalledWith('conv-1', 20);
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('In the Telegram gateway.') }),
    );
  });

  it('omits tool calls from tail previews', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'tail', count: 5 });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const longImportOutput = [
      "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
      "import { useAppEvents } from '../../app/contexts.js';",
      "import { api } from '../../client/api.js';",
      "import { dispatchOpenWorkbenchChat } from '../workbench/workbenchChatEvents.js';",
      "import { buildComposerShelfContext } from './conversationComposerShelves.js';",
    ].join(' ');
    const d = deps({
      readConversationTail: vi.fn(async () => [
        { role: 'tool', text: 'bash finished: f5d453b8c fix: restore side chat rail marker 8c40b7308 Use main conversation page' },
        { role: 'user', text: 'Can you catch me up?' },
        { role: 'tool', text: `bash finished: ${longImportOutput}` },
        { role: 'assistant', text: 'The gateway preview works.' },
      ]),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/tail 5' } });

    const sendMessageBody = String(d.fetch.mock.calls.at(-1)?.[1]?.body ?? '');
    expect(sendMessageBody).toContain('1. You');
    expect(sendMessageBody).toContain('Can you catch me up?');
    expect(sendMessageBody).toContain('2. Assistant');
    expect(sendMessageBody).toContain('The gateway preview works.');
    expect(sendMessageBody).not.toContain('Tool');
    expect(sendMessageBody).not.toContain('bash finished');
    expect(sendMessageBody).not.toContain('useCallback');
  });

  it('explains when a tail preview only has tool calls', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'tail', count: 5 });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      readConversationTail: vi.fn(async () => [
        { role: 'tool', text: 'bash finished: f5d453b8c fix: restore side chat rail marker' },
        { role: 'tool', text: 'read finished: source file contents' },
      ]),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/tail 5' } });

    const sendMessageBody = String(d.fetch.mock.calls.at(-1)?.[1]?.body ?? '');
    expect(sendMessageBody).toContain('No recent user or assistant messages available.');
    expect(sendMessageBody).toContain('Tool output is hidden in Telegram previews.');
    expect(sendMessageBody).not.toContain('bash finished');
  });

  it('shows and renames the thread title with /title', async () => {
    commands.parseTelegramGatewayCommand
      .mockReturnValueOnce({ kind: 'title' })
      .mockReturnValueOnce({ kind: 'rename', title: 'New name' })
      .mockReturnValueOnce({ kind: 'title' });
    state.findGatewayChatTarget
      .mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' })
      .mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' })
      .mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'New name' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: '/title' } });
    await runtime.processUpdate({
      update_id: 2,
      message: { message_id: 11, chat: { id: 123 }, from: { id: 777 }, text: '/title New name' },
    });
    await runtime.processUpdate({ update_id: 3, message: { message_id: 12, chat: { id: 123 }, from: { id: 777 }, text: '/title' } });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Current thread title: Existing') }),
    );
    expect(d.renameConversation).toHaveBeenCalledWith('conv-1', 'New name');
    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        externalChatId: '123',
        conversationId: 'conv-1',
        conversationTitle: 'New name',
      }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        externalChatId: '123',
        conversationId: 'conv-1',
        conversationTitle: 'New name',
      }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Current thread title: New name') }),
    );
  });

  it('shows status with inline management buttons', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'status' });
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: '/status' } });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"cmd:/model') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"cmd:/stop') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"cmd:/compact') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"cmd:/title') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"cmd:/detach') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"cmd:/archive') }),
    );
  });

  it('includes whoami in the help inline controls', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'help' });
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: '/help' } });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"cmd:/whoami') }),
    );
  });

  it('reports Telegram user and chat IDs with /whoami', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'whoami' });
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: '/whoami' },
    });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('User ID: 777') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Matched: chat ID') }),
    );
  });

  it('shows an inline model picker for /model without arguments', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'model' });
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({ getCurrentModel: vi.fn(() => 'provider/model-b') });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: '/model' } });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({
        body: expect.stringContaining('callback_data":"model:provider/model-b'),
      }),
    );
  });

  it('still handles callback actions when answering the callback fails', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'switch', target: 'conv-2' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      fetch: vi.fn(async (url: string) => ({
        ok: !url.endsWith('/answerCallbackQuery'),
        json: async () =>
          url.endsWith('/answerCallbackQuery')
            ? { ok: false, description: 'query is too old' }
            : { ok: true, result: url.endsWith('/sendMessage') ? { message_id: 42 } : true },
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      callback_query: {
        id: 'callback-1',
        from: { id: 777 },
        data: 'switch:conv-2',
        message: { message_id: 10, chat: { id: 123 } },
      },
    });

    expect(state.attachGatewayConversation).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-2' }));
  });

  it('paginates the inline thread picker from callback buttons', async () => {
    const d = deps({
      listConversations: vi.fn(() => Array.from({ length: 10 }, (_, index) => ({ id: `conv-${index + 1}`, title: `Thread ${index + 1}` }))),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      callback_query: {
        id: 'callback-1',
        from: { id: 777 },
        data: 'threadpage:1',
        message: { message_id: 10, chat: { id: 123 } },
      },
    });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"switch:conv-9') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('2/2') }),
    );
  });

  it('paginates the inline model picker from callback buttons', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      listModels: vi.fn(() => Array.from({ length: 10 }, (_, index) => ({ id: `provider/model-${index + 1}` }))),
      getCurrentModel: vi.fn(() => 'provider/model-9'),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      callback_query: {
        id: 'callback-1',
        from: { id: 777 },
        data: 'modelpage:1',
        message: { message_id: 10, chat: { id: 123 } },
      },
    });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('callback_data":"model:provider/model-9') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('2/2') }),
    );
  });

  it('handles inline keyboard callbacks as slash commands', async () => {
    commands.parseTelegramGatewayCommand.mockReturnValueOnce({ kind: 'switch', target: 'conv-2' });
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      callback_query: {
        id: 'callback-1',
        from: { id: 777 },
        data: 'switch:conv-2',
        message: { message_id: 10, chat: { id: 123 } },
      },
    });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/answerCallbackQuery',
      expect.objectContaining({ body: JSON.stringify({ callback_query_id: 'callback-1' }) }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-2' }));
  });

  it('loads best Telegram photo and submits it as an image prompt', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      fetch: vi.fn(async (url: string) => {
        if (url.endsWith('/getFile')) return { ok: true, json: async () => ({ ok: true, result: { file_path: 'photos/file.jpg' } }) };
        if (url.includes('/file/bot'))
          return { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
        return { ok: true, json: async () => ({ ok: true, result: true }) };
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: 123 },
        caption: ' see photo ',
        photo: [
          { file_id: 'small', file_size: 1 },
          { file_id: 'large', file_size: 10 },
        ],
      },
    });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/getFile',
      expect.objectContaining({ body: JSON.stringify({ file_id: 'large' }) }),
    );
    expect(d.submitPrompt).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      text: 'see photo',
      images: [{ data: 'AQID', mimeType: 'image/png', name: 'telegram-photo.jpg' }],
    });
  });

  it('submits Telegram image documents and rejects non-image files with a clear message', async () => {
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      fetch: vi.fn(async (url: string) => {
        if (url.endsWith('/getFile')) return { ok: true, json: async () => ({ ok: true, result: { file_path: 'docs/file.png' } }) };
        if (url.includes('/file/bot'))
          return { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
        return { ok: true, json: async () => ({ ok: true, result: true }) };
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: 123 },
        caption: ' see file image ',
        document: { file_id: 'doc-image', file_name: 'diagram.png', mime_type: 'image/png' },
      },
    });

    expect(d.submitPrompt).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      text: 'see file image',
      images: [{ data: 'AQID', mimeType: 'image/png', name: 'diagram.png' }],
    });

    await runtime.processUpdate({
      update_id: 2,
      message: {
        message_id: 11,
        chat: { id: 123 },
        document: { file_id: 'doc-pdf', file_name: 'report.pdf', mime_type: 'application/pdf' },
      },
    });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('report.pdf') }),
    );
  });

  it('rejects messages from unapproved Telegram users and chats', async () => {
    const d = deps({ readAccessPolicy: vi.fn(() => ({ approvedUserIds: [], approvedChatIds: ['999'] })) });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({
      update_id: 1,
      message: { message_id: 10, chat: { id: 123, first_name: 'Pat' }, from: { id: 777 }, text: 'hello' },
    });

    expect(d.createConversation).not.toHaveBeenCalled();
    expect(d.submitPrompt).not.toHaveBeenCalled();
    expect(state.recordGatewayEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({
        body: expect.stringContaining('not approved for Neon Pilot'),
      }),
    );
  });

  it('edits the working status message when delivering the next assistant reply', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    const d = deps({
      fetch: vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({
          ok: true,
          result: url.endsWith('/sendMessage') ? { message_id: 42 } : true,
        }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello' } });
    await runtime.deliverAssistantReply({ conversationId: 'conv-1', text: '**done**' });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('"message_id":42') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('<b>done</b>') }),
    );
  });

  it('sends new Telegram messages for streamed tool calls', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    let streamListener: ((event: SseEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    const d = deps({
      subscribeConversationEvents: vi.fn((_conversationId: string, listener: (event: SseEvent) => void) => {
        streamListener = listener;
        return unsubscribe;
      }),
      fetch: vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({
          ok: true,
          result: url.endsWith('/sendMessage') ? { message_id: 42 } : true,
        }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello' } });
    expect(d.subscribeConversationEvents).toHaveBeenCalledWith('conv-1', expect.any(Function));

    const editCallsBeforeTools = d.fetch.mock.calls.filter(([url]) => String(url).endsWith('/editMessageText')).length;

    streamListener?.({ type: 'tool_start', toolCallId: 'tool-1', toolName: 'bash', args: { cmd: 'pnpm test:dictation' } });
    await vi.waitFor(() =>
      expect(d.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken/sendMessage',
        expect.objectContaining({ body: expect.stringContaining('Running: bash: pnpm test:dictation') }),
      ),
    );
    expect(d.fetch.mock.calls.filter(([url]) => String(url).endsWith('/editMessageText'))).toHaveLength(editCallsBeforeTools);

    streamListener?.({
      type: 'tool_end',
      toolCallId: 'tool-1',
      toolName: 'bash',
      isError: false,
      durationMs: 12,
      output: 'ok',
    });
    await vi.waitFor(() =>
      expect(d.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken/sendMessage',
        expect.objectContaining({ body: expect.stringContaining('Done: bash: pnpm test:dictation') }),
      ),
    );
    expect(d.fetch.mock.calls.filter(([url]) => String(url).endsWith('/editMessageText'))).toHaveLength(editCallsBeforeTools);

    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    await runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'final reply' });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('edits the working message from the latest assistant reply after prompt submission', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    const d = deps({
      readLatestAssistantReply: vi.fn(async () => ({ text: 'final reply' })),
      fetch: vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({ ok: true, result: url.endsWith('/sendMessage') ? { message_id: 42 } : true }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello' } });

    expect(d.readLatestAssistantReply).toHaveBeenCalledWith('conv-1');
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('final reply') }),
    );
  });

  it('waits for a fresh assistant reply instead of delivering a stale previous reply', async () => {
    vi.useFakeTimers();
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    const staleTimestamp = new Date(Date.now() - 10_000).toISOString();
    const freshTimestamp = new Date(Date.now() + 1_000).toISOString();
    const d = deps({
      readLatestAssistantReply: vi
        .fn()
        .mockResolvedValueOnce({ text: 'stale reply', timestamp: staleTimestamp })
        .mockResolvedValueOnce({ text: 'fresh reply', timestamp: freshTimestamp }),
      fetch: vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({ ok: true, result: url.endsWith('/sendMessage') ? { message_id: 42 } : true }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    const updatePromise = runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello' } });
    await vi.advanceTimersByTimeAsync(500);
    await updatePromise;

    expect(d.fetch).not.toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('stale reply') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('fresh reply') }),
    );
  });

  it('edits the working message from streamed assistant text on agent end', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    let streamListener: ((event: SseEvent) => void) | null = null;
    const unsubscribe = vi.fn();
    const d = deps({
      subscribeConversationEvents: vi.fn((_conversationId: string, listener: (event: SseEvent) => void) => {
        streamListener = listener;
        return unsubscribe;
      }),
      fetch: vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({ ok: true, result: url.endsWith('/sendMessage') ? { message_id: 42 } : true }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello' } });
    streamListener?.({ type: 'text_delta', delta: 'final ' });
    streamListener?.({ type: 'text_delta', delta: 'reply' });
    streamListener?.({ type: 'agent_end' });

    await vi.waitFor(() =>
      expect(d.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken/editMessageText',
        expect.objectContaining({ body: expect.stringContaining('final reply') }),
      ),
    );
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('falls back to a new message when editing the working message fails', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    const d = deps({
      fetch: vi.fn(async (url: string) => ({
        ok: !url.endsWith('/editMessageText'),
        json: async () =>
          url.endsWith('/editMessageText')
            ? { ok: false, description: 'message is not modified' }
            : { ok: true, result: url.endsWith('/sendMessage') ? { message_id: 42 } : true },
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello' } });
    await runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'final reply' });

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('final reply') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('final reply') }),
    );
  });

  it('edits the working message into an error when prompt submission fails', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      submitPrompt: vi.fn(async () => {
        throw new Error('boom');
      }),
      fetch: vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({ ok: true, result: url.endsWith('/sendMessage') ? { message_id: 42 } : true }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await expect(runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello' } })).rejects.toThrow(
      'boom',
    );

    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('Telegram prompt failed: boom') }),
    );

    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    await runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'late reply' });
    const editCalls = d.fetch.mock.calls.filter(([url]) => String(url).endsWith('/editMessageText'));
    expect(editCalls).toHaveLength(1);
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('late reply') }),
    );
  });

  it('suppresses explicit Telegram silence-token replies', async () => {
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: '[SILENT]' })).resolves.toBe(true);

    expect(state.findGatewayChatTargetByConversation).not.toHaveBeenCalled();
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('delivers assistant replies to bound chats and records events', async () => {
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: ' hello ' })).resolves.toBe(true);
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('hello') }),
    );
    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'outbound', message: 'Delivered assistant reply to Pat' }),
    );
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: '   ' })).resolves.toBe(false);
    state.findGatewayChatTargetByConversation.mockReturnValueOnce(null);
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'missing target' })).resolves.toBe(false);
  });

  it('deduplicates concurrent assistant reply deliveries', async () => {
    state.findGatewayChatTargetByConversation.mockReturnValue({ externalChatId: '123', externalChatLabel: 'Pat' });
    let resolveFirstSend: (() => void) | undefined;
    let notifyFirstSendStarted: (() => void) | undefined;
    const firstSendStarted = new Promise<void>((resolve) => {
      notifyFirstSendStarted = resolve;
    });
    const d = deps({
      fetch: vi.fn(async (url: string) => {
        if (url.includes('/sendMessage') && !resolveFirstSend) {
          notifyFirstSendStarted?.();
          await new Promise<void>((resolve) => {
            resolveFirstSend = resolve;
          });
        }
        return {
          ok: true,
          json: async () => ({ ok: true, result: true }),
        } as Response;
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    const first = runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'same reply' });
    await firstSendStarted;
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'same reply' })).resolves.toBe(true);
    resolveFirstSend?.();
    await first;

    const sendCalls = d.fetch.mock.calls.filter(([url]) => String(url).includes('/sendMessage'));
    expect(sendCalls).toHaveLength(1);
  });

  it('delivers desktop user prompts to bound chats and records events', async () => {
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await expect(runtime.deliverDesktopUserPrompt({ conversationId: 'conv-1', text: ' hello from desktop ' })).resolves.toBe(true);
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Desktop') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('hello from desktop') }),
    );
    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'outbound', message: 'Delivered desktop prompt to Pat' }),
    );

    await expect(runtime.deliverDesktopUserPrompt({ conversationId: 'conv-1', text: '   ' })).resolves.toBe(false);
    state.findGatewayChatTargetByConversation.mockReturnValueOnce(null);
    await expect(runtime.deliverDesktopUserPrompt({ conversationId: 'conv-1', text: 'hello' })).resolves.toBe(false);
  });

  it('respects mirror modes for desktop-originated delivery', async () => {
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    state.findGatewayChatTargetByConversation.mockReturnValueOnce({
      externalChatId: '123',
      externalChatLabel: 'Pat',
      mirrorMode: 'notify_only',
    });
    await expect(runtime.deliverDesktopUserPrompt({ conversationId: 'conv-1', text: 'desktop hello' })).resolves.toBe(false);

    state.findGatewayChatTargetByConversation.mockReturnValueOnce({
      externalChatId: '123',
      externalChatLabel: 'Pat',
      mirrorMode: 'muted',
    });
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'assistant hello' })).resolves.toBe(false);

    expect(d.fetch).not.toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('desktop hello') }),
    );
    expect(d.fetch).not.toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('assistant hello') }),
    );
  });

  it('handles mirror, cancel, summary, export, pins, diagnostics, and defaults commands', async () => {
    commands.parseTelegramGatewayCommand
      .mockReturnValueOnce({ kind: 'mirror', mode: 'notify_only' })
      .mockReturnValueOnce({ kind: 'cancel' })
      .mockReturnValueOnce({ kind: 'summary', count: 4 })
      .mockReturnValueOnce({ kind: 'export', count: 4 })
      .mockReturnValueOnce({ kind: 'pin' })
      .mockReturnValueOnce({ kind: 'pins' })
      .mockReturnValueOnce({ kind: 'default_model', model: 'provider/model-a' })
      .mockReturnValueOnce({ kind: 'default_cwd', cwd: '/repo' })
      .mockReturnValueOnce({ kind: 'defaults' })
      .mockReturnValueOnce({ kind: 'diagnostics' });
    state.findGatewayChatTarget.mockReturnValue({
      conversationId: 'conv-1',
      conversationTitle: 'Existing',
      externalChatId: '123',
      repliesEnabled: true,
      pinnedConversationIds: ['conv-1'],
      defaultModel: 'provider/model-a',
      defaultCwd: '/repo',
      mirrorMode: 'notify_only',
    });
    state.readGatewayState.mockReturnValue({
      connections: [{ provider: 'telegram', status: 'active', enabled: true }],
      bindings: [],
      chatTargets: [],
      events: [{ provider: 'telegram', kind: 'outbound', message: 'Delivered', createdAt: 'now' }],
    });
    const d = deps({
      abortConversation: vi.fn(async () => undefined),
      readConversationTail: vi.fn(async () => [
        { role: 'user', text: 'question' },
        { role: 'assistant', text: 'answer' },
      ]),
      listModels: vi.fn(() => [{ id: 'provider/model-a' }]),
      fetch: vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({
          ok: true,
          result: url.endsWith('/sendMessage') || url.endsWith('/sendDocument') ? { message_id: 42 } : true,
        }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);
    const message = { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: '/cmd' };

    for (let updateId = 1; updateId <= 10; updateId += 1) {
      await runtime.processUpdate({ update_id: updateId, message });
    }

    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(expect.objectContaining({ mirrorMode: 'notify_only' }));
    expect(d.abortConversation).toHaveBeenCalledWith('conv-1');
    expect(d.fetch).toHaveBeenCalledWith('https://api.telegram.org/bottoken/sendDocument', expect.anything());
    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(expect.objectContaining({ pinnedConversationIds: ['conv-1'] }));
    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(expect.objectContaining({ defaultModel: 'provider/model-a' }));
    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(expect.objectContaining({ defaultCwd: '/repo' }));
  });

  it('does not echo Telegram-originated prompts as desktop prompts', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, text: 'hello from telegram' } });
    const fetchCallCount = d.fetch.mock.calls.length;
    state.findGatewayChatTargetByConversation.mockClear();

    await expect(runtime.deliverDesktopUserPrompt({ conversationId: 'conv-1', text: ' hello from telegram ' })).resolves.toBe(true);

    expect(state.findGatewayChatTargetByConversation).not.toHaveBeenCalled();
    expect(d.fetch.mock.calls).toHaveLength(fetchCallCount);
  });

  it('mirrors desktop live user messages for bound conversations', async () => {
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    let streamListener: ((event: SseEvent) => void) | undefined;
    const d = deps({
      subscribeConversationEvents: vi.fn((_conversationId: string, listener: (event: SseEvent) => void) => {
        streamListener = listener;
        return vi.fn();
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    runtime.startMirroringConversation('conv-1');
    streamListener?.({ type: 'user_message', block: { type: 'user', text: 'desktop hello' } as never });

    await vi.waitFor(() =>
      expect(d.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken/sendMessage',
        expect.objectContaining({ body: expect.stringContaining('desktop hello') }),
      ),
    );
  });

  it('delivers the latest assistant reply when mirrored desktop turns end without text deltas', async () => {
    state.findGatewayChatTargetByConversation.mockReturnValue({ externalChatId: '123', externalChatLabel: 'Pat' });
    let streamListener: ((event: SseEvent) => void) | undefined;
    const d = deps({
      readLatestAssistantReply: vi.fn(async () => ({ text: 'persisted reply', timestamp: new Date(Date.now() + 1000).toISOString() })),
      subscribeConversationEvents: vi.fn((_conversationId: string, listener: (event: SseEvent) => void) => {
        streamListener = listener;
        return vi.fn();
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    runtime.startMirroringConversation('conv-1');
    streamListener?.({ type: 'user_message', block: { type: 'user', text: 'desktop hello' } as never });
    streamListener?.({ type: 'turn_end' });

    await vi.waitFor(() =>
      expect(d.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken/sendMessage',
        expect.objectContaining({ body: expect.stringContaining('persisted reply') }),
      ),
    );
  });

  it('start/stop respect bot token availability, publishes Telegram commands, and aborts polling', async () => {
    const d = deps({ readBotToken: vi.fn(() => null) });
    const runtime = new TelegramGatewayRuntime(d as never);
    runtime.start();
    expect(d.fetch).not.toHaveBeenCalled();

    const d2 = deps({ fetch: vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, result: [] }) })) });
    const runtime2 = new TelegramGatewayRuntime(d2 as never);
    runtime2.start();
    expect(runtime2.isRunning()).toBe(true);
    await vi.waitFor(() => expect(d2.fetch).toHaveBeenCalledWith('https://api.telegram.org/bottoken/setMyCommands', expect.anything()));
    expect(d2.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/setMyCommands',
      expect.objectContaining({ body: expect.stringContaining('"command":"threads"') }),
    );
    expect(d2.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/setMyCommands',
      expect.objectContaining({ body: expect.stringContaining('"command":"sessions"') }),
    );
    expect(d2.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/setMyCommands',
      expect.objectContaining({ body: expect.stringContaining('"command":"whoami"') }),
    );
    expect(d2.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/setMyCommands',
      expect.objectContaining({ body: expect.stringContaining('"command":"pause"') }),
    );
    expect(runtime2.isRunning()).toBe(true);
    runtime2.stop();
    expect(runtime2.isRunning()).toBe(false);
  });

  it('records update failures without acknowledging failed Telegram updates', async () => {
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    let getUpdatesCalls = 0;
    const d = deps({
      submitPrompt: vi.fn().mockRejectedValueOnce(new Error('first prompt failed')).mockResolvedValueOnce(undefined),
      fetch: vi.fn(async (url: string) => {
        if (url.endsWith('/getUpdates')) {
          getUpdatesCalls += 1;
          if (getUpdatesCalls > 1) {
            return new Promise(() => undefined);
          }
          return {
            ok: true,
            json: async () => ({
              ok: true,
              result: [
                { update_id: 1, message: { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: 'first' } },
                { update_id: 2, message: { message_id: 11, chat: { id: 123 }, from: { id: 777 }, text: 'second' } },
              ],
            }),
          };
        }
        return { ok: true, json: async () => ({ ok: true, result: url.endsWith('/sendMessage') ? { message_id: 42 } : true }) };
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    runtime.start();
    await vi.waitFor(() => expect(d.submitPrompt).toHaveBeenCalledTimes(1));
    runtime.stop();

    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', message: 'Telegram update 1 failed: first prompt failed' }),
    );
    expect(d.submitPrompt).not.toHaveBeenCalledWith(expect.objectContaining({ text: 'second' }));
    const getUpdatesBodies = d.fetch.mock.calls
      .filter(([url]) => String(url).endsWith('/getUpdates'))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { offset?: number });
    expect(getUpdatesBodies[1]?.offset).toBeUndefined();
  });

  it('queues concurrent Telegram prompts without replacing the active working message', async () => {
    state.findGatewayChatTarget.mockReturnValue({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps({
      fetch: vi.fn(async (url: string, init?: RequestInit) => ({
        ok: true,
        json: async () => ({
          ok: true,
          result: url.endsWith('/sendMessage')
            ? { message_id: String(init?.body).includes('Working') ? 41 : String(init?.body).includes('Queued') ? 42 : 43 }
            : true,
        }),
      })),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 123 }, from: { id: 777 }, text: 'first' } });
    await runtime.processUpdate({ update_id: 2, message: { message_id: 11, chat: { id: 123 }, from: { id: 777 }, text: 'second' } });
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    await runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'first reply' });

    expect(d.submitPrompt).toHaveBeenNthCalledWith(1, { conversationId: 'conv-1', text: 'first', images: undefined });
    expect(d.submitPrompt).toHaveBeenNthCalledWith(2, { conversationId: 'conv-1', text: 'second', images: undefined });
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: expect.stringContaining('Queued behind the current Telegram request.') }),
    );
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/editMessageText',
      expect.objectContaining({ body: expect.stringContaining('"message_id":41') }),
    );
  });

  it('surfaces polling failures in gateway state and restores active status after recovery', async () => {
    vi.useFakeTimers();
    let getUpdatesCalls = 0;
    const d = deps({
      fetch: vi.fn(async (url: string) => {
        if (url.endsWith('/setMyCommands')) {
          return { ok: true, json: async () => ({ ok: true, result: true }) };
        }
        if (url.endsWith('/getUpdates')) {
          getUpdatesCalls += 1;
          if (getUpdatesCalls === 1) {
            return { ok: false, json: async () => ({ ok: false, description: 'Unauthorized' }) };
          }
          if (getUpdatesCalls === 2) {
            return { ok: true, json: async () => ({ ok: true, result: [] }) };
          }
          return new Promise(() => undefined);
        }
        return { ok: true, json: async () => ({ ok: true, result: true }) };
      }),
    });
    const runtime = new TelegramGatewayRuntime(d as never);

    runtime.start();
    await vi.waitFor(() =>
      expect(state.updateGatewayConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'needs_attention', statusMessage: 'Telegram polling failed: Unauthorized' }),
      ),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() =>
      expect(state.updateGatewayConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', statusMessage: 'Telegram gateway connected' }),
      ),
    );
    runtime.stop();
  });

  it('prevents two runtime instances in this app from polling the same state root without a false conflict event', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'telegram-gateway-lock-test-'));
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, result: [] }) }));
    const first = new TelegramGatewayRuntime(deps({ stateRoot, fetch }) as never);
    const second = new TelegramGatewayRuntime(deps({ stateRoot, fetch }) as never);

    first.start();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/bottoken/setMyCommands', expect.anything()));
    second.start();

    expect(second.isRunning()).toBe(false);
    expect(state.recordGatewayEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', message: expect.stringContaining('already polling') }),
    );
    first.stop();
    second.start();
    expect(second.isRunning()).toBe(true);
    second.stop();
    rmSync(stateRoot, { recursive: true, force: true });
  });
});
