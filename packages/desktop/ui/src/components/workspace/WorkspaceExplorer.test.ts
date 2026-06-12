// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  workspaceTree: vi.fn(),
  workspaceFile: vi.fn(),
  workspaceDiff: vi.fn(),
}));

const commandContextMocks = vi.hoisted(() => ({
  setExtensionCommandContext: vi.fn(),
}));

const eventSources = vi.hoisted(() => [] as FakeEventSource[]);

class FakeEventSource {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  close(): void {
    this.closed = true;
  }

  send(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

vi.mock('../../client/api', () => ({
  api: apiMocks,
}));

vi.mock('../../desktop/desktopEventSource', () => ({
  createDesktopAwareEventSource: vi.fn(() => {
    const source = new FakeEventSource();
    eventSources.push(source);
    return source;
  }),
}));

vi.mock('../../extensions/commands', () => ({
  setExtensionCommandContext: commandContextMocks.setExtensionCommandContext,
}));

vi.mock('../../ui-state/theme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('./WorkspaceCodeEditor', () => ({
  WorkspaceCodeEditor: ({ value }: { value?: string }) =>
    React.createElement('textarea', { 'aria-label': 'mock editor', readOnly: true, value: value ?? '' }),
}));

vi.mock('@pierre/trees/react', () => ({
  FileTree: () => React.createElement('div', { 'data-testid': 'mock-file-tree' }),
}));

vi.mock('../shared/useFileTreeModel', () => ({
  useFileTreeModel: () => ({
    model: {
      subscribe: () => () => undefined,
      getItem: () => null,
      startRenaming: () => undefined,
    },
    resetTree: () => undefined,
    nativeContextMenuOpenRef: { current: null },
  }),
}));

import { formatWorkspaceEntrySize, WorkspaceExplorer, WorkspaceFileDocument } from './WorkspaceExplorer.js';

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

function file(path: string, content: string, options?: { gitStatus?: string | null }) {
  return {
    path,
    name: path.split('/').pop() ?? path,
    content,
    binary: false,
    tooLarge: false,
    size: content.length,
    mime: 'text/plain',
    gitStatus: options?.gitStatus ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    eventSources.length = 0;
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
    await vi.waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe('current file');
    });

    await act(async () => {
      a.resolve(file('a.ts', 'stale file'));
      await a.promise;
    });

    await vi.waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe('current file');
    });
  });

  it('publishes diff toggle command availability from the active file', async () => {
    const plain = deferred<ReturnType<typeof file>>();
    apiMocks.workspaceFile.mockReturnValueOnce(plain.promise);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(React.createElement(WorkspaceFileDocument, { cwd: '/repo', path: 'plain.ts' }));
    });

    await act(async () => {
      plain.resolve(file('plain.ts', 'plain file'));
      await plain.promise;
    });

    await vi.waitFor(() => {
      expect(commandContextMocks.setExtensionCommandContext).toHaveBeenCalledWith('workbench.canToggleDiff', false);
    });

    commandContextMocks.setExtensionCommandContext.mockClear();
    const changed = deferred<ReturnType<typeof file>>();
    const diff = deferred<{ addedLines: never[]; deletedBlocks: never[] }>();
    apiMocks.workspaceFile.mockReturnValueOnce(changed.promise);
    apiMocks.workspaceDiff.mockReturnValueOnce(diff.promise);

    act(() => {
      root.render(React.createElement(WorkspaceFileDocument, { cwd: '/repo', path: 'changed.ts' }));
    });

    await act(async () => {
      changed.resolve(file('changed.ts', 'changed file', { gitStatus: 'modified' }));
      await changed.promise;
    });
    await act(async () => {
      diff.resolve({ addedLines: [], deletedBlocks: [] });
      await diff.promise;
    });

    await vi.waitFor(() => {
      expect(commandContextMocks.setExtensionCommandContext).toHaveBeenCalledWith('workbench.canToggleDiff', true);
    });
  });

  it('ignores late workspace watcher callbacks after unmount', async () => {
    vi.useFakeTimers();
    apiMocks.workspaceTree.mockResolvedValue({
      root: '/repo',
      rootName: 'repo',
      rootKind: 'git',
      branch: 'main',
      changes: [],
      entries: [],
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(
        React.createElement(WorkspaceExplorer, {
          cwd: '/repo',
          railOnly: true,
          onDraftPrompt: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(eventSources).toHaveLength(1);
    expect(apiMocks.workspaceTree).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });

    expect(eventSources[0]?.closed).toBe(true);

    act(() => {
      eventSources[0]?.send({ type: 'workspace' });
      eventSources[0]?.onerror?.(new Event('error'));
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(apiMocks.workspaceTree).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
