// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEventsContext, INITIAL_APP_EVENT_VERSIONS } from '../app/contexts.js';
import { api } from '../client/api';
import { INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS } from '../conversation/conversationEventVersions.js';
import { writeClipboardText } from '../desktop/clipboard';
import type { ConversationArtifactRecord } from '../shared/types.js';
import { ConversationArtifactWorkbenchPane } from './ConversationArtifactWorkbench.js';

vi.mock('../client/api', () => ({
  api: {
    conversationArtifact: vi.fn(),
    deleteConversationArtifact: vi.fn(),
  },
}));

vi.mock('../desktop/clipboard', () => ({
  writeClipboardText: vi.fn(),
}));

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

function artifact(id: string, title: string, content: string): ConversationArtifactRecord {
  return {
    id,
    conversationId: 'conv-123',
    title,
    kind: 'mermaid',
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:05:00.000Z',
    revision: 1,
    content,
  };
}

function renderPane(artifactId: string) {
  return render(
    <AppEventsContext.Provider
      value={{ versions: INITIAL_APP_EVENT_VERSIONS, conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS }}
    >
      <ConversationArtifactWorkbenchPane conversationId="conv-123" artifactId={artifactId} />
    </AppEventsContext.Provider>,
  );
}

describe('ConversationArtifactWorkbenchPane', () => {
  beforeEach(() => {
    vi.mocked(api.conversationArtifact).mockReset();
    vi.mocked(api.deleteConversationArtifact).mockReset();
    vi.mocked(writeClipboardText).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clears the previous artifact while a newly selected artifact loads', async () => {
    let resolveSecondArtifact: ((value: { artifact: ConversationArtifactRecord }) => void) | undefined;
    vi.mocked(api.conversationArtifact)
      .mockResolvedValueOnce({ artifact: artifact('artifact-a', 'Artifact A', 'graph TD; A-->B;') })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecondArtifact = resolve;
        }),
      );

    const view = renderPane('artifact-a');
    await screen.findByText('Artifact A');
    expect(screen.getByText('graph TD; A-->B;')).toBeTruthy();

    view.rerender(
      <AppEventsContext.Provider
        value={{ versions: INITIAL_APP_EVENT_VERSIONS, conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS }}
      >
        <ConversationArtifactWorkbenchPane conversationId="conv-123" artifactId="artifact-b" />
      </AppEventsContext.Provider>,
    );

    expect(await screen.findByText('Loading artifact…')).toBeTruthy();
    expect(screen.queryByText('Artifact A')).toBeNull();
    expect(screen.queryByText('graph TD; A-->B;')).toBeNull();

    resolveSecondArtifact?.({ artifact: artifact('artifact-b', 'Artifact B', 'graph TD; B-->C;') });
    await waitFor(() => expect(screen.getByText('Artifact B')).toBeTruthy());
  });

  it('clears pending copy feedback timers on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    vi.mocked(api.conversationArtifact).mockResolvedValue({ artifact: artifact('artifact-a', 'Artifact A', 'graph TD; A-->B;') });

    const view = renderPane('artifact-a');
    const copyButton = await screen.findByRole('button', { name: /copy source/i });

    fireEvent.click(copyButton);

    await waitFor(() => expect(writeClipboardText).toHaveBeenCalledWith('graph TD; A-->B;'));
    const callsBeforeUnmount = clearTimeoutSpy.mock.calls.length;

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(callsBeforeUnmount + 1);
  });

  it('copies artifact source from the pointer-activated workbench action', async () => {
    vi.mocked(api.conversationArtifact).mockResolvedValue({ artifact: artifact('artifact-a', 'Artifact A', 'graph TD; A-->B;') });

    renderPane('artifact-a');
    const copyButton = await screen.findByRole('button', { name: /copy source/i });

    fireEvent.pointerUp(copyButton);

    await waitFor(() => expect(writeClipboardText).toHaveBeenCalledWith('graph TD; A-->B;'));
    expect(await screen.findByRole('button', { name: /copied/i })).toBeTruthy();
  });

  it('deletes the selected artifact after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.conversationArtifact).mockResolvedValue({ artifact: artifact('artifact-a', 'Artifact A', 'graph TD; A-->B;') });
    vi.mocked(api.deleteConversationArtifact).mockResolvedValue({
      conversationId: 'conv-123',
      artifactId: 'artifact-a',
      deleted: true,
      artifacts: [],
    });

    renderPane('artifact-a');
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(api.deleteConversationArtifact).toHaveBeenCalledWith('conv-123', 'artifact-a'));
    expect(confirmSpy).toHaveBeenCalledWith('Delete artifact "Artifact A"? This cannot be undone.');
    expect(await screen.findByText('This artifact was deleted.')).toBeTruthy();
    expect(screen.queryByText('Artifact A')).toBeNull();
  });

  it('does not expose raw delete errors in the workbench pane', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.conversationArtifact).mockResolvedValue({ artifact: artifact('artifact-a', 'Artifact A', 'graph TD; A-->B;') });
    vi.mocked(api.deleteConversationArtifact).mockRejectedValue(
      new Error('DELETE /api/conversations/conv-123/artifacts/artifact-a failed at /Users/patrick/app.ts:12'),
    );

    renderPane('artifact-a');
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(api.deleteConversationArtifact).toHaveBeenCalledWith('conv-123', 'artifact-a'));
    expect(screen.queryByText(new RegExp('DELETE /api', 'i'))).toBeNull();
    expect(screen.queryByText(new RegExp('Users/patrick', 'i'))).toBeNull();
    expect(screen.getByText('Artifact A')).toBeTruthy();
  });
});
