import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppEventsContext, INITIAL_APP_EVENT_VERSIONS } from '../../app/contexts.js';
import { INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS } from '../../conversation/conversationEventVersions.js';
import { useApi } from '../../hooks/useApi';
import { ThemeProvider } from '../../ui-state/theme.js';
import { CheckpointInlineDiff } from './CheckpointInlineDiff.js';

vi.mock('../../hooks/useApi', () => ({
  useApi: vi.fn(),
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

afterEach(() => {
  vi.clearAllMocks();
});

describe('CheckpointInlineDiff', () => {
  it('renders a compact inline diff with unified file sections', () => {
    vi.mocked(useApi).mockReturnValue(
      createUseApiResult({
        data: {
          conversationId: 'conv-123',
          checkpoint: {
            id: 'abc1234def567890abc1234def567890abc12345',
            conversationId: 'conv-123',
            title: 'feat: add inline diff preview',
            cwd: '/tmp/workspace',
            commitSha: 'abc1234def567890abc1234def567890abc12345',
            shortSha: 'abc1234',
            subject: 'feat: add inline diff preview',
            authorName: 'Test User',
            committedAt: '2026-04-17T12:00:00.000Z',
            createdAt: '2026-04-17T12:00:01.000Z',
            updatedAt: '2026-04-17T12:00:01.000Z',
            fileCount: 1,
            linesAdded: 3,
            linesDeleted: 1,
            commentCount: 0,
            comments: [],
            files: [
              {
                path: 'packages/desktop/ui/src/components/chat/ChatView.tsx',
                status: 'modified',
                additions: 3,
                deletions: 1,
                patch:
                  'diff --git a/packages/desktop/ui/src/components/chat/ChatView.tsx b/packages/desktop/ui/src/components/chat/ChatView.tsx\n@@ -10,2 +10,3 @@\n old line\n-old value\n+new value\n+added value\n',
              },
            ],
          },
        },
      }),
    );

    const html = renderToString(
      <ThemeProvider>
        <AppEventsContext.Provider
          value={{ versions: INITIAL_APP_EVENT_VERSIONS, conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS }}
        >
          <CheckpointInlineDiff conversationId="conv-123" checkpointId="abc1234def567890abc1234def567890abc12345" />
        </AppEventsContext.Provider>
      </ThemeProvider>,
    );

    expect(html).not.toContain('Diff peek');
    expect(html).not.toContain('Scroll inline or click the preview to expand it.');
    expect(html).not.toContain('Show diff');
    expect(html).toContain('packages/desktop/ui/src/components/chat/ChatView.tsx');
    expect(html).toContain('Modified');
  });

  it('hides raw checkpoint API failures behind recovery copy', () => {
    vi.mocked(useApi).mockReturnValue(
      createUseApiResult({
        error:
          '404 Not Found from /api/conversations/conv-123/checkpoints/missing: Commit checkpoint missing was not found in file://localApi.js',
      }),
    );

    const html = renderToString(
      <ThemeProvider>
        <AppEventsContext.Provider
          value={{ versions: INITIAL_APP_EVENT_VERSIONS, conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS }}
        >
          <CheckpointInlineDiff conversationId="conv-123" checkpointId="missing" />
        </AppEventsContext.Provider>
      </ThemeProvider>,
    );

    expect(html).toContain('Couldn’t load this checkpoint diff. It may have been removed or is unavailable.');
    expect(html).not.toContain('/api/conversations');
    expect(html).not.toContain('file://');
    expect(html).not.toContain('localApi.js');
    expect(html).not.toContain('Commit checkpoint missing was not found');
  });
});
