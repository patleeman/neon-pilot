import { describe, expect, it } from 'vitest';

import { buildForkConversationInitialOptions, resolveForkConversationCwd } from './localApiForkConversation';

describe('localApiForkConversation', () => {
  it('resolves requested cwd with source fallback', () => {
    expect(resolveForkConversationCwd({ requestedCwd: ' /next ', sourceCwd: '/source' })).toBe('/next');
    expect(resolveForkConversationCwd({ requestedCwd: '  ', sourceCwd: '/source' })).toBe('/source');
    expect(resolveForkConversationCwd({ requestedCwd: null, sourceCwd: '/source' })).toBe('/source');
  });

  it('builds initial session options preserving explicit nulls', () => {
    expect(buildForkConversationInitialOptions({ model: 'm1', thinkingLevel: null })).toEqual({
      initialModel: 'm1',
      initialThinkingLevel: null,
    });
    expect(buildForkConversationInitialOptions({})).toEqual({});
  });
});
