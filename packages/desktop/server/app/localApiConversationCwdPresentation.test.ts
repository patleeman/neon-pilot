import { describe, expect, it } from 'vitest';

import {
  buildChangedConversationCwdResponse,
  buildUnchangedConversationCwdResponse,
  resolvePreviousWorkspaceCwd,
} from './localApiConversationCwdPresentation';

describe('localApiConversationCwdPresentation', () => {
  it('builds changed and unchanged cwd responses', () => {
    expect(buildUnchangedConversationCwdResponse({ id: 'a', sessionFile: '/tmp/a.jsonl', cwd: '/tmp' })).toEqual({
      id: 'a',
      sessionFile: '/tmp/a.jsonl',
      cwd: '/tmp',
      changed: false,
    });
    expect(buildChangedConversationCwdResponse({ id: 'b', sessionFile: '/tmp/b.jsonl', cwd: '/work' })).toEqual({
      id: 'b',
      sessionFile: '/tmp/b.jsonl',
      cwd: '/work',
      changed: true,
    });
  });

  it('resolves previous workspace cwd with explicit null support', () => {
    expect(resolvePreviousWorkspaceCwd({ hasWorkspaceCwd: true, workspaceCwd: null, currentCwd: '/current' })).toBeNull();
    expect(resolvePreviousWorkspaceCwd({ hasWorkspaceCwd: true, workspaceCwd: '/workspace', currentCwd: '/current' })).toBe('/workspace');
    expect(resolvePreviousWorkspaceCwd({ hasWorkspaceCwd: false, currentCwd: '/current' })).toBe('/current');
  });
});
