import { beforeEach, describe, expect, it, vi } from 'vitest';

const piAi = vi.hoisted(() => ({ stream: vi.fn(), streamSimple: vi.fn() }));
const prefs = vi.hoisted(() => ({ readSavedModelPreferences: vi.fn(() => ({ modelRef: 'saved' })) }));
const tiers = vi.hoisted(() => ({ modelSupportsServiceTier: vi.fn(() => true) }));
const extensionHostClient = vi.hoisted(() => ({
  client: {
    resolveModelProfile: vi.fn(async () => ({ kind: 'none' })),
    invokeAction: vi.fn(),
  },
}));
const conversationPrefs = vi.hoisted(() => ({
  readConversationModelPreferenceSnapshot: vi.fn(() => ({ modelRef: 'conversation' })),
  resolveConversationModelPreferenceState: vi.fn(() => ({ currentModel: 'resolved' })),
}));

vi.mock('@earendil-works/pi-ai', () => piAi);
vi.mock('../models/modelPreferences.js', () => prefs);
vi.mock('../models/modelServiceTiers.js', () => tiers);
vi.mock('../extensions/extensionHostClient.js', () => ({ getExtensionHostClient: () => extensionHostClient.client }));
vi.mock('./conversationModelPreferences.js', () => conversationPrefs);

import {
  applyLiveSessionServiceTier,
  buildConversationServiceTierPreferenceInput,
  repairSessionModelProvider,
  resolveConversationPreferenceStateForSession,
} from './liveSessionModels.js';

