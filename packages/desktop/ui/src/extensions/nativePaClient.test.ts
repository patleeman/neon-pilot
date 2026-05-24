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
});
