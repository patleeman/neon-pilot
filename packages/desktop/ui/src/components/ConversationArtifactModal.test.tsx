// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEventsContext, INITIAL_APP_EVENT_VERSIONS } from '../app/contexts.js';
import { INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS } from '../conversation/conversationEventVersions.js';
import { writeClipboardText } from '../desktop/clipboard';
import { useApi } from '../hooks/useApi';
import { ARTIFACT_MODAL_COMMAND_EVENT } from './artifactModalCommands.js';
import { ConversationArtifactModal } from './ConversationArtifactModal.js';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

vi.mock('../desktop/clipboard', () => ({
  writeClipboardText: vi.fn(),
}));

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

function createUseApiResult(overrides: Partial<ReturnType<typeof useApi>> = {}) {
  return {
    data: null,
    loading: false,
    refreshing: false,
    error: null,
    refetch: vi.fn(),
    replaceData: vi.fn(),
    ...overrides,
  };
}

function mockUseApiResults(results: Record<string, Partial<ReturnType<typeof useApi>>>) {
  vi.mocked(useApi).mockImplementation((_fetcher, key) => {
    if (!key || !(key in results)) {
      throw new Error(`Unexpected useApi key: ${String(key)}`);
    }

    return createUseApiResult(results[key]);
  });
}

function renderModal(entry = '/conversations/conv-123?artifact=artifact-html') {
  return renderToString(
    <MemoryRouter initialEntries={[entry]}>
      <AppEventsContext.Provider
        value={{ versions: INITIAL_APP_EVENT_VERSIONS, conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS }}
      >
        <ConversationArtifactModal conversationId="conv-123" artifactId="artifact-html" />
      </AppEventsContext.Provider>
    </MemoryRouter>,
  );
}

function renderModalClient(entry = '/conversations/conv-123?artifact=artifact-html') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppEventsContext.Provider
        value={{ versions: INITIAL_APP_EVENT_VERSIONS, conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS }}
      >
        <ConversationArtifactModal conversationId="conv-123" artifactId="artifact-html" />
      </AppEventsContext.Provider>
    </MemoryRouter>,
  );
}

function mockLoadedArtifact() {
  mockUseApiResults({
    'conv-123:artifact-html': {
      data: {
        conversationId: 'conv-123',
        artifact: {
          id: 'artifact-html',
          conversationId: 'conv-123',
          title: 'Product draft',
          kind: 'html',
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:05:00.000Z',
          revision: 2,
          content: '<section><h1>Draft</h1><p>Hello from desktop.</p></section>',
        },
      },
    },
    'conv-123:artifacts': {
      data: {
        conversationId: 'conv-123',
        artifacts: [
          {
            id: 'artifact-html',
            conversationId: 'conv-123',
            title: 'Product draft',
            kind: 'html',
            createdAt: '2026-03-25T00:00:00.000Z',
            updatedAt: '2026-03-25T00:05:00.000Z',
            revision: 2,
          },
          {
            id: 'artifact-diagram',
            conversationId: 'conv-123',
            title: 'Architecture diagram',
            kind: 'mermaid',
            createdAt: '2026-03-25T00:01:00.000Z',
            updatedAt: '2026-03-25T00:06:00.000Z',
            revision: 1,
          },
        ],
      },
    },
  });
}

describe('ConversationArtifactModal', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
      if (typeof message === 'string' && message.includes('useLayoutEffect does nothing on the server')) {
        return;
      }

      originalConsoleError(message, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders a modal artifact viewer with navigation for sibling artifacts', () => {
    mockLoadedArtifact();

    const html = renderModal();

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Product draft');
    expect(html).toContain('Architecture diagram');
    expect(html).toContain('aria-label="Copy source"');
    expect(html).toContain('aria-label="Show source"');
    expect(html).toContain('iframe');
  });

  it('handles shared artifact modal commands', async () => {
    vi.mocked(writeClipboardText).mockResolvedValue(undefined);
    mockLoadedArtifact();

    renderModalClient();

    fireEvent(
      window,
      new CustomEvent(ARTIFACT_MODAL_COMMAND_EVENT, {
        detail: { command: 'toggleSource' },
      }),
    );
    expect(await screen.findByText('Source')).toBeTruthy();

    fireEvent(
      window,
      new CustomEvent(ARTIFACT_MODAL_COMMAND_EVENT, {
        detail: { command: 'toggleFullscreen' },
      }),
    );
    expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();

    fireEvent(
      window,
      new CustomEvent(ARTIFACT_MODAL_COMMAND_EVENT, {
        detail: { command: 'copySource' },
      }),
    );

    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith('<section><h1>Draft</h1><p>Hello from desktop.</p></section>');
    });
  });

  it('clears pending copy feedback timers on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    vi.mocked(writeClipboardText).mockResolvedValue(undefined);
    mockLoadedArtifact();

    const view = renderModalClient();

    fireEvent(
      window,
      new CustomEvent(ARTIFACT_MODAL_COMMAND_EVENT, {
        detail: { command: 'copySource' },
      }),
    );

    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith('<section><h1>Draft</h1><p>Hello from desktop.</p></section>');
    });
    const callsBeforeUnmount = clearTimeoutSpy.mock.calls.length;

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(callsBeforeUnmount + 1);
  });

  it('renders an error state when the artifact cannot be loaded', () => {
    mockUseApiResults({
      'conv-123:artifact-html': {
        error: 'Artifact not found.',
      },
      'conv-123:artifacts': {
        data: {
          conversationId: 'conv-123',
          artifacts: [],
        },
      },
    });

    const html = renderModal();

    expect(html).toContain('Artifact not found.');
    expect(html).toContain('aria-label="Close"');
  });
});
