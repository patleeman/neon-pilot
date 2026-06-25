// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArtifactDetailPanel } from './panels';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

function createUiInvalidationClient() {
  return {
    subscribeInvalidations(handler: (event: { topics: string[] }) => void) {
      const listener = (event: Event) => {
        const detail = event instanceof CustomEvent && Array.isArray(event.detail?.topics) ? event.detail : { topics: [] };
        handler({ topics: detail.topics.filter((topic: unknown): topic is string => typeof topic === 'string') });
      };
      window.addEventListener('neon-pilot-app-invalidate', listener);
      return {
        unsubscribe: () => window.removeEventListener('neon-pilot-app-invalidate', listener),
      };
    },
  };
}

function renderDetailPanel(invoke = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/conversations/conv-1?artifact=latex-1']}>
      <ArtifactDetailPanel
        pa={{ extension: { invoke }, ui: createUiInvalidationClient() } as never}
        context={{ conversationId: 'conv-1', cwd: '/repo', pathname: '/conversations/conv-1', search: '?artifact=latex-1', hash: '' }}
        surface={{ id: 'artifact-detail', extensionId: 'system-artifacts', title: 'Artifact' } as never}
        params={{}}
      />
    </MemoryRouter>,
  );
}

describe('ArtifactDetailPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps latex source visible when clipboard copy is denied', async () => {
    const invoke = vi.fn().mockResolvedValue({
      id: 'latex-1',
      kind: 'latex',
      title: 'Proof notes',
      revision: 1,
      updatedAt: '2026-06-24T00:00:00.000Z',
      content: '\\\\documentclass{article}\\n\\\\begin{document}\\n$E = mc^2$\\n\\\\end{document}',
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Write permission denied.')),
      },
    });

    renderDetailPanel(invoke);

    expect(await screen.findByText('LaTeX source')).toBeTruthy();
    expect(screen.getByText(/E = mc\^2/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /copy latex/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('E = mc^2'));
    });
    expect(await screen.findByText('Could not copy artifact source. Use the visible source text instead.')).toBeTruthy();
    expect(screen.getByText('LaTeX source')).toBeTruthy();
    expect(screen.getByText(/E = mc\^2/)).toBeTruthy();
    expect(screen.queryByText(/Write permission denied/i)).toBeNull();
  });

  it('shows semantic type and style preset for typed html artifacts', async () => {
    const invoke = vi.fn().mockResolvedValue({
      id: 'latex-1',
      kind: 'html',
      metadata: { type: 'slides', stylePreset: 'slide-deck' },
      title: 'Release review',
      revision: 1,
      updatedAt: '2026-06-24T00:00:00.000Z',
      content: '<!doctype html><html><body><main>Deck</main></body></html>',
    });

    renderDetailPanel(invoke);

    expect(await screen.findByText('Release review')).toBeTruthy();
    expect(screen.getAllByText('Slide deck').length).toBeGreaterThan(0);
    expect(screen.getByText('Slide deck · html · rev 1')).toBeTruthy();
  });

  it('refreshes an open artifact when artifacts are invalidated', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'latex-1',
        kind: 'latex',
        title: 'Before notes',
        revision: 1,
        updatedAt: '2026-06-24T00:00:00.000Z',
        content: 'before content',
      })
      .mockResolvedValueOnce({
        id: 'latex-1',
        kind: 'latex',
        title: 'After notes',
        revision: 2,
        updatedAt: '2026-06-24T00:01:00.000Z',
        content: 'after content',
      });

    renderDetailPanel(invoke);

    expect(await screen.findByText('Before notes')).toBeTruthy();
    expect(screen.getByText('before content')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-app-invalidate', { detail: { topics: ['artifacts'] } }));
    });

    expect(await screen.findByText('After notes')).toBeTruthy();
    expect(screen.getByText('latex · rev 2')).toBeTruthy();
    expect(screen.getByText('after content')).toBeTruthy();
    expect(screen.queryByText('before content')).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('shows friendly copy when an open artifact is missing', async () => {
    const invoke = vi
      .fn()
      .mockRejectedValue(new Error('Extension "system-artifacts" action "artifact" failed: Artifact latex-1 was not found.'));

    renderDetailPanel(invoke);

    expect(await screen.findByText('This artifact was deleted or is no longer available.')).toBeTruthy();
    expect(screen.queryByText(/Extension "system-artifacts"/i)).toBeNull();
    expect(screen.queryByText(/action "artifact" failed/i)).toBeNull();
  });
});
