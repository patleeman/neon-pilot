import { describe, expect, it } from 'vitest';

import { isNeutralChatWorkspaceCwd, readLegacyToolWorkspaceMetadata } from './sessionWorkspaceMetadata';

describe('sessionWorkspaceMetadata', () => {
  it('detects neutral chat workspace cwd paths', () => {
    expect(isNeutralChatWorkspaceCwd({ cwd: '/runtime/chat-workspaces', runtimeDir: '/runtime' })).toBe(true);
    expect(isNeutralChatWorkspaceCwd({ cwd: '/runtime/chat-workspaces/thread-1', runtimeDir: '/runtime' })).toBe(true);
    expect(isNeutralChatWorkspaceCwd({ cwd: '/runtime/other', runtimeDir: '/runtime' })).toBe(false);
    expect(isNeutralChatWorkspaceCwd({ cwd: '   ', runtimeDir: '/runtime' })).toBe(false);
  });

  it('reads queued workspace metadata from legacy tool result messages', () => {
    expect(
      readLegacyToolWorkspaceMetadata({
        role: 'toolResult',
        toolName: 'change_working_directory',
        details: { action: 'queue', queued: true, cwd: ' /repo ' },
      }),
    ).toEqual({ cwd: '/repo', workspaceCwd: '/repo' });
    expect(
      readLegacyToolWorkspaceMetadata({
        role: 'toolResult',
        toolName: 'conversation',
        details: { action: 'queue', queued: true, cwd: '/repo' },
      }),
    ).toEqual({ cwd: '/repo', workspaceCwd: '/repo' });
    expect(readLegacyToolWorkspaceMetadata({ role: 'assistant', toolName: 'conversation', details: {} })).toBeNull();
    expect(readLegacyToolWorkspaceMetadata({ role: 'toolResult', toolName: 'other', details: {} })).toBeNull();
    expect(
      readLegacyToolWorkspaceMetadata({
        role: 'toolResult',
        toolName: 'conversation',
        details: { action: 'queue', queued: false, cwd: '/repo' },
      }),
    ).toBeNull();
  });
});
