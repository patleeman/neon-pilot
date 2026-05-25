import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pickFolderMock } = vi.hoisted(() => ({
  pickFolderMock: vi.fn(),
}));

vi.mock('./folderPicker.js', () => ({
  pickFolder: pickFolderMock,
}));

import { pickFolderCapability } from './workspaceDesktopCapability.js';

beforeEach(() => {
  pickFolderMock.mockReset();
  pickFolderMock.mockReturnValue({ path: '/workspace/selected', cancelled: false });
});

describe('workspaceDesktopCapability', () => {
  it('picks folders using resolved cwd fallback rules', () => {
    const context = {
      getDefaultWebCwd: () => '/workspace/default',
      resolveRequestedCwd: vi.fn(() => '/workspace/resolved'),
    };

    expect(pickFolderCapability({ cwd: '~/repo' }, context)).toEqual({ path: '/workspace/selected', cancelled: false });
    expect(context.resolveRequestedCwd).toHaveBeenCalledWith('~/repo', '/workspace/default');
    expect(pickFolderMock).toHaveBeenCalledWith({
      initialDirectory: '/workspace/resolved',
      prompt: 'Choose working directory',
    });
  });

  it('falls back to the default cwd when requested cwd does not resolve', () => {
    const context = {
      getDefaultWebCwd: () => '/workspace/default',
      resolveRequestedCwd: vi.fn(() => undefined),
    };

    expect(pickFolderCapability({}, context)).toEqual({ path: '/workspace/selected', cancelled: false });
    expect(pickFolderMock).toHaveBeenCalledWith({
      initialDirectory: '/workspace/default',
      prompt: 'Choose working directory',
    });
  });
});
