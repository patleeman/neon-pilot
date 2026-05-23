// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addWorkspaceOpenFile,
  MAX_WORKSPACE_OPEN_FILES,
  readWorkspaceOpenFiles,
  removeWorkspaceOpenFile,
  WORKSPACE_OPEN_FILES_CHANGED_EVENT,
  workspaceOpenFilesKey,
  writeWorkspaceOpenFiles,
} from './openWorkspaceFiles';

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('open workspace files', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    Object.defineProperty(window, 'localStorage', { configurable: true, value: globalThis.localStorage });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('scopes storage keys by cwd and optional scope', () => {
    expect(workspaceOpenFilesKey('/repo')).toBe('pa:workspace-open-files:/repo');
    expect(workspaceOpenFilesKey('/repo', 'window-1')).toBe('pa:workspace-open-files:window-1:/repo');
  });

  it('reads only string paths and caps persisted entries', () => {
    const paths = Array.from({ length: MAX_WORKSPACE_OPEN_FILES + 5 }, (_, index) => `file-${index}.ts`);
    localStorage.setItem(workspaceOpenFilesKey('/repo'), JSON.stringify([...paths, 1, null, { path: 'bad' }]));

    expect(readWorkspaceOpenFiles('/repo')).toEqual(paths.slice(0, MAX_WORKSPACE_OPEN_FILES));
  });

  it('dedupes, caps, persists, and broadcasts writes', () => {
    const listener = vi.fn();
    window.addEventListener(WORKSPACE_OPEN_FILES_CHANGED_EVENT, listener);
    const paths = ['a.ts', 'b.ts', 'a.ts', ...Array.from({ length: MAX_WORKSPACE_OPEN_FILES + 5 }, (_, index) => `extra-${index}.ts`)];

    writeWorkspaceOpenFiles('/repo', paths, 'scope-a');

    const expected = [...new Set(paths)].slice(0, MAX_WORKSPACE_OPEN_FILES);
    expect(readWorkspaceOpenFiles('/repo', 'scope-a')).toEqual(expected);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { cwd: '/repo', paths: expected } }));
    window.removeEventListener(WORKSPACE_OPEN_FILES_CHANGED_EVENT, listener);
  });

  it('adds paths as MRU without duplicating existing paths', () => {
    expect(addWorkspaceOpenFile(['a.ts', 'b.ts'], 'c.ts')).toEqual(['c.ts', 'a.ts', 'b.ts']);
    expect(addWorkspaceOpenFile(['a.ts', 'b.ts'], 'a.ts')).toEqual(['a.ts', 'b.ts']);
  });

  it('removes paths without mutating other entries', () => {
    expect(removeWorkspaceOpenFile(['a.ts', 'b.ts', 'c.ts'], 'b.ts')).toEqual(['a.ts', 'c.ts']);
  });
});
