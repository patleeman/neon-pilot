import { describe, expect, it } from 'vitest';

import {
  normalizeOptionalPath,
  normalizeWorkspaceCwdValue,
  readConversationOffshootMetadata,
  readConversationWorkspaceMetadata,
} from './sessionCustomMetadata';

describe('sessionCustomMetadata', () => {
  it('normalizes optional paths and workspace cwd values', () => {
    expect(normalizeOptionalPath(' /tmp/project ')).toBe('/tmp/project');
    expect(normalizeOptionalPath('   ')).toBeUndefined();
    expect(normalizeWorkspaceCwdValue(null)).toBeNull();
    expect(normalizeWorkspaceCwdValue(' /tmp/ws ')).toBe('/tmp/ws');
    expect(normalizeWorkspaceCwdValue(123)).toBeUndefined();
  });

  it('reads conversation workspace metadata', () => {
    expect(
      readConversationWorkspaceMetadata({ customType: 'workspace', data: { cwd: ' /repo ', workspaceCwd: null } }, 'workspace'),
    ).toEqual({ cwd: '/repo', workspaceCwd: null });
    expect(readConversationWorkspaceMetadata({ customType: 'other', data: { cwd: '/repo' } }, 'workspace')).toBeNull();
    expect(readConversationWorkspaceMetadata({ customType: 'workspace', data: {} }, 'workspace')).toBeNull();
  });

  it('reads detached and typed offshoot metadata', () => {
    expect(readConversationOffshootMetadata({ customType: 'offshoot', data: { detached: true } }, 'offshoot')).toEqual({ detached: true });
    expect(
      readConversationOffshootMetadata(
        {
          customType: 'offshoot',
          timestamp: ' now ',
          data: {
            kind: ' fork ',
            parentSessionFile: ' /sessions/a.jsonl ',
            parentSessionId: ' parent ',
            parentMessageId: ' msg ',
            sourceRunId: ' run ',
          },
        },
        'offshoot',
      ),
    ).toEqual({
      kind: 'fork',
      timestamp: 'now',
      parentSessionFile: '/sessions/a.jsonl',
      parentSessionId: 'parent',
      parentMessageId: 'msg',
      sourceRunId: 'run',
    });
    expect(readConversationOffshootMetadata({ customType: 'offshoot', data: { kind: 'bad' } }, 'offshoot')).toBeNull();
  });
});
