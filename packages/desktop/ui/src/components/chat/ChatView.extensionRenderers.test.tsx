import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({
    extensions: [
      {
        id: 'system-artifacts',
        enabled: true,
        manifest: {
          contributes: {
            transcriptRenderers: [
              {
                id: 'artifact-tool-block',
                tool: 'artifact',
                component: 'ArtifactTranscriptRenderer',
                standalone: true,
              },
            ],
          },
        },
      },
      {
        id: 'system-diffs',
        enabled: true,
        manifest: {
          contributes: {
            transcriptRenderers: [
              {
                id: 'checkpoint-tool-block',
                tool: 'checkpoint',
                component: 'CheckpointTranscriptRenderer',
                standalone: true,
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

import { ChatView } from './ChatView.js';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

describe('chat view extension transcript renderers', () => {
  it('renders durable artifact tool rows inside internal-work clusters instead of standalone extension cards', () => {
    const html = renderToStaticMarkup(
      createElement(ChatView, {
        messages: [
          {
            type: 'tool_use',
            ts: '2026-05-12T18:00:00.000Z',
            tool: 'artifact',
            input: {
              action: 'save',
              artifactId: 'artifact-test',
              title: 'Artifact Test',
              kind: 'html',
            },
            details: {
              action: 'save',
              artifactId: 'artifact-test',
              title: 'Artifact Test',
              kind: 'html',
            },
            output: 'Saved artifact',
            status: 'ok',
          },
        ],
      }),
    );

    expect(html).toContain('Internal work');
    expect(html).toContain('artifact');
    expect(html).toContain('Artifact Test');
    expect(html).not.toContain('data-extension-tool-host');
  });

  it('renders checkpoint tool rows with the extension card so inline diffs are visible', () => {
    const html = renderToStaticMarkup(
      createElement(ChatView, {
        messages: [
          {
            type: 'tool_use',
            ts: '2026-05-12T18:00:00.000Z',
            tool: 'checkpoint',
            input: { action: 'save', message: 'fix: inline checkpoint diff', paths: ['src/file.ts'] },
            output: 'Saved checkpoint abc1234 fix: inline checkpoint diff (1 files, +1 -0).',
            status: 'ok',
          },
        ],
      }),
    );

    expect(html).toContain('data-extension-tool-host');
    expect(html).toContain('checkpoint transcript card');
  });

  it('renders checkpoint list calls as ordinary tool rows, not pinned checkpoint cards', () => {
    const html = renderToStaticMarkup(
      createElement(ChatView, {
        transcriptDisclosureMode: 'expanded',
        messages: [
          {
            type: 'tool_use',
            ts: '2026-05-12T18:00:00.000Z',
            tool: 'checkpoint',
            input: { action: 'list' },
            details: { checkpointId: '1504906c4' },
            output: '1504906c4 fix: align conversation title edit styling',
            status: 'ok',
          },
        ],
      }),
    );

    expect(html).toContain('checkpoint');
    expect(html).not.toContain('1504906');
    expect(html).not.toContain('data-extension-tool-host');
  });

  it('collapses repeated checkpoint save attempts with the same message in pinned tool rows', () => {
    const checkpointInput = { action: 'save', message: 'fix: dedupe checkpoint retries', paths: ['src/file.ts'] };
    const html = renderToStaticMarkup(
      createElement(ChatView, {
        messages: [
          {
            type: 'tool_use',
            ts: '2026-05-12T18:00:00.000Z',
            tool: 'checkpoint',
            input: checkpointInput,
            output: 'Refusing to checkpoint unrelated staged changes: package.json',
            status: 'ok',
          },
          {
            type: 'tool_use',
            ts: '2026-05-12T18:00:01.000Z',
            tool: 'checkpoint',
            input: checkpointInput,
            output: 'Saved checkpoint abc1234 fix: dedupe checkpoint retries (1 files, +1 -0).',
            status: 'ok',
          },
          {
            type: 'tool_use',
            ts: '2026-05-12T18:00:02.000Z',
            tool: 'checkpoint',
            input: checkpointInput,
            output: 'error: failed to push some refs to github.com:repo.git',
            status: 'ok',
          },
        ],
      }),
    );

    expect(html.match(/data-extension-tool-host/g)).toHaveLength(1);
  });
});
