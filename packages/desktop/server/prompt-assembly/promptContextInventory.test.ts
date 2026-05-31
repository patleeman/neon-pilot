import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionHostClient = vi.hoisted(() => ({ invokeAction: vi.fn() }));
const registry = vi.hoisted(() => ({ listExtensionPromptContextProviderRegistrations: vi.fn(() => []) }));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
}));
vi.mock('../extensions/extensionRegistry.js', () => registry);

import { buildPromptContextPlan } from './promptContextInventory.js';

describe('prompt context inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.listExtensionPromptContextProviderRegistrations.mockReturnValue([]);
  });

  it('returns existing context messages when no providers are registered', async () => {
    await expect(
      buildPromptContextPlan({
        prompt: 'hello',
        conversationId: 'conv-1',
        contextMessages: [{ customType: 'existing', content: 'keep me' }],
      }),
    ).resolves.toEqual({ blocks: [], contextMessages: [{ customType: 'existing', content: 'keep me' }], diagnostics: [] });
  });

  it('skips providers for plain prompts without explicit context or related sessions', async () => {
    registry.listExtensionPromptContextProviderRegistrations.mockReturnValue([
      { extensionId: 'ext', id: 'provider', handler: 'provideContext', title: 'Provider Title' },
    ]);

    const plan = await buildPromptContextPlan({ prompt: 'hello', conversationId: 'conv-1' });

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(plan).toEqual({ blocks: [], contextMessages: [], diagnostics: [] });
  });

  it('invokes providers and normalizes blocks into extension turn context messages', async () => {
    registry.listExtensionPromptContextProviderRegistrations.mockReturnValue([
      { extensionId: 'ext', id: 'provider', handler: 'provideContext', title: 'Provider Title' },
    ]);
    extensionHostClient.invokeAction.mockResolvedValueOnce({
      ok: true,
      result: {
        contextMessages: [{ customType: 'raw', content: 'raw context' }],
        blocks: [
          { id: ' block-id ', title: ' Block Title ', content: ' block content ', visibility: 'debug' },
          { content: 'fallback title content' },
          { id: 'empty', title: 'Empty', content: '   ' },
        ],
        warnings: ['heads up'],
      },
    });

    const plan = await buildPromptContextPlan({
      prompt: 'summarize',
      conversationId: 'conv-1',
      currentCwd: '/repo',
      selectedSessionIds: ['conv-2'],
      contextMessages: [{ customType: 'existing', content: 'keep me' }],
    });

    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith({
      extensionId: 'ext',
      actionId: 'provideContext',
      input: {
        prompt: 'summarize',
        conversationId: 'conv-1',
        currentCwd: '/repo',
        relatedConversationIds: ['conv-2'],
      },
    });
    expect(plan.blocks).toEqual([
      { id: 'block-id', providerId: 'ext/provider', title: 'Block Title', content: 'block content', visibility: 'debug' },
      {
        id: 'ext/provider:1',
        providerId: 'ext/provider',
        title: 'Provider Title',
        content: 'fallback title content',
        visibility: undefined,
      },
    ]);
    expect(plan.contextMessages).toEqual([
      { customType: 'existing', content: 'keep me' },
      { customType: 'raw', content: 'raw context' },
      { customType: 'extension_turn_context', content: 'Block Title:\nblock content' },
      { customType: 'extension_turn_context', content: 'Provider Title:\nfallback title content' },
    ]);
    expect(plan.diagnostics).toEqual([
      { severity: 'warning', code: 'prompt-context-provider-warning', message: 'heads up', sourceId: 'ext/provider' },
    ]);
  });

  it('records diagnostics for failed provider results and thrown provider errors', async () => {
    registry.listExtensionPromptContextProviderRegistrations.mockReturnValue([
      { extensionId: 'ext', id: 'failed', handler: 'failed', title: 'Failed Provider' },
      { extensionId: 'ext', id: 'throws', handler: 'throws' },
    ]);
    extensionHostClient.invokeAction.mockResolvedValueOnce({ ok: false, error: 'bad' }).mockRejectedValueOnce(new Error('boom'));

    const plan = await buildPromptContextPlan({ prompt: 'hello', conversationId: 'conv-1', selectedSessionIds: ['related-1'] });

    expect(plan.blocks).toEqual([]);
    expect(plan.contextMessages).toEqual([]);
    expect(plan.diagnostics).toEqual([
      {
        severity: 'warning',
        code: 'prompt-context-provider-failed',
        message: 'Failed Provider context failed; sent without it.',
        sourceId: 'ext/failed',
      },
      { severity: 'warning', code: 'prompt-context-provider-error', message: 'boom', sourceId: 'ext/throws' },
    ]);
  });
});
