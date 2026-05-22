import { beforeEach, describe, expect, it, vi } from 'vitest';

const childProcess = vi.hoisted(() => ({ spawnSync: vi.fn() }));
vi.mock('child_process', () => ({ spawnSync: childProcess.spawnSync }));

import {
  readTailscaleServeProxyState,
  resolveCompanionTailscaleUrl,
  resolveTailscaleServeBaseUrl,
  syncCompanionTailscaleServe,
  syncTailscaleServeProxy,
  syncWebUiTailscaleServe,
} from './tailscale-serve.js';

function ok(stdout = '') {
  return { status: 0, stdout, stderr: '' };
}

function fail(stderr = 'failed') {
  return { status: 1, stdout: '', stderr };
}

describe('tailscale serve helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEON_PILOT_TAILSCALE_BIN;
  });

  it('reports disabled state without shelling out', () => {
    expect(readTailscaleServeProxyState({ enabled: false, port: 3000, path: 'companion' })).toEqual({
      status: 'disabled',
      path: '/companion',
      expectedProxyTarget: 'http://localhost:3000',
      message: 'Tailnet publishing is disabled.',
    });
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  it('classifies missing, mismatched, and published serve proxy states', () => {
    childProcess.spawnSync
      .mockReturnValueOnce(ok(JSON.stringify({ Web: {} })))
      .mockReturnValueOnce(ok(JSON.stringify({ Web: { HTTPS: { Handlers: { '/companion': { Proxy: 'http://localhost:9999' } } } } })))
      .mockReturnValueOnce(ok(JSON.stringify({ Web: { HTTPS: { Handlers: { '/companion': { Proxy: 'http://127.0.0.1:3000' } } } } })));

    expect(readTailscaleServeProxyState({ enabled: true, port: 3000, path: 'companion' })).toMatchObject({
      status: 'missing',
      path: '/companion',
    });
    expect(readTailscaleServeProxyState({ enabled: true, port: 3000, path: '/companion' })).toMatchObject({
      status: 'mismatch',
      actualProxyTarget: 'http://localhost:9999',
    });
    expect(readTailscaleServeProxyState({ enabled: true, port: 3000, path: '/companion' })).toMatchObject({
      status: 'published',
      actualProxyTarget: 'http://127.0.0.1:3000',
    });
  });

  it('returns unavailable state for command and JSON failures', () => {
    childProcess.spawnSync.mockReturnValueOnce(fail('not running')).mockReturnValueOnce(ok('{bad json'));

    expect(readTailscaleServeProxyState({ enabled: true, port: 3000 })).toMatchObject({
      status: 'unavailable',
      message: expect.stringContaining('not running'),
    });
    expect(readTailscaleServeProxyState({ enabled: true, port: 3000 })).toMatchObject({
      status: 'unavailable',
      message: expect.stringContaining('Could not parse'),
    });
  });

  it('syncs web and companion serve commands and verifies the resulting state', () => {
    childProcess.spawnSync
      .mockReturnValueOnce(ok())
      .mockReturnValueOnce(ok(JSON.stringify({ Web: { HTTPS: { Handlers: { '/': { Proxy: 'localhost:8080' } } } } })))
      .mockReturnValueOnce(ok())
      .mockReturnValueOnce(ok(JSON.stringify({ Web: { HTTPS: { Handlers: { '/companion': { Proxy: 'http://[::1]:3838' } } } } })));

    syncWebUiTailscaleServe({ enabled: true, port: 8080 });
    syncCompanionTailscaleServe({ enabled: true, port: 3838 });

    expect(childProcess.spawnSync).toHaveBeenNthCalledWith(1, 'tailscale', ['serve', '--bg', '--set-path=/', 'localhost:8080'], {
      encoding: 'utf-8',
    });
    expect(childProcess.spawnSync).toHaveBeenNthCalledWith(3, 'tailscale', ['serve', '--bg', '--set-path=/companion', 'localhost:3838'], {
      encoding: 'utf-8',
    });
  });

  it('throws for invalid ports and failed serve commands', () => {
    expect(() => syncTailscaleServeProxy({ enabled: true, port: 0 })).toThrow('Invalid Tailscale Serve port: 0');
    childProcess.spawnSync.mockReturnValueOnce(fail('permission denied'));
    expect(() => syncTailscaleServeProxy({ enabled: true, port: 3000, path: '/' })).toThrow(
      'Could not enable Tailscale Serve for / -> localhost:3000: permission denied',
    );
  });

  it('resolves base and companion URLs from tailscale status', () => {
    childProcess.spawnSync
      .mockReturnValueOnce(ok(JSON.stringify({ Self: { DNSName: 'machine.tailnet.ts.net.' } })))
      .mockReturnValueOnce(ok(JSON.stringify({ Web: { HTTPS: { Handlers: { '/companion': { Proxy: 'http://localhost:3838' } } } } })))
      .mockReturnValueOnce(ok(JSON.stringify({ Self: { HostName: 'machine.' }, MagicDNSSuffix: '.tailnet.ts.net.' })))
      .mockReturnValueOnce(ok(JSON.stringify({ Web: {} })));

    expect(resolveTailscaleServeBaseUrl()).toBe('https://machine.tailnet.ts.net');
    expect(resolveCompanionTailscaleUrl(3838)).toBe('https://machine.tailnet.ts.net');
    expect(resolveCompanionTailscaleUrl(3838)).toBeUndefined();
  });
});
