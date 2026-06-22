import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  attachGatewayConversation: vi.fn(),
  findGatewayChatTarget: vi.fn(),
  findGatewayChatTargetByConversation: vi.fn(),
  hasGatewayBinding: vi.fn(() => false),
  recordGatewayEvent: vi.fn(),
  upsertGatewayChatTarget: vi.fn(),
}));
const commands = vi.hoisted(() => ({
  formatTelegramGatewayHelp: vi.fn(() => 'help text'),
  parseTelegramGatewayCommand: vi.fn(() => null),
}));

vi.mock('./gatewayState.js', () => state);
vi.mock('./telegramCommands.js', () => commands);

import { TelegramGatewayRuntime } from './telegramGateway.js';

describe('TelegramGatewayRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function deps(overrides: Record<string, unknown> = {}) {
    return {
      stateRoot: '/state',
      profile: 'shared',
      authFile: '/auth',
      createConversation: vi.fn(async () => ({ id: 'conv-new' })),
      listConversations: vi.fn(() => [
        { id: 'conv-1', title: 'Existing' },
        { id: 'conv-2', title: 'Project planning' },
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

  it('reuses existing chat targets and reports unsupported message types', async () => {
    state.findGatewayChatTarget.mockReturnValueOnce({ conversationId: 'conv-1', conversationTitle: 'Existing' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await runtime.processUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 'C1', title: 'Group' } } });

    expect(d.createConversation).not.toHaveBeenCalled();
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({
        body: JSON.stringify({ chat_id: 'C1', text: 'Unsupported Telegram message type. Send text or a photo.' }),
      }),
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
      expect.objectContaining({ body: JSON.stringify({ chat_id: '123', text: 'Model set to provider/model.' }) }),
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
      expect.objectContaining({ body: expect.stringContaining('Project planning — conv-2') }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-2', conversationTitle: 'Project planning', externalChatId: '123' }),
    );
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
        body: JSON.stringify({
          chat_id: '123',
          text: 'This Telegram chat is not approved for Neon Pilot. Ask the app owner to approve chat ID 123 or user ID 777.',
        }),
      }),
    );
  });

  it('delivers assistant replies to bound chats and records events', async () => {
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: '123', externalChatLabel: 'Pat' });
    const d = deps();
    const runtime = new TelegramGatewayRuntime(d as never);

    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: ' hello ' })).resolves.toBe(true);
    expect(d.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.objectContaining({ body: JSON.stringify({ chat_id: '123', text: 'hello' }) }),
    );
    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'outbound', message: 'Delivered assistant reply to Pat' }),
    );
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: '   ' })).resolves.toBe(false);
    state.findGatewayChatTargetByConversation.mockReturnValueOnce(null);
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'hello' })).resolves.toBe(false);
  });

  it('start/stop respect bot token availability and abort polling', () => {
    const d = deps({ readBotToken: vi.fn(() => null) });
    const runtime = new TelegramGatewayRuntime(d as never);
    runtime.start();
    expect(d.fetch).not.toHaveBeenCalled();

    const d2 = deps({ fetch: vi.fn(async () => new Promise(() => undefined)) });
    const runtime2 = new TelegramGatewayRuntime(d2 as never);
    runtime2.start();
    runtime2.stop();
    expect(d2.fetch).toHaveBeenCalled();
  });
});