describe('live session models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extensionHostClient.client.resolveModelProfile.mockResolvedValue({ kind: 'none' });
    extensionHostClient.client.invokeAction.mockResolvedValue({ ok: true, result: {} });
  });

  it('resolves conversation preference state from conversation snapshot, saved preferences, and available models', () => {
    const sessionManager = { buildSessionContext: vi.fn(), getBranch: vi.fn() };
    const availableModels = [{ id: 'm1' }];

    expect(resolveConversationPreferenceStateForSession('/settings.json', sessionManager as never, availableModels as never)).toEqual({
      currentModel: 'resolved',
    });
    expect(conversationPrefs.readConversationModelPreferenceSnapshot).toHaveBeenCalledWith(sessionManager);
    expect(prefs.readSavedModelPreferences).toHaveBeenCalledWith('/settings.json', availableModels);
    expect(conversationPrefs.resolveConversationModelPreferenceState).toHaveBeenCalledWith(
      { modelRef: 'conversation' },
      { modelRef: 'saved' },
      availableModels,
    );
  });

  it('builds service tier preference input only when explicitly set', () => {
    expect(buildConversationServiceTierPreferenceInput({ currentServiceTier: 'auto', hasExplicitServiceTier: false })).toBeUndefined();
    expect(buildConversationServiceTierPreferenceInput({ currentServiceTier: 'flex', hasExplicitServiceTier: true })).toBe('flex');
    expect(buildConversationServiceTierPreferenceInput({ currentServiceTier: '', hasExplicitServiceTier: true })).toBeNull();
  });

  it('applies service-tier-aware streaming with auth, merged headers, reasoning effort, and fallback behavior', async () => {
    const auth = { ok: true, apiKey: 'key', headers: { Authorization: 'Bearer key', 'X-Base': 'base' } };
    const modelRegistry = { find: vi.fn(() => undefined), getApiKeyAndHeaders: vi.fn(async () => auth) };
    const session = { agent: {}, modelRegistry };
    const model = { id: 'model-1', provider: 'provider' };
    const context = [{ role: 'user', content: 'hi' }];

    applyLiveSessionServiceTier(session as never, 'flex');
    await session.agent.streamFn(model, context, { headers: { 'X-Request': 'request' }, reasoning: 'high' });

    expect(piAi.stream).toHaveBeenCalledWith(model, context, {
      apiKey: 'key',
      headers: { Authorization: 'Bearer key', 'X-Base': 'base', 'X-Request': 'request' },
      onPayload: expect.any(Function),
      reasoningEffort: 'high',
      serviceTier: 'flex',
    });

    tiers.modelSupportsServiceTier.mockReturnValueOnce(false);
    await session.agent.streamFn(model, context, { headers: { 'X-Request': 'request' } });
    expect(piAi.streamSimple).toHaveBeenCalledWith(model, context, {
      apiKey: 'key',
      headers: { Authorization: 'Bearer key', 'X-Base': 'base', 'X-Request': 'request' },
      onPayload: expect.any(Function),
    });
  });

  it('throws stream auth errors before calling providers', async () => {
    const session = {
      agent: {},
      modelRegistry: { find: vi.fn(() => undefined), getApiKeyAndHeaders: vi.fn(async () => ({ ok: false, error: 'missing key' })) },
    };
    applyLiveSessionServiceTier(session as never, 'flex');
    await expect(session.agent.streamFn({ id: 'm1' }, [], {})).rejects.toThrow('missing key');
    expect(piAi.stream).not.toHaveBeenCalled();
    expect(piAi.streamSimple).not.toHaveBeenCalled();
  });

  it('streams with the registry canonical model when the session model is stale', async () => {
    const staleModel = { id: 'kimi-k2.6', provider: 'opencode-go', compat: { thinkingFormat: 'deepseek' } };
    const canonicalModel = { id: 'kimi-k2.6', provider: 'opencode-go', compat: { thinkingFormat: 'openai' } };
    const auth = { ok: true, apiKey: 'key' };
    const modelRegistry = {
      find: vi.fn(() => canonicalModel),
      getApiKeyAndHeaders: vi.fn(async () => auth),
    };
    const session = { agent: {}, modelRegistry };
    const context = [{ role: 'user', content: 'hi' }];

    applyLiveSessionServiceTier(session as never, 'flex');
    await session.agent.streamFn(staleModel, context, { reasoning: 'medium' });

    expect(modelRegistry.find).toHaveBeenCalledWith('opencode-go', 'kimi-k2.6');
    expect(modelRegistry.getApiKeyAndHeaders).toHaveBeenCalledWith(canonicalModel);
    expect(piAi.stream).toHaveBeenCalledWith(canonicalModel, context, expect.objectContaining({ reasoningEffort: 'medium' }));
  });

  it('starts a matched model profile runtime before streaming', async () => {
    const auth = { ok: true, apiKey: 'key' };
    const modelRegistry = { find: vi.fn(() => undefined), getApiKeyAndHeaders: vi.fn(async () => auth) };
    const session = { agent: {}, modelRegistry };
    const model = { id: 'deepseek-v4-flash', provider: 'ds4' };
    extensionHostClient.client.resolveModelProfile.mockResolvedValueOnce({
      kind: 'resolved',
      profile: { extensionId: 'system-ds4', id: 'ds4-compatible', startupAction: 'ds4StartServer' },
    });

    applyLiveSessionServiceTier(session as never, 'flex');
    await session.agent.streamFn(model, [], {});

    expect(extensionHostClient.client.invokeAction).toHaveBeenCalledWith({
      extensionId: 'system-ds4',
      actionId: 'ds4StartServer',
      input: { provider: 'ds4', model: 'deepseek-v4-flash' },
    });
    expect(piAi.stream).toHaveBeenCalledWith(model, [], expect.objectContaining({ apiKey: 'key' }));
  });

  it('converts opencode-go Kimi reasoning payloads to thinking-only requests', async () => {
    const auth = { ok: true, apiKey: 'key' };
    const modelRegistry = { find: vi.fn(() => undefined), getApiKeyAndHeaders: vi.fn(async () => auth) };
    const session = { agent: {}, modelRegistry };
    const model = { id: 'kimi-k2.6', provider: 'opencode-go' };
    const onPayload = vi.fn(async (payload) => ({ ...(payload as Record<string, unknown>), caller: true }));

    applyLiveSessionServiceTier(session as never, 'flex');
    await session.agent.streamFn(model, [], { onPayload, reasoning: 'medium' });

    const streamOptions = piAi.stream.mock.calls.at(-1)?.[2] as { onPayload?: (payload: unknown, model: unknown) => Promise<unknown> };
    const outboundPayload = await streamOptions.onPayload?.(
      {
        messages: [{ role: 'user', content: 'hi' }],
        reasoning_effort: 'medium',
      },
      model,
    );

    expect(onPayload).toHaveBeenCalled();
    expect(outboundPayload).toEqual({
      caller: true,
      messages: [{ role: 'user', content: 'hi' }],
      thinking: { type: 'enabled' },
    });
  });

  it('removes duplicate reasoning payload fields for other providers before requests are sent', async () => {
    const auth = { ok: true, apiKey: 'key' };
    const modelRegistry = { find: vi.fn(() => undefined), getApiKeyAndHeaders: vi.fn(async () => auth) };
    const session = { agent: {}, modelRegistry };
    const model = { id: 'model-1', provider: 'openai-compatible' };

    applyLiveSessionServiceTier(session as never, 'flex');
    await session.agent.streamFn(model, [], { reasoning: 'medium' });

    const streamOptions = piAi.stream.mock.calls.at(-1)?.[2] as { onPayload?: (payload: unknown, model: unknown) => Promise<unknown> };
    const outboundPayload = await streamOptions.onPayload?.(
      {
        thinking: { type: 'enabled' },
        reasoning_effort: 'medium',
      },
      model,
    );

    expect(outboundPayload).toEqual({ reasoning_effort: 'medium' });
  });

  it('applies opencode-go Kimi reasoning sanitization to the agent payload hook', async () => {
    const auth = { ok: true, apiKey: 'key' };
    const modelRegistry = { find: vi.fn(() => undefined), getApiKeyAndHeaders: vi.fn(async () => auth) };
    const onPayload = vi.fn(async (payload) => payload);
    const session = { agent: { onPayload }, modelRegistry };
    const model = { id: 'kimi-k2.6', provider: 'opencode-go' };

    applyLiveSessionServiceTier(session as never, 'flex');
    const outboundPayload = await session.agent.onPayload(
      {
        thinking: { type: 'enabled' },
        reasoning_effort: 'medium',
      },
      model,
    );

    expect(onPayload).toHaveBeenCalled();
    expect(outboundPayload).toEqual({ thinking: { type: 'enabled' } });
  });

  it('repairs a model provider only when the current id has a single provider match', async () => {
    const session = {
      model: { id: 'm1', provider: 'old-provider' },
      setModel: vi.fn(async () => undefined),
      sessionManager: { appendModelChange: vi.fn() },
    };

    await repairSessionModelProvider(session as never, [{ id: 'm1', provider: 'new-provider' }] as never);
    expect(session.setModel).toHaveBeenCalledWith({ id: 'm1', provider: 'new-provider' });
    expect(session.sessionManager.appendModelChange).toHaveBeenCalledWith('new-provider', 'm1');

    session.setModel.mockClear();
    await repairSessionModelProvider(
      { ...session, model: { id: 'm2', provider: 'provider' } } as never,
      [{ id: 'm2', provider: 'provider' }] as never,
    );
    await repairSessionModelProvider(
      { ...session, model: { id: 'm3', provider: 'old' } } as never,
      [
        { id: 'm3', provider: 'a' },
        { id: 'm3', provider: 'b' },
      ] as never,
    );
    await repairSessionModelProvider({ ...session, model: undefined } as never, [{ id: 'm4', provider: 'a' }] as never);
    expect(session.setModel).not.toHaveBeenCalled();
  });
});
