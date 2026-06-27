import { describe, expect, it, vi } from 'vitest';

import { TelegramGatewayRuntime } from './telegramGateway.js';

vi.mock('./gatewayState.js', () => ({
  attachGatewayConversation: vi.fn(),
  findGatewayChatTarget: vi.fn(() => ({ conversationId: 'conv-1', conversationTitle: 'Telegram: Pat' })),
  findGatewayChatTargetByConversation: vi.fn(() => ({ externalChatId: '123', externalChatLabel: 'Pat' })),
  recordGatewayEvent: vi.fn(),
  updateGatewayConnectionStatus: vi.fn(),
  upsertGatewayChatTarget: vi.fn(),
}));

vi.mock('./telegramCommands.js', async (importOriginal) => await importOriginal<typeof import('./telegramCommands.js')>());

describe('Telegram gateway Hermes-style UX smoke', () => {
  it('handles thread buttons, working-message edit, rich rendering, and model picker callbacks', async () => {
    const submitPrompt = vi.fn(async () => undefined);
    const setModel = vi.fn(async () => undefined);
    const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      const method = url.split('/').pop() ?? '';
      calls.push({ method, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      return {
        ok: true,
        json: async () => ({ ok: true, result: method === 'sendMessage' ? { message_id: 99 } : [] }),
      };
    });
    const runtime = new TelegramGatewayRuntime({
      stateRoot: '/state',
      profile: 'shared',
      authFile: '/auth',
      createConversation: vi.fn(async () => ({ id: 'conv-new' })),
      listConversations: vi.fn(() => [
        { id: 'conv-1', title: 'Telegram: Pat' },
        { id: 'conv-2', title: 'Build plan' },
      ]),
      listModels: vi.fn(() => [{ id: 'openai/gpt-5.5' }, { id: 'anthropic/claude' }]),
      submitPrompt,
      renameConversation: vi.fn(),
      compactConversation: vi.fn(),
      archiveConversation: vi.fn(),
      getCurrentModel: vi.fn(() => 'openai/gpt-5.5'),
      setModel,
      readBotToken: vi.fn(() => 'token'),
      readAccessPolicy: vi.fn(() => ({ approvedUserIds: ['777'], approvedChatIds: ['123'] })),
      fetch: fetch as never,
    });

    await runtime.processUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 123 }, from: { id: 777 }, text: '/threads' } });
    await runtime.processUpdate({
      update_id: 2,
      callback_query: { id: 'cb-1', from: { id: 777 }, data: 'model:anthropic/claude', message: { message_id: 2, chat: { id: 123 } } },
    });
    await runtime.processUpdate({ update_id: 3, message: { message_id: 3, chat: { id: 123 }, from: { id: 777 }, text: 'make **table**' } });
    await runtime.deliverAssistantReply({
      conversationId: 'conv-1',
      text: '| Item | State |\n| --- | --- |\n| Gateway | **Ready** |\n\n- [x] Buttons\n- [ ] Streaming',
    });

    expect(calls.find((call) => call.method === 'sendMessage' && JSON.stringify(call.body).includes('switch:conv-2'))).toBeTruthy();
    expect(setModel).toHaveBeenCalledWith('conv-1', 'anthropic/claude');
    expect(submitPrompt).toHaveBeenCalledWith({ conversationId: 'conv-1', text: 'make **table**', images: undefined });
    const edited = calls.find((call) => call.method === 'editMessageText');
    expect(edited?.body).toMatchObject({ chat_id: '123', message_id: 99, parse_mode: 'HTML', disable_web_page_preview: true });
    expect(String(edited?.body.text)).toContain('☑ Buttons');
    expect(String(edited?.body.text)).toContain('<b>Ready</b>');
  });
});
