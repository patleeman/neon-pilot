// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEventsContext, INITIAL_APP_EVENT_VERSIONS } from '../app/contexts.js';
import { api } from '../client/api';
import { INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS } from '../conversation/conversationEventVersions.js';
import type { ConversationArtifactRecord } from '../shared/types.js';
import { ConversationArtifactWorkbenchPane } from './ConversationArtifactWorkbench.js';

vi.mock('../client/api', () => ({
  api: {
    conversationArtifact: vi.fn(),
  },
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
});
