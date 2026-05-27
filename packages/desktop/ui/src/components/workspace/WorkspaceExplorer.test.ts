// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  workspaceFile: vi.fn(),
  workspaceDiff: vi.fn(),
}));

vi.mock('../../client/api', () => ({
  api: apiMocks,
}));

vi.mock('../../ui-state/theme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value?: string }) =>
    React.createElement('textarea', { 'aria-label': 'mock editor', readOnly: true, value: value ?? '' }),
}));

import { formatWorkspaceEntrySize, WorkspaceFileDocument } from './WorkspaceExplorer.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function file(path: string, content: string) {
  return {
    path,
    name: path.split('/').pop() ?? path,
    content,
    binary: false,
    tooLarge: false,
    size: content.length,
    mime: 'text/plain',
    gitStatus: null,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('formatWorkspaceEntrySize', () => {
  afterEach(() => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      act(() => root?.unmount());
    }
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('formats normal file sizes', () => {
    expect(formatWorkspaceEntrySize(42)).toBe('42 B');
    expect(formatWorkspaceEntrySize(2048)).toBe('2 KB');
    expect(formatWorkspaceEntrySize(1_572_864)).toBe('1.5 MB');
  });

  it('omits unsafe file sizes', () => {
    expect(formatWorkspaceEntrySize(Number.MAX_SAFE_INTEGER + 1)).toBe('');
    expect(formatWorkspaceEntrySize(1.5)).toBe('');
  });

  it('ignores stale file loads after switching paths', async () => {
    const a = deferred<ReturnType<typeof file>>();
    const b = deferred<ReturnType<typeof file>>();
    apiMocks.workspaceFile.mockImplementation((_cwd: string, path: string) => (path === 'a.ts' ? a.promise : b.promise));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(React.createElement(WorkspaceFileDocument, { cwd: '/repo', path: 'a.ts' }));
    });
    act(() => {
      root.render(React.createElement(WorkspaceFileDocument, { cwd: '/repo', path: 'b.ts' }));
    });

    await act(async () => {
      b.resolve(file('b.ts', 'current file'));
      await b.promise;
    });
    await flush();
    expect(container.textContent).toContain('b.ts');
    await vi.waitFor(() => {
      expect((container.querySelector('textarea') as HTMLTextAreaElement | null)?.value).toBe('current file');
    });

    await act(async () => {
      a.resolve(file('a.ts', 'stale file'));
      await a.promise;
    });
    await flush();

    expect(container.textContent).toContain('b.ts');
    expect(container.textContent).not.toContain('a.ts');
    await vi.waitFor(() => {
      expect((container.querySelector('textarea') as HTMLTextAreaElement | null)?.value).toBe('current file');
    });
  });
});
