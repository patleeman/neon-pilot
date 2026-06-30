// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const registryState = vi.hoisted(() => ({
  value: {
    extensions: [] as Array<{ id: string; enabled: boolean }>,
    transcriptBlocks: [] as Array<{ id: string; extensionId: string; component: string }>,
    messageActions: [],
  },
}));

vi.mock('../../extensions/commands.js', () => ({ setExtensionCommandContext: vi.fn() }));
vi.mock('../../extensions/useExtensionRegistry', () => ({ useExtensionRegistry: () => registryState.value }));
vi.mock('../../extensions/NativeExtensionToolBlockHost.js', () => ({
  NativeExtensionTranscriptBlockHost: ({ block }: { block: { customType?: string; details?: unknown } }) => (
    <div data-extension-transcript-block="true">
      {block.customType}:{JSON.stringify(block.details)}
    </div>
  ),
}));
vi.mock('../../extensions/nativePaClient', () => ({ createNativeExtensionClient: () => ({ extension: { invoke: async () => ({}) } }) }));
vi.mock('../../client/apiBase', () => ({}));

import { ContextShelf } from './MessageBlocks.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots) act(() => root.unmount());
  mountedRoots.length = 0;
  registryState.value = { extensions: [], transcriptBlocks: [], messageActions: [] };
});

describe('automation run transcript context', () => {
  it('renders automation run entries as a collapsed user-like automation card', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(
        <ContextShelf
          blocks={[
            {
              type: 'context',
              id: 'automation_run:heartbeat:completed',
              ts: '2026-06-23T12:00:00.000Z',
              customType: 'automation_run',
              text: 'Automation completed: test-heartbeat\n\nTask: @test-heartbeat\nOutput:\nThis is the agent output.',
            },
          ]}
        />,
      );
    });

    const automationBlock = container.querySelector('[data-automation-run-block="1"]');
    expect(automationBlock).not.toBeNull();
    expect(automationBlock?.querySelector('.ui-message-card-user')).not.toBeNull();
    expect(automationBlock?.querySelector('.ui-disclosure')).toBeNull();
    expect(container.textContent).toContain('Automation completed');
    expect(container.textContent).toContain('test-heartbeat');
    expect(container.textContent).not.toContain('This is the agent output.');
  });

  it('renders extension-owned transcript blocks inline through the registered renderer', async () => {
    registryState.value = {
      extensions: [{ id: 'system-test-blocks', enabled: true }],
      transcriptBlocks: [{ id: 'test_extension_block', extensionId: 'system-test-blocks', component: 'TestExtensionBlock' }],
      messageActions: [],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(
        <ContextShelf
          blocks={[
            {
              type: 'context',
              id: 'test_extension_block:test',
              ts: '2026-06-29T12:00:00.000Z',
              customType: 'test_extension_block',
              text: 'Extension block',
              details: { itemId: 'test-block', status: 'ready' },
            },
          ]}
        />,
      );
    });

    expect(container.querySelector('[data-extension-transcript-block="true"]')).not.toBeNull();
    expect(container.textContent).toContain('test_extension_block');
    expect(container.textContent).toContain('test-block');
    expect(container.querySelector('.ui-disclosure')).toBeNull();
  });
});
