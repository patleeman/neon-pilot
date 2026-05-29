// @vitest-environment jsdom
import type { KnowledgeEntry, KnowledgeFileListResult } from '@neon-pilot/extensions/data';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitKBEvent } from './knowledgeEvents';
import { KnowledgeFileTree } from './KnowledgeFileTree';

const KNOWLEDGE_OPEN_FILE_IDS_STORAGE_KEY = 'pa:knowledge-open-file-ids';
const KNOWLEDGE_TREE_EXPANDED_FOLDERS_STORAGE_KEY = 'pa:knowledge-tree-expanded-folders';

const apiMocks = vi.hoisted(() => ({
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  knowledgeBase: vi.fn(),
  move: vi.fn(),
  rename: vi.fn(),
  search: vi.fn(),
  syncKnowledgeBase: vi.fn(),
  tree: vi.fn(),
  knowledgeFiles: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/data', () => ({
  api: {
    invokeExtensionAction: async (_extensionId: string, actionId: string, input: Record<string, unknown> = {}) => {
      const result = await (async () => {
        switch (actionId) {
          case 'readState':
            return apiMocks.knowledgeBase();
          case 'sync':
            return apiMocks.syncKnowledgeBase();
          case 'knowledgeListFiles':
            return apiMocks.knowledgeFiles();
          case 'knowledgeCreateFolder':
            return apiMocks.createFolder(input.id);
          case 'knowledgeDeleteFile':
            return apiMocks.deleteFile(input.id);
          case 'knowledgeMove':
            return apiMocks.move(input.id, input.targetDir);
          case 'knowledgeRename':
            return apiMocks.rename(input.id, input.newName);
          case 'knowledgeSearch':
            return apiMocks.search(input.q, input.limit);
          case 'knowledgeWriteFile':
            return apiMocks.writeFile(input.id, input.content);
          default:
            throw new Error(`Unhandled knowledge action ${actionId}`);
        }
      })();
      return { result };
    },
  },
}));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    },
  } as Storage;
}

const mountedRoots: Root[] = [];
const UPDATED_AT = '2026-04-22T12:00:00.000Z';

function createEntry(id: string, kind: KnowledgeEntry['kind']): KnowledgeEntry {
  const trimmed = id.endsWith('/') ? id.slice(0, -1) : id;
  const name = trimmed.split('/').filter(Boolean).pop() ?? trimmed;
  return {
    id,
    kind,
    name,
    path: trimmed,
    sizeBytes: 0,
    updatedAt: UPDATED_AT,
  };
}

const TREE: KnowledgeFileListResult = {
  root: '/knowledge',
  files: [
    createEntry('notes/', 'folder'),
    createEntry('notes/work/', 'folder'),
    createEntry('notes/work/todo.md', 'file'),
    createEntry('notes/today.md', 'file'),
    createEntry('projects/', 'folder'),
    createEntry('README.md', 'file'),
  ],
};

function renderTree() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onFileSelect = vi.fn();

  act(() => {
    root.render(
      <MemoryRouter>
        <KnowledgeFileTree activeFileId={null} onFileSelect={onFileSelect} />
      </MemoryRouter>,
    );
  });

  mountedRoots.push(root);
  return { container, onFileSelect };
}

function ManagedTree({ initialActiveFileId = null }: { initialActiveFileId?: string | null }) {
  const [activeFileId, setActiveFileId] = React.useState<string | null>(initialActiveFileId);
  return (
    <MemoryRouter>
      <KnowledgeFileTree activeFileId={activeFileId} onFileSelect={setActiveFileId} />
    </MemoryRouter>
  );
}

function renderManagedTree(initialActiveFileId?: string | null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ManagedTree initialActiveFileId={initialActiveFileId} />);
  });

  mountedRoots.push(root);
  return { container };
}

function queryInShadowRoots(root: ParentNode, selector: string): Element | null {
  const directMatch = root.querySelector(selector);
  if (directMatch) {
    return directMatch;
  }

  const elements = root.querySelectorAll('*');
  for (const element of elements) {
    if (element instanceof HTMLElement && element.shadowRoot) {
      const nestedMatch = queryInShadowRoots(element.shadowRoot, selector);
      if (nestedMatch) {
        return nestedMatch;
      }
    }
  }

  return null;
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = queryInShadowRoots(container, `button[aria-label="${label}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button ${label}`);
  }
  return button;
}

