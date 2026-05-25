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

function renderChatView(messages: MessageBlock[], props: Partial<React.ComponentProps<typeof ChatView>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ChatView messages={messages} isStreaming={false} {...props} />);
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
      output: '/Users/patrick/workingdir/neon-pilot',
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
      output: '/Users/patrick/workingdir/neon-pilot',
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

  it('prefetches deferred tool output on hover inside expanded internal work', () => {
    const onHydrateMessage = vi.fn();
    const toolBlock = {
      id: 'tool-deferred-1',
      type: 'tool_use',
      ts: '2026-05-13T10:56:49.000Z',
      tool: 'read',
      input: { path: 'src/app.ts' },
      output: '',
      outputDeferred: true,
      status: 'ok',
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;

    const { container } = renderChatView([toolBlock], { onHydrateMessage });

    const internalWorkToggle = container.querySelector('button[aria-expanded="false"]');
    expect(internalWorkToggle).toBeTruthy();

    act(() => {
      internalWorkToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const toolHeader = Array.from(container.querySelectorAll('[role="button"]')).find((button) =>
      button.textContent?.includes('src/app.ts'),
    );
    expect(toolHeader).toBeTruthy();

    act(() => {
      toolHeader?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(onHydrateMessage).toHaveBeenCalledWith('tool-deferred-1');
  });

  it('prefetches deferred internal-work clusters before tool blocks are mounted', () => {
    const onHydrateMessage = vi.fn();
    const deferredToolBlock = {
      id: 'tool-projected-1',
      type: 'tool_use',
      ts: '2026-05-13T10:56:49.000Z',
      tool: 'read',
      input: { path: 'src/app.ts' },
      output: '',
      status: 'ok',
    } satisfies Extract<MessageBlock, { type: 'tool_use' }>;
    const { container } = renderChatView(
      [
        { id: 'u1', type: 'user', ts: '2026-05-13T10:56:48.000Z', text: 'read it' },
        { id: 'a1', type: 'text', ts: '2026-05-13T10:56:50.000Z', text: 'done' },
      ],
      {
        onHydrateMessage,
        precomputedRenderItems: [
          { type: 'message', block: { id: 'u1', type: 'user', ts: '2026-05-13T10:56:48.000Z', text: 'read it' }, index: 0 },
          {
            type: 'trace_cluster',
            blocks: [],
            startIndex: 1,
            endIndex: 1,
            summary: {
              stepCount: 1,
              categories: [{ key: 'tool:read', kind: 'tool', label: 'read', count: 1, tool: 'read' }],
              durationMs: null,
              hasError: false,
              hasRunning: false,
            },
            deferredBlockIds: [deferredToolBlock.id],
          },
          { type: 'message', block: { id: 'a1', type: 'text', ts: '2026-05-13T10:56:50.000Z', text: 'done' }, index: 2 },
        ],
      },
    );

    const internalWorkToggle = container.querySelector('button[aria-expanded="false"]');
    expect(internalWorkToggle).toBeTruthy();

    act(() => {
      internalWorkToggle?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(onHydrateMessage).toHaveBeenCalledWith('tool-projected-1');
  });

  it('keeps file-changing tools inside collapsed internal work until the cluster expands', () => {
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
    expect(container.textContent).not.toContain('src/app.ts');
    expect(container.textContent).not.toContain('View diff');
    expect(container.textContent).not.toContain('edited src/app.ts');

    const internalWorkToggle = container.querySelector('button[aria-expanded="false"]');
    expect(internalWorkToggle).toBeTruthy();

    act(() => {
      internalWorkToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('edit');
    expect(container.textContent).toContain('src/app.ts');
    expect(container.textContent).toContain('View diff');
    expect(container.textContent).not.toContain('edited src/app.ts');

    const viewDiffButton = Array.from(container.querySelectorAll('[role="button"]')).find((button) =>
      button.textContent?.includes('View diff'),
    );
    expect(viewDiffButton).toBeTruthy();

    act(() => {
      viewDiffButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Modified');
  });
});
