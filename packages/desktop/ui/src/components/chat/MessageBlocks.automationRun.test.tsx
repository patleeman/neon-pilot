// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../extensions/commands.js', () => ({ setExtensionCommandContext: vi.fn() }));
vi.mock('../../extensions/useExtensionRegistry', () => ({ useExtensionRegistry: () => ({ messageActions: [] }) }));
vi.mock('../../extensions/nativePaClient', () => ({ createNativeExtensionClient: () => ({ extension: { invoke: async () => ({}) } }) }));
vi.mock('../../client/apiBase', () => ({}));

import { ContextShelf } from './MessageBlocks.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots) act(() => root.unmount());
  mountedRoots.length = 0;
});

describe('automation run transcript context', () => {
  it('renders automation run entries as collapsed system context instead of assistant prose', async () => {
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

    expect(container.querySelector('[data-automation-run-block="1"]')).not.toBeNull();
    expect(container.textContent).toContain('Automation');
    expect(container.textContent).toContain('Completed: test-heartbeat');
    expect(container.textContent).not.toContain('This is the agent output.');
  });
});
