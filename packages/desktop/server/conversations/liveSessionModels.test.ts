import { beforeEach, describe, expect, it, vi } from 'vitest';

const piAi = vi.hoisted(() => ({ stream: vi.fn(), streamSimple: vi.fn() }));
const prefs = vi.hoisted(() => ({ readSavedModelPreferences: vi.fn(() => ({ modelRef: 'saved' })) }));
const tiers = vi.hoisted(() => ({ modelSupportsServiceTier: vi.fn(() => true) }));
const conversationPrefs = vi.hoisted(() => ({
  readConversationModelPreferenceSnapshot: vi.fn(() => ({ modelRef: 'conversation' })),
  resolveConversationModelPreferenceState: vi.fn(() => ({ currentModel: 'resolved' })),
}));

vi.mock('@earendil-works/pi-ai', () => piAi);
vi.mock('../models/modelPreferences.js', () => prefs);
vi.mock('../models/modelServiceTiers.js', () => tiers);
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
    const modelRegistry = { getApiKeyAndHeaders: vi.fn(async () => auth) };
    const session = { agent: {}, modelRegistry };
    const model = { id: 'model-1', provider: 'provider' };
    const context = [{ role: 'user', content: 'hi' }];

    applyLiveSessionServiceTier(session as never, 'flex');
    await session.agent.streamFn(model, context, { headers: { 'X-Request': 'request' }, reasoning: 'high' });

    expect(piAi.stream).toHaveBeenCalledWith(model, context, {
      apiKey: 'key',
      headers: { Authorization: 'Bearer key', 'X-Base': 'base', 'X-Request': 'request' },
      reasoningEffort: 'high',
      serviceTier: 'flex',
    });

    tiers.modelSupportsServiceTier.mockReturnValueOnce(false);
    await session.agent.streamFn(model, context, { headers: { 'X-Request': 'request' } });
    expect(piAi.streamSimple).toHaveBeenCalledWith(model, context, {
      apiKey: 'key',
      headers: { Authorization: 'Bearer key', 'X-Base': 'base', 'X-Request': 'request' },
    });
  });

  it('throws stream auth errors before calling providers', async () => {
    const session = { agent: {}, modelRegistry: { getApiKeyAndHeaders: vi.fn(async () => ({ ok: false, error: 'missing key' })) } };
    applyLiveSessionServiceTier(session as never, 'flex');
    await expect(session.agent.streamFn({ id: 'm1' }, [], {})).rejects.toThrow('missing key');
    expect(piAi.stream).not.toHaveBeenCalled();
    expect(piAi.streamSimple).not.toHaveBeenCalled();
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
