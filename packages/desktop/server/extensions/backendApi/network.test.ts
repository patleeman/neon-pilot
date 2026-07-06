import { beforeEach, describe, expect, it, vi } from 'vitest';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/network', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('exposes network host capability only through the worker bridge', async () => {
    const network = await import('./network.js');
    await expect(network.networkFetch('https://example.com')).rejects.toThrow(
      'Network host capability is unavailable outside an extension backend worker request.',
    );

    const bridge = vi.fn(async (_capability: string, _operation: string, _input?: unknown) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' },
      text: '<html>hello</html>',
      bodyBase64: Buffer.from('<html>hello</html>').toString('base64'),
      url: 'https://example.com',
    }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    await expect(network.networkFetch('https://example.com')).resolves.toEqual({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' },
      text: '<html>hello</html>',
      bodyBase64: Buffer.from('<html>hello</html>').toString('base64'),
      url: 'https://example.com',
    });
    expect(bridge).toHaveBeenCalledWith('network', 'fetch', { url: 'https://example.com' });
  });

  it('passes fetch init options through the bridge', async () => {
    const network = await import('./network.js');
    const bridge = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      text: 'ok',
      bodyBase64: Buffer.from('ok').toString('base64'),
      url: 'https://example.com/data',
    }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await network.networkFetch('https://example.com/data', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      redirect: 'manual',
      timeoutMs: 5000,
    });

    expect(bridge).toHaveBeenCalledWith('network', 'fetch', {
      url: 'https://example.com/data',
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      redirect: 'manual',
      timeoutMs: 5000,
    });
  });

  it('forwards body string through the bridge', async () => {
    const network = await import('./network.js');
    const bridge = vi.fn(async () => ({
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json' },
      text: '{"id":1}',
      bodyBase64: Buffer.from('{"id":1}').toString('base64'),
      url: 'https://example.com/api',
    }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await network.networkFetch('https://example.com/api', {
      method: 'POST',
      body: '{"hello":"world"}',
    });

    expect(bridge).toHaveBeenCalledWith('network', 'fetch', {
      url: 'https://example.com/api',
      method: 'POST',
      body: '{"hello":"world"}',
    });
  });

  it('forwards bodyBase64 through the bridge', async () => {
    const network = await import('./network.js');
    const bridge = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      text: 'ok',
      bodyBase64: Buffer.from('ok').toString('base64'),
      url: 'https://example.com/upload',
    }));
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await network.networkFetch('https://example.com/upload', {
      method: 'PUT',
      bodyBase64: Buffer.from('binary data').toString('base64'),
    });

    expect(bridge).toHaveBeenCalledWith('network', 'fetch', {
      url: 'https://example.com/upload',
      method: 'PUT',
      bodyBase64: Buffer.from('binary data').toString('base64'),
    });
  });

  it('rejects when bridge returns an invalid result', async () => {
    const network = await import('./network.js');
    const bridge = vi.fn(async () => null);
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await expect(network.networkFetch('https://example.com')).rejects.toThrow('Network fetch returned an invalid result.');
  });
});
