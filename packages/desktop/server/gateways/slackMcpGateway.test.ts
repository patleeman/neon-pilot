import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ connectMcpServerDirect: vi.fn() }));
const state = vi.hoisted(() => ({
  attachGatewayConversation: vi.fn(),
  detachGatewayConversation: vi.fn(),
  findGatewayChatTarget: vi.fn(),
  findGatewayChatTargetByConversation: vi.fn(),
  readGatewayState: vi.fn(() => ({ chatTargets: [] })),
  recordGatewayEvent: vi.fn(),
  updateGatewayConnectionStatus: vi.fn(),
  upsertGatewayChatTarget: vi.fn(),
}));
const commands = vi.hoisted(() => ({
  formatSlackMcpGatewayHelp: vi.fn(() => 'help text'),
  parseSlackMcpGatewayCommand: vi.fn(() => null),
}));

vi.mock('@neon-pilot/core', () => core);
vi.mock('./gatewayState.js', () => state);
vi.mock('./slackMcpCommands.js', () => commands);

import { SLACK_MCP_SERVER_CONFIG, SlackMcpGatewayRuntime } from './slackMcpGateway.js';

describe('SlackMcpGatewayRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function deps(overrides: Record<string, unknown> = {}) {
    return {
      stateRoot: '/state',
      profile: 'shared',
      createConversation: vi.fn(async () => ({ id: 'conv-new' })),
      submitPrompt: vi.fn(async () => ({ delivery: 'started' })),
      abortConversation: vi.fn(),
      compactConversation: vi.fn(),
      renameConversation: vi.fn(),
      getCurrentModel: vi.fn(() => null),
      setModel: vi.fn(),
      isConversationBusy: vi.fn(() => false),
      callSlackTool: vi.fn(async () => ({ ts: '123.456' })),
      ...overrides,
    };
  }

  it('exposes the fixed Slack MCP OAuth server config', () => {
    expect(SLACK_MCP_SERVER_CONFIG).toMatchObject({
      name: 'slack',
      transport: 'remote',
      url: 'https://mcp.slack.com/mcp',
      callbackPort: 3118,
      callbackPath: '/callback',
      oauthClientInfo: expect.objectContaining({ client_id: '1601185624273.8899143856786' }),
    });
  });

  it('saves channels as disabled chat targets', () => {
    const runtime = new SlackMcpGatewayRuntime(deps() as never);
    runtime.saveChannel({ channelId: ' C123 ', channelLabel: 'General' });

    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        stateRoot: '/state',
        profile: 'shared',
        provider: 'slack_mcp',
        externalChatId: 'C123',
        externalChatLabel: 'General',
        conversationId: '',
        repliesEnabled: false,
      }),
    );
    expect(() => runtime.saveChannel({ channelId: '   ' })).toThrow('Slack channel id required');
  });

  it('attaches a channel to a conversation and activates the gateway', async () => {
    const runtime = new SlackMcpGatewayRuntime(deps() as never);
    vi.spyOn(runtime, 'start').mockImplementation(() => undefined);

    await runtime.attachChannelToConversation({
      conversationId: 'conv-1',
      conversationTitle: 'Title',
      externalChatId: 'C123',
      externalChatLabel: 'General',
    });

    expect(state.upsertGatewayChatTarget).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', externalChatId: 'C123', repliesEnabled: true }),
    );
    expect(state.attachGatewayConversation).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'slack_mcp', conversationId: 'conv-1', externalChatId: 'C123' }),
    );
    expect(state.updateGatewayConnectionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'slack_mcp', status: 'active', enabled: true }),
    );
    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'routing', message: 'Slack MCP attached to General' }),
    );
    expect(runtime.start).toHaveBeenCalledOnce();
  });

  it('delivers assistant replies to bound Slack conversations and records sent timestamps', async () => {
    const d = deps();
    const runtime = new SlackMcpGatewayRuntime(d as never);
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: 'C123', externalChatLabel: 'General' });

    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: ' hello ' })).resolves.toBe(true);

    expect(d.callSlackTool).toHaveBeenCalledWith('slack_send_message', { channel_id: 'C123', message: 'hello' });
    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'outbound', message: 'Delivered assistant reply to General' }),
    );
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: '   ' })).resolves.toBe(false);
    state.findGatewayChatTargetByConversation.mockReturnValueOnce(null);
    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'hello' })).resolves.toBe(false);
  });

  it('marks gateway needs_attention when Slack delivery fails', async () => {
    const d = deps({
      callSlackTool: vi.fn(async () => {
        throw new Error('send failed');
      }),
    });
    const runtime = new SlackMcpGatewayRuntime(d as never);
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: 'C123' });

    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'hello' })).resolves.toBe(false);

    expect(state.updateGatewayConnectionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'needs_attention', statusMessage: 'Slack send failed: send failed' }),
    );
    expect(state.recordGatewayEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', message: 'Slack delivery failed: send failed' }),
    );
  });

  it('uses direct MCP connections when no callSlackTool dependency is provided', async () => {
    const callTool = vi.fn(async () => ({ structuredContent: { ts: '999.000' } }));
    const close = vi.fn(async () => undefined);
    core.connectMcpServerDirect.mockResolvedValueOnce({ callTool, close });
    const d = deps({ callSlackTool: undefined });
    const runtime = new SlackMcpGatewayRuntime(d as never);
    state.findGatewayChatTargetByConversation.mockReturnValueOnce({ externalChatId: 'C123' });

    await expect(runtime.deliverAssistantReply({ conversationId: 'conv-1', text: 'hello' })).resolves.toBe(true);
    expect(core.connectMcpServerDirect).toHaveBeenCalledWith(SLACK_MCP_SERVER_CONFIG, { timeoutMs: 60000 });
    expect(callTool).toHaveBeenCalledWith('slack_send_message', { channel_id: 'C123', message: 'hello' }, 30000);
    runtime.stop();
    await Promise.resolve();
    expect(close).toHaveBeenCalled();
  });
});
