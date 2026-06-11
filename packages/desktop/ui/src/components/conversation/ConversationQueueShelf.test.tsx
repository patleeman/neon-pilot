// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationQueueShelf } from './ConversationQueueShelf';
import { CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT } from './conversationQueueCommands';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('ConversationQueueShelf', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    vi.restoreAllMocks();
  });

  it('renders queued prompts with restore and remote states', () => {
    const html = renderToString(
      <ConversationQueueShelf
        pendingQueue={[
          { id: 'steer-1', text: 'Steer this', imageCount: 0, restorable: true, type: 'steer', queueIndex: 0 },
          { id: 'follow-1', text: '', imageCount: 2, restorable: false, type: 'followUp', queueIndex: 0 },
        ]}
        conversationNeedsTakeover={false}
        onRestoreQueuedPrompt={vi.fn()}
      />,
    );

    expect(html).toContain('Queued');
    expect(html).toContain('⤵ steer');
    expect(html).toContain('Steer this');
    expect(html).toContain('restore');
    expect(html).toContain('↷ followup');
    expect(html).toContain('(image only)');
    expect(html).toContain('2 images attached');
    expect(html).toContain('remote');
  });

  it('renders background-run follow-ups as compact summaries', () => {
    const html = renderToString(
      <ConversationQueueShelf
        pendingQueue={[
          {
            id: 'follow-1',
            text: [
              'Background task run-123 has finished.',
              'taskSlug=release-preflight-checks',
              'status=completed',
              'log=/tmp/runs/run-123/output.log',
              'command=pnpm run check:extensions',
              '',
              'Recent log tail:',
              'Composer input tools: 1...',
              '',
              'Use run get/logs if you need more detail. Then continue from this point.',
            ].join('\n'),
            imageCount: 0,
            restorable: true,
            type: 'followUp',
            queueIndex: 0,
          },
        ]}
        conversationNeedsTakeover={false}
        onRestoreQueuedPrompt={vi.fn()}
      />,
    );

    const visibleText = html.replace(/<!-- -->/g, '');
    expect(visibleText).toContain('Background task');
    expect(visibleText).toContain('release-preflight-checks completed');
    expect(visibleText).toContain('$ pnpm run check:extensions');
    expect(visibleText).toContain('Composer input tools: 1...');
    expect(html).not.toContain('taskSlug=release-preflight-checks');
    expect(html).not.toContain('/tmp/runs/run-123/output.log');
  });

  it('handles the shared restore-first queued prompt command', () => {
    const onRestoreQueuedPrompt = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ConversationQueueShelf
          pendingQueue={[
            { id: 'remote-1', text: 'Remote prompt', imageCount: 0, restorable: false, type: 'followUp', queueIndex: 0 },
            { id: 'steer-1', text: 'Steer this', imageCount: 0, restorable: true, type: 'steer', queueIndex: 1 },
          ]}
          conversationNeedsTakeover={false}
          onRestoreQueuedPrompt={onRestoreQueuedPrompt}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT));
    });

    expect(onRestoreQueuedPrompt).toHaveBeenCalledWith('steer', 1, 'steer-1');
  });

  it('ignores the restore-first queued prompt command when takeover is required', () => {
    const onRestoreQueuedPrompt = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ConversationQueueShelf
          pendingQueue={[{ id: 'steer-1', text: 'Steer this', imageCount: 0, restorable: true, type: 'steer', queueIndex: 0 }]}
          conversationNeedsTakeover
          onRestoreQueuedPrompt={onRestoreQueuedPrompt}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT));
    });

    expect(onRestoreQueuedPrompt).not.toHaveBeenCalled();
  });
});
