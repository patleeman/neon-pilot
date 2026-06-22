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

import { renderTelegramHtml, splitTelegramMessage, TelegramGatewayRuntime } from './telegramGateway.js';

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
        body: expect.stringContaining('Unsupported Telegram message type'),
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
      expect.objectContaining({ body: expect.stringContaining('Project planning — conv-2') }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-2', conversationTitle: 'Project planning', externalChatId: '123' }),
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
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'hello' })).resolves.toBe(false);
  });

  it('start/stop respect bot token availability, publishes Telegram commands, and aborts polling', async () => {
    const d = deps({ readBotToken: vi.fn(() => null) });
    const runtime = new TelegramGatewayRuntime(d as never);
    runtime.start();
    expect(d.fetch).not.toHaveBeenCalled();

    const d2 = deps({ fetch: vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, result: [] }) })) });
    const runtime2 = new TelegramGatewayRuntime(d2 as never);
    runtime2.start();
    await vi.waitFor(() => expect(d2.fetch).toHaveBeenCalledWith('https://api.telegram.org/bottoken/setMyCommands', expect.anything()));
    expect(d2.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/setMyCommands',
      expect.objectContaining({ body: expect.stringContaining('"command":"threads"') }),
    );
    runtime2.stop();
  });
});
