// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT, type FileChangeCommandDetail } from './fileChangeCommands';
import { FileChangesToolDiff } from './FileChangesToolDiff';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('@pierre/diffs/react', () => ({
  PatchDiff: ({ patch }: { patch: string }) => <pre data-testid="patch-diff">{patch}</pre>,
}));

vi.mock('../../ui-state/theme', () => ({
  useTheme: () => ({ theme: 'dark', availableThemes: [{ id: 'dark', appearance: 'dark' }] }),
}));

describe('FileChangesToolDiff commands', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  it('toggles the first visible file change from the shared command event', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <FileChangesToolDiff
          fileChanges={[
            { path: 'src/first.ts', status: 'modified', additions: 1, deletions: 1 },
            { path: 'src/second.ts', status: 'modified', additions: 1, deletions: 0 },
          ]}
        />,
      );
    });
    expect(container.textContent).toContain('src/first.ts');
    expect(container.textContent).toContain('src/second.ts');
    expect(container.textContent?.match(/Diff unavailable/g)).toHaveLength(2);

    act(() => {
      window.dispatchEvent(new CustomEvent<FileChangeCommandDetail>(FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('src/first.ts');
    expect(container.textContent).toContain('src/second.ts');
    expect(container.textContent?.match(/Diff unavailable/g)).toHaveLength(1);
  });

  it('lets only the first mounted diff block handle one shared command event', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <>
          <FileChangesToolDiff fileChanges={[{ path: 'src/first.ts', status: 'modified', additions: 1, deletions: 1 }]} />
          <FileChangesToolDiff fileChanges={[{ path: 'src/second.ts', status: 'modified', additions: 1, deletions: 1 }]} />
        </>,
      );
    });
    await act(async () => {});

    act(() => {
      window.dispatchEvent(new CustomEvent<FileChangeCommandDetail>(FILE_CHANGE_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(container.textContent).toContain('src/first.ts');
    expect(container.textContent).toContain('src/second.ts');
    expect(container.textContent?.match(/Diff unavailable/g)).toHaveLength(1);
  });
});
