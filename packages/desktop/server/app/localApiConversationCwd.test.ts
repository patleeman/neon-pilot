import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { assertDesktopConversationCwdDirectory, resolveDesktopConversationNextCwd } from './localApiConversationCwd';

describe('localApiConversationCwd', () => {
  it('resolves requested cwd relative to the current cwd', () => {
    const resolveRequestedCwd = vi.fn(() => '/repo/next');
    expect(
      resolveDesktopConversationNextCwd({
        cwd: '../next',
        currentCwd: '/repo/current',
        runtimeScope: 'shared',
        resolveNeutralChatCwd: vi.fn(),
        resolveRequestedCwd,
      }),
    ).toEqual({ nextCwd: '/repo/next', nextWorkspaceCwd: '/repo/next', movingToNeutralChats: false });
    expect(resolveRequestedCwd).toHaveBeenCalledWith('../next', '/repo/current');
  });

  it('resolves neutral chat cwd when workspace cwd is explicitly null', () => {
    const resolveNeutralChatCwd = vi.fn(() => '/neutral/shared');
    expect(
      resolveDesktopConversationNextCwd({
        cwd: '/ignored',
        workspaceCwd: null,
        currentCwd: '/repo/current',
        runtimeScope: 'shared',
        resolveNeutralChatCwd,
        resolveRequestedCwd: vi.fn(),
      }),
    ).toEqual({ nextCwd: '/neutral/shared', nextWorkspaceCwd: null, movingToNeutralChats: true });
    expect(resolveNeutralChatCwd).toHaveBeenCalledWith('shared');
  });

  it('requires a resolvable cwd', () => {
    expect(() =>
      resolveDesktopConversationNextCwd({
        cwd: ' ',
        currentCwd: '/repo/current',
        runtimeScope: 'shared',
        resolveNeutralChatCwd: vi.fn(),
        resolveRequestedCwd: vi.fn(() => undefined),
      }),
    ).toThrow('Choose a working directory.');
  });

  it('maps resolver validation errors to user-facing cwd errors', () => {
    expect(() =>
      resolveDesktopConversationNextCwd({
        cwd: './missing',
        currentCwd: '/repo/current',
        runtimeScope: 'shared',
        resolveNeutralChatCwd: vi.fn(),
        resolveRequestedCwd: vi.fn(() => {
          throw new Error('Directory does not exist: /repo/missing');
        }),
      }),
    ).toThrow('Choose an existing folder. /repo/missing could not be found.');

    expect(() =>
      resolveDesktopConversationNextCwd({
        cwd: './file.txt',
        currentCwd: '/repo/current',
        runtimeScope: 'shared',
        resolveNeutralChatCwd: vi.fn(),
        resolveRequestedCwd: vi.fn(() => {
          throw new Error('Not a directory: /repo/file.txt');
        }),
      }),
    ).toThrow('Choose a folder, not a file. /repo/file.txt is not a folder.');
  });

  it('asserts cwd exists and is a directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-local-api-cwd-'));
    const filePath = join(root, 'file.txt');
    writeFileSync(filePath, 'file');
    const dirPath = join(root, 'dir');
    mkdirSync(dirPath);

    expect(() => assertDesktopConversationCwdDirectory(dirPath)).not.toThrow();
    expect(() => assertDesktopConversationCwdDirectory(join(root, 'missing'))).toThrow('Choose an existing folder.');
    expect(() => assertDesktopConversationCwdDirectory(filePath)).toThrow('Choose a folder, not a file.');
  });
});
