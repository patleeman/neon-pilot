// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MessageBlock } from '../../shared/types';

vi.mock('@pierre/diffs/react', () => ({
  PatchDiff: ({ patch }: { patch: string }) => <pre data-testid="patch-diff">{patch}</pre>,
}));

vi.mock('../../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({
    extensions: [
      {
        id: 'system-conversation-tools',
        enabled: true,
        manifest: {
          contributes: {
            transcriptRenderers: [
              {
                id: 'terminal-bash-tool-block',
                tool: 'bash',
                component: 'TerminalBashTranscriptRenderer',
              },
            ],
          },
        },
      },
    ],
    routes: [],
    surfaces: [],
    topBarElements: [],
    messageActions: [],
    composerShelves: [],
    newConversationPanels: [],
    settingsComponent: null,
    settingsComponents: [],
    composerButtons: [],
    composerInputTools: [],
    toolbarActions: [],
    contextMenus: [],
    threadHeaderActions: [],
    statusBarItems: [],
    conversationHeaderElements: [],
    conversationDecorators: [],
    activityTreeItemElements: [],
    activityTreeItemStyles: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../extensions/NativeExtensionToolBlockHost', () => ({
  NativeExtensionToolBlockHost: ({ block }: { block: { tool: string } }) => (
    <div data-extension-tool-host="true">{block.tool} transcript card</div>
  ),
}));

vi.mock('../../ui-state/theme', () => ({
  useTheme: () => ({
    theme: 'dark',
    availableThemes: [{ id: 'dark', appearance: 'dark' }],
  }),
}));

vi.mock('../../ui-state/theme', () => ({
  useTheme: () => ({ theme: 'dark', availableThemes: [{ id: 'dark', appearance: 'dark' }] }),
}));

import { ChatView } from './ChatView.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

function renderChatView(messages: MessageBlock[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ChatView messages={messages} isStreaming={false} />);
  });

  mountedRoots.push(root);
  return { container, root };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of mountedRoots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = '';
});

describe('ChatView bash trace clusters', () => {
  it('does not mount collapsed trace blocks until the cluster is expanded', () => {
    const bashBlock = {
      id: 'tool-1',
      type: 'tool_use',
      ts: '2026-05-13T10:56:49.000Z',
      tool: 'bash',
      input: { command: 'pwd' },
      output: '/Users/patrick/workingdir/personal-agent',
      status: 'ok',
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;

    const { container } = renderChatView([bashBlock]);

    expect(container.textContent).toContain('Internal work');
    expect(container.textContent).not.toContain('pwd');
    expect(container.querySelector('[data-extension-tool-host="true"]')).toBeNull();
  });

  it('shows the generic bash tool card when an internal-work cluster is expanded', () => {
    const bashBlock = {
      id: 'tool-1',
      type: 'tool_use',
      ts: '2026-05-13T10:56:49.000Z',
      tool: 'bash',
      input: { command: 'pwd' },
      output: '/Users/patrick/workingdir/personal-agent',
      status: 'ok',
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;

    const { container } = renderChatView([bashBlock]);

    expect(container.textContent).toContain('Internal work');
    expect(container.textContent).not.toContain('pwd');

    const toggle = container.querySelector('button[aria-expanded]');
    expect(toggle).not.toBeNull();

    act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('pwd');
    expect(container.querySelector('[data-extension-tool-host="true"]')).toBeNull();
  });

  it('keeps file-changing tools pinned while collapsed and expands inline diffs without raw tool details', () => {
    const editBlock = {
      id: 'tool-edit-1',
      type: 'tool_use',
      ts: '2026-05-13T10:56:49.000Z',
      tool: 'edit',
      input: { path: 'src/app.ts' },
      output: 'edited src/app.ts',
      status: 'ok',
      details: {
        fileChanges: [
          {
            path: 'src/app.ts',
            status: 'modified',
            additions: 1,
            deletions: 1,
            patch: 'diff --git a/src/app.ts b/src/app.ts\n@@ -1 +1 @@\n-old\n+new\n',
          },
        ],
      },
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;

    const { container } = renderChatView([editBlock]);

    expect(container.textContent).toContain('Internal work');
    expect(container.textContent).toContain('edit');
    expect(container.textContent).toContain('src/app.ts');
    expect(container.textContent).toContain('View diff');
    expect(container.textContent).not.toContain('edited src/app.ts');

    const viewDiffButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'View diff');
    expect(viewDiffButton).toBeTruthy();

    act(() => {
      viewDiffButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Hide diff');
    expect(container.textContent).toContain('Modified');
    expect(container.textContent).not.toContain('edited src/app.ts');
  });
});
