import { describe, expect, it } from 'vitest';

import {
  beginWorkspaceDirectoryRequest,
  createWorkspaceDirectoryRequestLifecycle,
  invalidateWorkspaceDirectoryRequest,
  isWorkspaceDirectoryRequestCurrent,
  resetWorkspaceDirectoryRequestLifecycle,
} from './workspaceRequestLifecycle';

describe('workspace request lifecycle', () => {
  it('tracks the latest request per directory path', () => {
    const lifecycle = createWorkspaceDirectoryRequestLifecycle();
    const first = beginWorkspaceDirectoryRequest(lifecycle, 'src');
    const second = beginWorkspaceDirectoryRequest(lifecycle, 'src');

    expect(isWorkspaceDirectoryRequestCurrent(lifecycle, first)).toBe(false);
    expect(isWorkspaceDirectoryRequestCurrent(lifecycle, second)).toBe(true);
  });

  it('keeps independent request ids per directory path', () => {
    const lifecycle = createWorkspaceDirectoryRequestLifecycle();
    const src = beginWorkspaceDirectoryRequest(lifecycle, 'src');
    const docs = beginWorkspaceDirectoryRequest(lifecycle, 'docs');

    expect(isWorkspaceDirectoryRequestCurrent(lifecycle, src)).toBe(true);
    expect(isWorkspaceDirectoryRequestCurrent(lifecycle, docs)).toBe(true);
  });

  it('invalidates a path when the directory is collapsed', () => {
    const lifecycle = createWorkspaceDirectoryRequestLifecycle();
    const request = beginWorkspaceDirectoryRequest(lifecycle, 'src');

    invalidateWorkspaceDirectoryRequest(lifecycle, 'src');

    expect(isWorkspaceDirectoryRequestCurrent(lifecycle, request)).toBe(false);
  });

  it('invalidates all pending directory requests across workspace changes', () => {
    const lifecycle = createWorkspaceDirectoryRequestLifecycle();
    const request = beginWorkspaceDirectoryRequest(lifecycle, 'src');

    resetWorkspaceDirectoryRequestLifecycle(lifecycle);

    expect(isWorkspaceDirectoryRequestCurrent(lifecycle, request)).toBe(false);
  });
});
