import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConversationQueueShelf } from './ConversationQueueShelf';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

describe('ConversationQueueShelf', () => {
  it('renders queued prompts with restore and remote states', () => {
    const html = renderToString(
      <ConversationQueueShelf
        pendingQueue={[
          { id: 'steer-1', text: 'Steer this', imageCount: 0, restorable: true, type: 'steer', queueIndex: 0 },
          { id: 'follow-1', text: '', imageCount: 2, restorable: false, type: 'followUp', queueIndex: 0 },
        ]}
        conversationNeedsTakeover={false}
        onRestoreQueuedPrompt={vi.fn()}
        onOpenConversation={vi.fn()}
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
        onOpenConversation={vi.fn()}
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
});
