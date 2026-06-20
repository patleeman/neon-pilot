// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createNativeExtensionClient } from './nativePaClient';

describe('native extension transcript client', () => {
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