function click(target: HTMLElement) {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function contextMenu(target: HTMLElement) {
  act(() => {
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
  });
}

function fillInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) {
    throw new Error('HTMLInputElement value setter unavailable');
  }

  act(() => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe('KnowledgeFileTree', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    apiMocks.knowledgeBase.mockReset();
    apiMocks.knowledgeBase.mockResolvedValue({
      repoUrl: 'https://github.com/user/knowledge-base.git',
      branch: 'main',
      configured: true,
      effectiveRoot: '/knowledge',
      managedRoot: '/runtime/knowledge-base/repo',
      usesManagedRoot: true,
      syncStatus: 'idle',
      lastSyncAt: '2026-04-22T12:00:00.000Z',
      gitStatus: {
        localChangeCount: 0,
        aheadCount: 0,
        behindCount: 0,
      },
      recoveredEntryCount: 0,
      recoveryDir: '/runtime/knowledge-base/recovered',
    });
    apiMocks.knowledgeFiles.mockReset();
    apiMocks.knowledgeFiles.mockResolvedValue(TREE);
    apiMocks.syncKnowledgeBase.mockReset();
    apiMocks.syncKnowledgeBase.mockResolvedValue({
      repoUrl: 'https://github.com/user/knowledge-base.git',
      branch: 'main',
      configured: true,
      effectiveRoot: '/knowledge',
      managedRoot: '/runtime/knowledge-base/repo',
      usesManagedRoot: true,
      syncStatus: 'idle',
      lastSyncAt: '2026-04-22T12:00:00.000Z',
      gitStatus: {
        localChangeCount: 0,
        aheadCount: 0,
        behindCount: 0,
      },
      recoveredEntryCount: 0,
      recoveryDir: '/runtime/knowledge-base/recovered',
    });
  });

  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
  });

  it('shows the managed sync status in the knowledge header', async () => {
    apiMocks.knowledgeBase.mockResolvedValueOnce({
      repoUrl: 'https://github.com/user/knowledge-base.git',
      branch: 'main',
      configured: true,
      effectiveRoot: '/knowledge',
      managedRoot: '/runtime/knowledge-base/repo',
      usesManagedRoot: true,
      syncStatus: 'idle',
      gitStatus: {
        localChangeCount: 2,
        aheadCount: 0,
        behindCount: 0,
      },
      recoveredEntryCount: 0,
      recoveryDir: '/runtime/knowledge-base/recovered',
    });

    const { container } = renderTree();
    await flushAsyncWork();

    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Pending sync · 2 local changes');
  });

  it('syncs the knowledge base from the tree toolbar', async () => {
    const { container } = renderTree();
    await flushAsyncWork();

    click(getButton(container, 'Sync knowledge base'));
    await flushAsyncWork();

    expect(apiMocks.syncKnowledgeBase).toHaveBeenCalledTimes(1);
    expect(apiMocks.knowledgeBase).toHaveBeenCalledTimes(2);
    expect(apiMocks.knowledgeFiles).toHaveBeenCalledTimes(2);
  });

  it('stays empty when managed sync is off', async () => {
    apiMocks.knowledgeBase.mockResolvedValueOnce({
      repoUrl: '',
      branch: 'main',
      configured: false,
      effectiveRoot: '/knowledge',
      managedRoot: '/runtime/knowledge-base/repo',
      usesManagedRoot: false,
      syncStatus: 'disabled',
      recoveredEntryCount: 0,
      recoveryDir: '/runtime/knowledge-base/recovered',
    });

    const { container } = renderTree();
    await flushAsyncWork();

    expect(container.textContent).toContain('Connect a git repo to use Knowledge');
    expect(container.textContent).toContain('Neon Pilot needs a git repo to store and sync durable docs.');
    expect(queryInShadowRoots(container, 'button[aria-label="New file"]')).toBeNull();
    expect(apiMocks.knowledgeFiles).not.toHaveBeenCalled();
  });

  it('persists expanded folders and restores them after remount', async () => {
    const firstRender = renderTree();
    await flushAsyncWork();

    click(getButton(firstRender.container, 'notes'));
    await flushAsyncWork();
    click(getButton(firstRender.container, 'work'));
    await flushAsyncWork();

    expect(JSON.parse(localStorage.getItem(KNOWLEDGE_TREE_EXPANDED_FOLDERS_STORAGE_KEY) ?? '[]')).toEqual(['notes/', 'notes/work/']);

    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    firstRender.container.remove();

    const secondRender = renderTree();
    await flushAsyncWork();
    await flushAsyncWork();
    await flushAsyncWork();
    await flushAsyncWork();

    expect(apiMocks.knowledgeFiles).toHaveBeenCalledTimes(2);
    expect(getButton(secondRender.container, 'todo.md')).toBeTruthy();
  });

  it('drops descendant expansion state when a parent folder is collapsed', async () => {
    const { container } = renderTree();
    await flushAsyncWork();

    click(getButton(container, 'notes'));
    await flushAsyncWork();
    click(getButton(container, 'work'));
    await flushAsyncWork();
    click(getButton(container, 'notes'));
    await flushAsyncWork();

    expect(localStorage.getItem(KNOWLEDGE_TREE_EXPANDED_FOLDERS_STORAGE_KEY)).toBeNull();

    click(getButton(container, 'notes'));
    await flushAsyncWork();

    expect(JSON.parse(localStorage.getItem(KNOWLEDGE_TREE_EXPANDED_FOLDERS_STORAGE_KEY) ?? '[]')).toEqual(['notes/']);
    expect(queryInShadowRoots(container, 'button[aria-label="todo.md"]')).toBeNull();
  });

  it('tracks only the active file and does not render an open files section', async () => {
    const { container } = renderManagedTree();
    await flushAsyncWork();

    click(getButton(container, 'README.md'));
    await flushAsyncWork();
    click(getButton(container, 'notes'));
    await flushAsyncWork();
    click(getButton(container, 'today.md'));
    await flushAsyncWork();

    expect(JSON.parse(localStorage.getItem(KNOWLEDGE_OPEN_FILE_IDS_STORAGE_KEY) ?? '[]')).toEqual(['notes/today.md']);
    expect(container.textContent).not.toContain('Open Files');
    expect(queryInShadowRoots(container, 'button[aria-label="Open file notes/today.md"]')).toBeNull();
    expect(queryInShadowRoots(container, 'button[aria-label="Open file README.md"]')).toBeNull();

    act(() => {
      emitKBEvent('kb:close-active-file');
    });
    await flushAsyncWork();

    expect(localStorage.getItem(KNOWLEDGE_OPEN_FILE_IDS_STORAGE_KEY)).toBeNull();

    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    container.remove();

    const remounted = renderManagedTree();
    await flushAsyncWork();

    expect(remounted.container.textContent).not.toContain('Open Files');
  });

  it('reopens the most recently closed file when asked', async () => {
    const { container } = renderManagedTree();
    await flushAsyncWork();

    click(getButton(container, 'README.md'));
    await flushAsyncWork();
    click(getButton(container, 'notes'));
    await flushAsyncWork();
    click(getButton(container, 'today.md'));
    await flushAsyncWork();

    act(() => {
      emitKBEvent('kb:close-active-file');
    });
    await flushAsyncWork();

    expect(localStorage.getItem(KNOWLEDGE_OPEN_FILE_IDS_STORAGE_KEY)).toBeNull();

    act(() => {
      emitKBEvent('kb:reopen-closed-file');
    });
    await flushAsyncWork();

    expect(JSON.parse(localStorage.getItem(KNOWLEDGE_OPEN_FILE_IDS_STORAGE_KEY) ?? '[]')).toEqual(['notes/today.md']);
    expect(container.textContent).not.toContain('Open Files');
  });

  it('creates a new file inside the right-clicked folder', async () => {
    apiMocks.writeFile.mockResolvedValue(undefined);
    const { container } = renderManagedTree();
    await flushAsyncWork();

    contextMenu(getButton(container, 'notes'));
    await flushAsyncWork();

    const newFileItem = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((button) =>
      button.textContent?.includes('New File'),
    );
    expect(newFileItem).toBeTruthy();

    click(newFileItem!);
    await flushAsyncWork();

    expect(container.textContent).toContain('Create a new markdown file in notes/.');
    const input = container.querySelector<HTMLInputElement>('input[aria-label="File name"], input');
    if (!input) {
      throw new Error('Expected file name input');
    }
    fillInput(input, 'idea');

    const submit = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'New file' && button.type === 'submit',
    );
    expect(submit).toBeTruthy();

    click(submit!);
    await flushAsyncWork();

    expect(apiMocks.writeFile).toHaveBeenCalledWith('notes/idea.md', '');
  });

  it('does not render a resize separator between open files and the tree', async () => {
    const { container } = renderManagedTree();
    await flushAsyncWork();

    click(getButton(container, 'README.md'));
    await flushAsyncWork();

    const separator = container.querySelector<HTMLElement>('[aria-label="Resize open files section"]');
    expect(separator).toBeNull();
  });
});
