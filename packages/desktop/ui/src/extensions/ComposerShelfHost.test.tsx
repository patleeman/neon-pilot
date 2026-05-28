// @vitest-environment jsdom
import React, { act, memo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearComposerShelfComponentCacheForTests, ComposerShelfHost, preloadComposerShelfComponent } from './ComposerShelfHost';

const apiMocks = vi.hoisted(() => ({
  invokeExtensionAction: vi.fn(async () => ({ ok: true, result: null })),
  extensionManifest: vi.fn(),
  extensionSurfacesForExtension: vi.fn(),
}));
const systemLoaderMocks = vi.hoisted(() => ({
  memoShelf: vi.fn(async () => ({
    preloadComposerShelf: vi.fn(),
    MemoShelf: memo(function MemoShelf({ shelfContext }: { shelfContext: { conversationId: string } }) {
      return <div>Memo shelf for {shelfContext.conversationId}</div>;
    }),
  })),
}));

vi.mock('../client/api', () => ({ api: apiMocks }));
vi.mock('./systemExtensionModules', () => ({
  systemExtensionModules: new Map([['memo-shelf', systemLoaderMocks.memoShelf]]),
}));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots) {
    act(() => root.unmount());
  }
  mountedRoots.length = 0;
  clearComposerShelfComponentCacheForTests();
  vi.clearAllMocks();
});

describe('ComposerShelfHost', () => {
  it('renders memoized extension shelf exports', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(
        <ComposerShelfHost
          registration={{
            extensionId: 'memo-shelf',
            id: 'todos',
            placement: 'top',
            component: 'MemoShelf',
            frontendEntry: 'dist/frontend.js',
          }}
          shelfContext={{ conversationId: 'conv-1', isStreaming: false, isLive: false }}
        />,
      );
    });

    await vi.waitFor(() => expect(container.textContent).toContain('Memo shelf for conv-1'));
  });

  it('reuses the loaded shelf component across conversation remounts', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const registration = {
      extensionId: 'memo-shelf',
      id: 'todos',
      placement: 'top' as const,
      component: 'MemoShelf',
      frontendEntry: 'dist/frontend.js',
    };

    await act(async () => {
      root.render(
        <ComposerShelfHost registration={registration} shelfContext={{ conversationId: 'conv-1', isStreaming: false, isLive: false }} />,
      );
    });
    await vi.waitFor(() => expect(container.textContent).toContain('Memo shelf for conv-1'));

    await act(async () => {
      root.render(
        <ComposerShelfHost registration={registration} shelfContext={{ conversationId: 'conv-2', isStreaming: false, isLive: false }} />,
      );
    });

    await vi.waitFor(() => expect(container.textContent).toContain('Memo shelf for conv-2'));
    expect(systemLoaderMocks.memoShelf).toHaveBeenCalledTimes(1);
  });

  it('preloads shelf modules before mount', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const registration = {
      extensionId: 'memo-shelf',
      id: 'todos',
      placement: 'top' as const,
      component: 'MemoShelf',
      frontendEntry: 'dist/frontend.js',
    };
    await preloadComposerShelfComponent(registration, 0);
    await act(async () => {
      root.render(
        <ComposerShelfHost registration={registration} shelfContext={{ conversationId: 'conv-1', isStreaming: false, isLive: false }} />,
      );
    });

    await vi.waitFor(() => expect(container.textContent).toContain('Memo shelf for conv-1'));
    expect(systemLoaderMocks.memoShelf).toHaveBeenCalledTimes(1);
  });
});
