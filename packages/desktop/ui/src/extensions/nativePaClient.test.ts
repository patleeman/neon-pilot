// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createNativeExtensionClient } from './nativePaClient';

describe('native extension transcript client', () => {
  it('shares resource selection state for route right sidebars', () => {
    const pa = createNativeExtensionClient('demo');
    pa.selection.set(null);
    const handler = vi.fn();
    const hostEventHandler = vi.fn();
    window.addEventListener('pa-ext-event', hostEventHandler);

    const subscription = pa.selection.subscribe(handler);
    const selection = {
      kind: 'resource' as const,
      resource: {
        type: 'skill',
        id: 'skill:demo',
        label: 'Demo Skill',
        source: 'system-skills',
        data: { path: 'demo' },
      },
      cwd: '/repo',
    };
    pa.selection.set(selection);

    expect(pa.selection.get()).toEqual({
      ...selection,
      updatedAt: expect.any(String),
    });
    expect(handler).toHaveBeenNthCalledWith(1, null);
    expect(handler).toHaveBeenNthCalledWith(2, {
      ...selection,
      updatedAt: expect.any(String),
    });
    expect(hostEventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          event: 'host:selection',
          payload: {
            ...selection,
            updatedAt: expect.any(String),
          },
        },
      }),
    );

    subscription.unsubscribe();
    pa.selection.set(null);
    expect(handler).toHaveBeenCalledTimes(2);
    window.removeEventListener('pa-ext-event', hostEventHandler);
  });

  it('exposes target props for extension-owned transcript targets', () => {
    const pa = createNativeExtensionClient('demo');

    expect(pa.transcript.targetProps({ kind: 'extension', extensionId: 'demo', targetId: 'approval-1' })).toEqual({
      'data-transcript-target': 'extension:demo:approval-1',
      'data-transcript-extension-id': 'demo',
      'data-transcript-extension-target-id': 'approval-1',
    });
  });

  it('dispatches spotlight requests', () => {
    const listener = vi.fn();
    window.addEventListener('pa:transcript-spotlight', listener);
    const pa = createNativeExtensionClient('demo');

    pa.transcript.spotlight({ kind: 'background_run', runId: 'run-demo' });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { target: { kind: 'background_run', runId: 'run-demo' } } }));
    window.removeEventListener('pa:transcript-spotlight', listener);
  });

  it('subscribes to host app invalidations', () => {
    const handler = vi.fn();
    const pa = createNativeExtensionClient('demo');
    const subscription = pa.ui.subscribeInvalidations(handler);

    window.dispatchEvent(new CustomEvent('neon-pilot-app-invalidate', { detail: { topics: ['automation', 'runs', 123] } }));

    expect(handler).toHaveBeenCalledWith({ topics: ['automation', 'runs'] });
    subscription.unsubscribe();
    window.dispatchEvent(new CustomEvent('neon-pilot-app-invalidate', { detail: { topics: ['tasks'] } }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
