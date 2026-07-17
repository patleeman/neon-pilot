// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api.js';
import { resolveDiffThemeType } from './checkpoints/CheckpointDiffView.js';
import {
  CONVERSATION_OPEN_ACTIVE_CHECKPOINT_COMMAND_EVENT,
  CONVERSATION_OPEN_LATEST_CHECKPOINT_COMMAND_EVENT,
} from './conversation/checkpointCommands.js';
import { ConversationCheckpointWorkbenchPane, ConversationDiffRailContent } from './ConversationCheckpointWorkbench.js';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Root[] = [];

function checkpointSummary(overrides: Partial<React.ComponentProps<typeof ConversationDiffRailContent>['checkpoints'][number]>) {
  return {
    id: 'checkpoint-1',
    conversationId: 'conv-1',
    title: 'Change',
    cwd: '/tmp/repo',
    commitSha: 'abc1234567',
    shortSha: 'abc1234',
    subject: 'Change summary',
    authorName: 'Test User',
    committedAt: '2026-04-30T12:00:00.000Z',
    createdAt: '2026-04-30T12:00:00.000Z',
    updatedAt: '2026-04-30T12:00:00.000Z',
    fileCount: 1,
    linesAdded: 4,
    linesDeleted: 1,
    commentCount: 0,
    ...overrides,
  };
}

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('resolveDiffThemeType', () => {
  it('maps active Neon Pilot themes to the light/dark diff theme type', () => {
    expect(
      resolveDiffThemeType('tokyo-night-dark', [
        { id: 'tokyo-night-dark', label: 'Tokyo Night Dark', appearance: 'dark' },
        { id: 'tokyo-night-light', label: 'Tokyo Night Light', appearance: 'light' },
      ]),
    ).toBe('dark');
    expect(resolveDiffThemeType('custom-light', [{ id: 'custom-light', label: 'Custom Light', appearance: 'light' }])).toBe('light');
    expect(resolveDiffThemeType('unknown-dark-theme', [])).toBe('dark');
  });
});

describe('ConversationCheckpointWorkbench', () => {
  it('renders conversation diffs newest-first in the rail', () => {
    const html = renderToString(
      <ConversationDiffRailContent
        checkpoints={[
          {
            id: 'newer',
            conversationId: 'conv-1',
            title: 'Newer change',
            cwd: '/tmp/repo',
            commitSha: 'def4567890',
            shortSha: 'def4567',
            subject: 'Newer change summary',
            authorName: 'Test User',
            committedAt: '2026-04-30T12:00:00.000Z',
            createdAt: '2026-04-30T12:00:00.000Z',
            updatedAt: '2026-04-30T12:00:00.000Z',
            fileCount: 2,
            linesAdded: 10,
            linesDeleted: 3,
            commentCount: 0,
          },
          {
            id: 'older',
            conversationId: 'conv-1',
            title: 'Older change',
            cwd: '/tmp/repo',
            commitSha: 'abc1234567',
            shortSha: 'abc1234',
            subject: 'Older change summary',
            authorName: 'Test User',
            committedAt: '2026-04-30T11:00:00.000Z',
            createdAt: '2026-04-30T11:00:00.000Z',
            updatedAt: '2026-04-30T11:00:00.000Z',
            fileCount: 1,
            linesAdded: 4,
            linesDeleted: 1,
            commentCount: 0,
          },
        ]}
        activeCheckpointId="newer"
        loading={false}
        error={null}
        onOpenCheckpoint={vi.fn()}
      />,
    );

    expect(html).toContain('def4567');
    expect(html).toContain('abc1234');
    expect(html).not.toContain('Newer change summary');
    expect(html).not.toContain('Older change summary');
    expect(html).toContain('10');
    expect(html).toContain('3');
    expect(html.indexOf('def4567')).toBeLessThan(html.indexOf('abc1234'));
  });

  it('keeps an opened git commit visible when there are no saved checkpoint rows', () => {
    const html = renderToString(
      <ConversationDiffRailContent
        checkpoints={[]}
        activeCheckpointId="24d4dea5becb49e802d3d97b5ae75cac6816bbf5"
        loading={false}
        error={null}
        onOpenCheckpoint={vi.fn()}
      />,
    );

    expect(html).toContain('Opened commit');
    expect(html).toContain('Loaded from local git history');
    expect(html).toContain('24d4dea5becb');
  });

  it('shows a placeholder when no diff is selected', () => {
    const html = renderToString(<ConversationCheckpointWorkbenchPane conversationId="conv-1" checkpointId={null} />);

    expect(html).toContain('Select a diff');
    expect(html).toContain('Pick a saved conversation diff');
  });

  it('opens active and latest checkpoints from shared command events', () => {
    vi.spyOn(api, 'conversationCheckpoint').mockImplementation(() => new Promise(() => undefined));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const onOpenCheckpoint = vi.fn();

    act(() => {
      root.render(
        <ConversationDiffRailContent
          checkpoints={[
            checkpointSummary({ id: 'newer', shortSha: 'def4567', commitSha: 'def4567890' }),
            checkpointSummary({ id: 'older', shortSha: 'abc1234', commitSha: 'abc1234567' }),
          ]}
          activeCheckpointId="older"
          loading={false}
          error={null}
          onOpenCheckpoint={onOpenCheckpoint}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONVERSATION_OPEN_ACTIVE_CHECKPOINT_COMMAND_EVENT));
      window.dispatchEvent(new CustomEvent(CONVERSATION_OPEN_LATEST_CHECKPOINT_COMMAND_EVENT));
    });

    expect(onOpenCheckpoint).toHaveBeenNthCalledWith(1, 'older');
    expect(onOpenCheckpoint).toHaveBeenNthCalledWith(2, 'newer');
  });
});
