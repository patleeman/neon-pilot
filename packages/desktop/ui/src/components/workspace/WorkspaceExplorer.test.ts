// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  workspaceTree: vi.fn(),
  workspaceFile: vi.fn(),
  workspaceDiff: vi.fn(),
  writeWorkspaceFile: vi.fn(),
  createWorkspaceFile: vi.fn(),
  createWorkspaceFolder: vi.fn(),
  moveWorkspacePath: vi.fn(),
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
  WorkspaceCodeEditor: ({ value, editable, onChange }: { value?: string; editable?: boolean; onChange?: (value: string) => void }) =>
    React.createElement('textarea', {
      'aria-label': 'mock editor',
      readOnly: !editable,
      value: value ?? '',
      onChange: (event: Event) => onChange?.((event.target as HTMLTextAreaElement).value),
    }),
}));

vi.mock('@pierre/trees/react', () => ({
  FileTree: ({ renderContextMenu }: { renderContextMenu?: (item: { path: string }, context: { close: () => void }) => React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'mock-file-tree' }, renderContextMenu?.({ path: 'tmp/' }, { close: () => undefined })),
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

function setTextAreaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
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

  it('does not render internal workspace tree route failures in the file explorer', async () => {
    apiMocks.workspaceTree.mockRejectedValue(
      new Error(
        [
          'Error: Local API route did not complete for GET /api/workspace/tree at Module.ep',
          '(file:///Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/localApi.js:132:20)',
        ].join('\n'),
      ),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(React.createElement(WorkspaceExplorer, { cwd: '/repo', onDraftPrompt: () => undefined }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Could not load the workspace file tree. Refresh the workspace or reopen the conversation.');
    });
    expect(container.textContent).toContain('Workspace unavailable');
    expect(container.textContent).not.toContain('/api/workspace/tree');
    expect(container.textContent).not.toContain('localApi.js');
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

  it('publishes diff toolbar state without rendering the old text toggle', async () => {
    const changed = deferred<ReturnType<typeof file>>();
    const diff = deferred<{ addedLines: never[]; deletedBlocks: never[] }>();
    apiMocks.workspaceFile.mockReturnValueOnce(changed.promise);
    apiMocks.workspaceDiff.mockReturnValueOnce(diff.promise);
    const diffStates: unknown[] = [];
    const listener = (event: Event) => {
      diffStates.push((event as CustomEvent<unknown>).detail);
    };
    window.addEventListener('pa:workbench-diff-state', listener);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

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
      expect(diffStates).toContainEqual({ cwd: '/repo', path: 'changed.ts', canToggleDiff: true, diffEnabled: true });
    });
    expect(container.textContent).not.toContain('Diff on');
    expect(container.textContent).not.toContain('Diff off');
    window.removeEventListener('pa:workbench-diff-state', listener);
  });

  it('ignores stale auto-save completions after switching files', async () => {
    vi.useFakeTimers();
    const fileA = deferred<ReturnType<typeof file>>();
    const fileB = deferred<ReturnType<typeof file>>();
    const saveA = deferred<ReturnType<typeof file>>();
    const diffB = deferred<{ addedLines: never[]; deletedBlocks: never[] }>();

    apiMocks.workspaceFile.mockImplementation((_cwd: string, path: string) => {
      if (path === 'a.ts') {
        return fileA.promise;
      }
      if (path === 'b.ts') {
        return fileB.promise;
      }
      throw new Error(`unexpected file ${path}`);
    });
    apiMocks.workspaceDiff.mockImplementation((_cwd: string, path: string) => {
      if (path === 'b.ts') {
        return diffB.promise;
      }
      throw new Error(`unexpected diff ${path}`);
    });
    apiMocks.writeWorkspaceFile.mockImplementation((_cwd: string, path: string) => {
      if (path === 'a.ts') {
        return saveA.promise;
      }
      throw new Error(`unexpected write ${path}`);
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(React.createElement(WorkspaceFileDocument, { cwd: '/repo', path: 'a.ts' }));
    });

    await act(async () => {
      fileA.resolve(file('a.ts', 'original a'));
      await fileA.promise;
    });

    await vi.waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe('original a');
      expect(textarea?.readOnly).toBe(false);
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    act(() => {
      setTextAreaValue(textarea, 'edited a');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    await vi.waitFor(() => {
      expect(apiMocks.writeWorkspaceFile).toHaveBeenCalledWith('/repo', 'a.ts', 'edited a');
    });

    act(() => {
      root.render(React.createElement(WorkspaceFileDocument, { cwd: '/repo', path: 'b.ts' }));
    });

    await act(async () => {
      fileB.resolve(file('b.ts', 'current b', { gitStatus: 'modified' }));
      await fileB.promise;
    });
    await act(async () => {
      diffB.resolve({ addedLines: [], deletedBlocks: [] });
      await diffB.promise;
    });

    await vi.waitFor(() => {
      const current = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(current?.value).toBe('current b');
    });

    await act(async () => {
      saveA.resolve(file('a.ts', 'saved stale a'));
      await saveA.promise;
    });

    await vi.waitFor(() => {
      const current = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(current?.value).toBe('current b');
    });
    vi.useRealTimers();
  });

  it('ignores stale workspace explorer file loads after selecting a different file', async () => {
    const tree = deferred<{
      root: string;
      rootName: string;
      rootKind: 'git';
      branch: string;
      changes: never[];
      entries: Array<{ path: string; name: string; kind: 'file'; size: number; gitStatus: null; descendantGitStatusCount: null }>;
    }>();
    const fileA = deferred<ReturnType<typeof file>>();
    const fileB = deferred<ReturnType<typeof file>>();
    apiMocks.workspaceTree.mockReturnValue(tree.promise);
    apiMocks.workspaceFile.mockImplementation((_cwd: string, path: string) => {
      if (path === 'a.ts') {
        return fileA.promise;
      }
      if (path === 'b.ts') {
        return fileB.promise;
      }
      throw new Error(`unexpected file ${path}`);
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(React.createElement(WorkspaceExplorer, { cwd: '/repo', onDraftPrompt: () => undefined }));
    });

    await act(async () => {
      tree.resolve({
        root: '/repo',
        rootName: 'repo',
        rootKind: 'git',
        branch: 'main',
        changes: [],
        entries: [
          { path: 'a.ts', name: 'a.ts', kind: 'file', size: 1, gitStatus: null, descendantGitStatusCount: null },
          { path: 'b.ts', name: 'b.ts', kind: 'file', size: 1, gitStatus: null, descendantGitStatusCount: null },
        ],
      });
      await tree.promise;
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('a.ts');
      expect(container.textContent).toContain('b.ts');
    });

    const rows = [...container.querySelectorAll('[role="button"]')];
    const aRow = rows.find((node) => node.textContent?.includes('a.ts'));
    const bRow = rows.find((node) => node.textContent?.includes('b.ts'));
    expect(aRow).toBeTruthy();
    expect(bRow).toBeTruthy();

    act(() => {
      aRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      bRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      fileB.resolve(file('b.ts', 'current b'));
      await fileB.promise;
    });

    await vi.waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe('current b');
    });

    await act(async () => {
      fileA.resolve(file('a.ts', 'stale a'));
      await fileA.promise;
    });

    await vi.waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe('current b');
      expect(container.textContent).toContain('b.ts');
    });
  });

  it('ignores stale directory loads after switching workspaces', async () => {
    const rootA = deferred<{
      root: string;
      rootName: string;
      rootKind: 'git';
      branch: string;
      changes: never[];
      entries: Array<{ path: 'src'; name: 'src'; kind: 'directory'; size: null; gitStatus: null; descendantGitStatusCount: null }>;
    }>();
    const dirA = deferred<{
      root: string;
      rootName: string;
      rootKind: 'git';
      branch: string;
      changes: never[];
      entries: Array<{ path: 'src/old.ts'; name: 'old.ts'; kind: 'file'; size: 1; gitStatus: null; descendantGitStatusCount: null }>;
    }>();
    const rootB = deferred<{
      root: string;
      rootName: string;
      rootKind: 'git';
      branch: string;
      changes: never[];
      entries: Array<{ path: 'src'; name: 'src'; kind: 'directory'; size: null; gitStatus: null; descendantGitStatusCount: null }>;
    }>();
    apiMocks.workspaceTree.mockImplementation((cwd: string, path: string) => {
      if (cwd === '/repo-a' && path === '') {
        return rootA.promise;
      }
      if (cwd === '/repo-a' && path === 'src') {
        return dirA.promise;
      }
      if (cwd === '/repo-b' && path === '') {
        return rootB.promise;
      }
      throw new Error(`unexpected tree ${cwd}:${path}`);
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(React.createElement(WorkspaceExplorer, { cwd: '/repo-a', onDraftPrompt: () => undefined }));
    });

    await act(async () => {
      rootA.resolve({
        root: '/repo-a',
        rootName: 'repo-a',
        rootKind: 'git',
        branch: 'main',
        changes: [],
        entries: [{ path: 'src', name: 'src', kind: 'directory', size: null, gitStatus: null, descendantGitStatusCount: null }],
      });
      await rootA.promise;
    });

    const repoARow = await vi.waitFor(() => {
      const row = [...container.querySelectorAll('[role="button"]')].find((node) => node.textContent?.includes('src'));
      expect(row).toBeTruthy();
      return row as HTMLElement;
    });

    act(() => {
      repoARow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    act(() => {
      root.render(React.createElement(WorkspaceExplorer, { cwd: '/repo-b', onDraftPrompt: () => undefined }));
    });

    await act(async () => {
      rootB.resolve({
        root: '/repo-b',
        rootName: 'repo-b',
        rootKind: 'git',
        branch: 'main',
        changes: [],
        entries: [{ path: 'src', name: 'src', kind: 'directory', size: null, gitStatus: null, descendantGitStatusCount: null }],
      });
      await rootB.promise;
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('repo-b');
      expect(container.textContent).toContain('src');
    });

    await act(async () => {
      dirA.resolve({
        root: '/repo-a',
        rootName: 'repo-a',
        rootKind: 'git',
        branch: 'main',
        changes: [],
        entries: [{ path: 'src/old.ts', name: 'old.ts', kind: 'file', size: 1, gitStatus: null, descendantGitStatusCount: null }],
      });
      await dirA.promise;
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('repo-b');
      expect(container.textContent).not.toContain('old.ts');
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

  it('renders create path prompts from the rail-only file tree context menu', async () => {
    apiMocks.workspaceTree.mockResolvedValue({
      root: '/repo',
      rootName: 'repo',
      rootKind: 'git',
      branch: 'main',
      changes: [],
      entries: [{ path: 'tmp', name: 'tmp', kind: 'directory', size: null, gitStatus: null, descendantGitStatusCount: null }],
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

    const newFolderButton = await vi.waitFor(() => {
      const button = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes('New Folder'));
      expect(button).toBeTruthy();
      return button as HTMLButtonElement;
    });

    act(() => {
      newFolderButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('New folder');
      expect(container.textContent).toContain('New folder name');
    });
  });

  it('keeps create file prompts open with a readable error when the name already exists', async () => {
    apiMocks.workspaceTree.mockResolvedValue({
      root: '/repo',
      rootName: 'repo',
      rootKind: 'git',
      branch: 'main',
      changes: [],
      entries: [{ path: 'tmp', name: 'tmp', kind: 'directory', size: null, gitStatus: null, descendantGitStatusCount: null }],
    });
    const createFile = deferred<never>();
    apiMocks.createWorkspaceFile.mockReturnValue(createFile.promise);

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

    const newFileButton = await vi.waitFor(() => {
      const button = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes('New File'));
      expect(button).toBeTruthy();
      return button as HTMLButtonElement;
    });

    act(() => {
      newFileButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = await vi.waitFor(() => {
      const field = container.querySelector('input');
      expect(field).toBeTruthy();
      return field as HTMLInputElement;
    });

    act(() => {
      setInputValue(input, 'codex-duplicate-target.txt');
    });

    const continueButton = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes('Continue'));
    expect(continueButton).toBeTruthy();
    await act(async () => {
      continueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.createWorkspaceFile).toHaveBeenCalledWith('/repo', 'tmp/codex-duplicate-target.txt', '');
    expect(apiMocks.workspaceFile).not.toHaveBeenCalled();
    await act(async () => {
      createFile.reject(new Error('File already exists: tmp/codex-duplicate-target.txt'));
      try {
        await createFile.promise;
      } catch {
        /* expected */
      }
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('New file');
      expect(container.textContent).toContain('File already exists: tmp/codex-duplicate-target.txt');
    });
  });

  it('rejects slash-separated names in create file prompts before calling the workspace API', async () => {
    apiMocks.workspaceTree.mockResolvedValue({
      root: '/repo',
      rootName: 'repo',
      rootKind: 'git',
      branch: 'main',
      changes: [],
      entries: [{ path: 'tmp', name: 'tmp', kind: 'directory', size: null, gitStatus: null, descendantGitStatusCount: null }],
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

    const newFileButton = await vi.waitFor(() => {
      const button = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes('New File'));
      expect(button).toBeTruthy();
      return button as HTMLButtonElement;
    });

    act(() => {
      newFileButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = await vi.waitFor(() => {
      const field = container.querySelector('input');
      expect(field).toBeTruthy();
      return field as HTMLInputElement;
    });

    act(() => {
      setInputValue(input, 'nested/slash-created.txt');
    });

    const continueButton = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes('Continue'));
    expect(continueButton).toBeTruthy();
    await act(async () => {
      continueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(apiMocks.createWorkspaceFile).not.toHaveBeenCalled();
    expect(container.textContent).toContain('New file');
    expect(container.textContent).toContain('File names cannot include slashes.');
  });

  it('keeps move prompts open when the destination folder is invalid', async () => {
    apiMocks.workspaceTree.mockResolvedValue({
      root: '/repo',
      rootName: 'repo',
      rootKind: 'git',
      branch: 'main',
      changes: [],
      entries: [{ path: 'tmp', name: 'tmp', kind: 'directory', size: null, gitStatus: null, descendantGitStatusCount: null }],
    });
    const movePath = deferred<never>();
    apiMocks.moveWorkspacePath.mockReturnValue(movePath.promise);

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

    const moveButton = await vi.waitFor(() => {
      const button = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.includes('Move to…'));
      expect(button).toBeTruthy();
      return button as HTMLButtonElement;
    });

    act(() => {
      moveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Move tmp');
    });

    const input = await vi.waitFor(() => {
      const field = container.querySelector('input');
      expect(field).toBeTruthy();
      return field as HTMLInputElement;
    });

    act(() => {
      setInputValue(input, 'tmp/missing-dest');
    });

    const submitButton = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.trim() === 'Move');
    expect(submitButton).toBeTruthy();
    await act(async () => {
      submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(apiMocks.moveWorkspacePath).toHaveBeenCalledWith('/repo', 'tmp', 'tmp/missing-dest');
    await act(async () => {
      movePath.reject(new Error('Destination folder does not exist: tmp/missing-dest'));
      try {
        await movePath.promise;
      } catch {
        /* expected */
      }
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Move tmp');
    expect(container.textContent).toContain('Destination folder does not exist: tmp/missing-dest');
  });

  it('ignores stale forced file loads from "Open anyway" after switching to a different file', async () => {
    const tree = deferred<{
      root: string;
      rootName: string;
      rootKind: 'git';
      branch: string;
      changes: never[];
      entries: Array<{ path: string; name: string; kind: 'file'; size: number; gitStatus: null; descendantGitStatusCount: null }>;
    }>();
    const largeFileLoad = deferred<ReturnType<typeof file>>();
    const largeFileForcedLoad = deferred<ReturnType<typeof file>>();
    const normalFileLoad = deferred<ReturnType<typeof file>>();

    apiMocks.workspaceTree.mockReturnValue(tree.promise);
    apiMocks.workspaceFile.mockImplementation((_cwd: string, path: string, opts?: { force?: boolean }) => {
      if (path === 'large.ts' && !opts?.force) return largeFileLoad.promise;
      if (path === 'large.ts' && opts?.force) return largeFileForcedLoad.promise;
      if (path === 'normal.ts') return normalFileLoad.promise;
      throw new Error(`unexpected ${path}`);
    });
    apiMocks.workspaceDiff.mockResolvedValue({ addedLines: [], deletedBlocks: [] });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(React.createElement(WorkspaceExplorer, { cwd: '/repo', onDraftPrompt: () => undefined }));
    });

    await act(async () => {
      tree.resolve({
        root: '/repo',
        rootName: 'repo',
        rootKind: 'git',
        branch: 'main',
        changes: [],
        entries: [
          { path: 'large.ts', name: 'large.ts', kind: 'file', size: 10_000_000, gitStatus: null, descendantGitStatusCount: null },
          { path: 'normal.ts', name: 'normal.ts', kind: 'file', size: 1, gitStatus: null, descendantGitStatusCount: null },
        ],
      });
      await tree.promise;
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('large.ts');
      expect(container.textContent).toContain('normal.ts');
    });

    // Click large.ts to open the large file
    const rows = [...container.querySelectorAll('[role="button"]')];
    const largeRow = rows.find((node) => node.textContent?.includes('large.ts'));
    expect(largeRow).toBeTruthy();
    act(() => {
      largeRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Resolve the first load as a large file (tooLarge: true, content: null)
    await act(async () => {
      largeFileLoad.resolve({
        path: 'large.ts',
        name: 'large.ts',
        content: null,
        binary: false,
        tooLarge: true,
        size: 10_000_000,
        mime: 'text/plain',
        gitStatus: null,
      });
      await largeFileLoad.promise;
    });

    // Verify "Large file" and "Open anyway" are shown
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Large file');
      expect(container.textContent).toContain('Open anyway');
    });

    // Click "Open anyway" — triggers forced load
    const openAnywayBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.includes('Open anyway'));
    expect(openAnywayBtn).toBeTruthy();
    act(() => {
      openAnywayBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Before forced load resolves, click normal.ts
    const normalRow = rows.find((node) => node.textContent?.includes('normal.ts'));
    expect(normalRow).toBeTruthy();
    act(() => {
      normalRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Resolve normal file load
    await act(async () => {
      normalFileLoad.resolve(file('normal.ts', 'normal content'));
      await normalFileLoad.promise;
    });

    await vi.waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe('normal content');
    });

    // Now resolve the stale forced load
    await act(async () => {
      largeFileForcedLoad.resolve(file('large.ts', 'stale forced content'));
      await largeFileForcedLoad.promise;
    });

    // Content should still be normal.ts — stale forced load was discarded
    await vi.waitFor(() => {
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
      expect(textarea?.value).toBe('normal content');
      expect(container.textContent).toContain('normal.ts');
    });
  });
});
