import { describe, expect, it, vi } from 'vitest';

import { captureDesktopScreenshot, captureWindowedBrowserScreenshot, captureWindowedDesktopScreenshot } from './screenshot.js';

function createMissingFileError() {
  const error = new Error('missing file') as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
}

describe('captureDesktopScreenshot', () => {
  it('returns a PNG payload when screencapture writes a file', async () => {
    const mkdtemp = vi.fn().mockResolvedValue('/tmp/neon-pilot-screenshot-abc');
    const readFile = vi.fn().mockResolvedValue(Buffer.from('png-bytes'));
    const rm = vi.fn().mockResolvedValue(undefined);
    const runInteractiveScreencapture = vi.fn().mockResolvedValue({ code: 0, signal: null, stderr: '' });

    const result = await captureDesktopScreenshot({
      platform: 'darwin',
      tmpdir: () => '/tmp',
      mkdtemp,
      readFile,
      rm,
      runInteractiveScreencapture,
    });

    expect(mkdtemp).toHaveBeenCalledWith('/tmp/neon-pilot-screenshot-');
    const outputPath = runInteractiveScreencapture.mock.calls[0]?.[0];
    expect(outputPath).toMatch(/^\/tmp\/neon-pilot-screenshot-abc\/Screenshot .*\.png$/);
    expect(readFile).toHaveBeenCalledWith(outputPath);
    expect(result.cancelled).toBe(false);
    expect(result.image).toEqual({
      name: expect.stringMatching(/^Screenshot .*\.png$/),
      mimeType: 'image/png',
      data: Buffer.from('png-bytes').toString('base64'),
    });
    expect(rm).toHaveBeenCalledWith('/tmp/neon-pilot-screenshot-abc', { recursive: true, force: true });
  });

  it('treats a missing output file after exit code 1 as cancellation', async () => {
    const rm = vi.fn().mockResolvedValue(undefined);

    const result = await captureDesktopScreenshot({
      platform: 'darwin',
      tmpdir: () => '/tmp',
      mkdtemp: vi.fn().mockResolvedValue('/tmp/neon-pilot-screenshot-cancelled'),
      readFile: vi.fn().mockRejectedValue(createMissingFileError()),
      rm,
      runInteractiveScreencapture: vi.fn().mockResolvedValue({ code: 1, signal: null, stderr: '' }),
    });

    expect(result).toEqual({ cancelled: true });
    expect(rm).toHaveBeenCalledWith('/tmp/neon-pilot-screenshot-cancelled', { recursive: true, force: true });
  });

  it('rejects oversized screenshots before base64 encoding them over IPC', async () => {
    await expect(
      captureDesktopScreenshot({
        platform: 'darwin',
        tmpdir: () => '/tmp',
        mkdtemp: vi.fn().mockResolvedValue('/tmp/neon-pilot-screenshot-large'),
        readFile: vi.fn().mockResolvedValue(Buffer.alloc(8 * 1024 * 1024 + 1)),
        rm: vi.fn().mockResolvedValue(undefined),
        runInteractiveScreencapture: vi.fn().mockResolvedValue({ code: 0, signal: null, stderr: '' }),
      }),
    ).rejects.toThrow('Screenshot is too large to send through the native desktop bridge');
  });

  it('surfaces a screen-recording permission hint when macOS rejects capture', async () => {
    await expect(
      captureDesktopScreenshot({
        platform: 'darwin',
        tmpdir: () => '/tmp',
        mkdtemp: vi.fn().mockResolvedValue('/tmp/neon-pilot-screenshot-permission'),
        readFile: vi.fn().mockRejectedValue(createMissingFileError()),
        rm: vi.fn().mockResolvedValue(undefined),
        runInteractiveScreencapture: vi.fn().mockResolvedValue({ code: 2, signal: null, stderr: 'permission denied' }),
      }),
    ).rejects.toThrow('Enable Screen Recording for Neon Pilot');
  });
});

describe('captureWindowedDesktopScreenshot', () => {
  it('captures the active renderer page with optional bounds metadata', async () => {
    const png = Buffer.from('windowed-png');
    const nativeImage = {
      toPNG: vi.fn(() => png),
      getSize: vi.fn(() => ({ width: 320, height: 200 })),
    };
    const webContents = {
      capturePage: vi.fn().mockResolvedValue(nativeImage),
    };

    const result = await captureWindowedDesktopScreenshot(webContents, {
      bounds: { x: 10.4, y: 20.6, width: 319.5, height: 199.5 },
      windowId: 'chat:draft',
    });

    expect(webContents.capturePage).toHaveBeenCalledWith({ x: 10, y: 21, width: 320, height: 200 });
    expect(result.image).toMatchObject({
      mimeType: 'image/png',
      data: png.toString('base64'),
      width: 320,
      height: 200,
      bounds: { x: 10, y: 21, width: 320, height: 200 },
      windowId: 'chat:draft',
    });
    expect(result.image.capturedAt).toEqual(expect.any(String));
  });

  it('captures the full renderer page when no bounds are provided', async () => {
    const nativeImage = {
      toPNG: vi.fn(() => Buffer.from('full-windowed-png')),
      getSize: vi.fn(() => ({ width: 1200, height: 800 })),
    };
    const webContents = {
      capturePage: vi.fn().mockResolvedValue(nativeImage),
    };

    await expect(captureWindowedDesktopScreenshot(webContents)).resolves.toMatchObject({
      image: { mimeType: 'image/png', width: 1200, height: 800 },
    });
    expect(webContents.capturePage).toHaveBeenCalledWith(undefined);
  });

  it('rejects invalid crop bounds before asking Electron to capture', async () => {
    const webContents = {
      capturePage: vi.fn(),
    };

    await expect(captureWindowedDesktopScreenshot(webContents, { bounds: { x: 0, y: 0, width: 0, height: 200 } })).rejects.toThrow(
      'bounds must include finite positive width and height',
    );
    expect(webContents.capturePage).not.toHaveBeenCalled();
  });

  it('rejects oversized renderer screenshots before base64 transfer', async () => {
    const webContents = {
      capturePage: vi.fn().mockResolvedValue({
        toPNG: () => Buffer.alloc(8 * 1024 * 1024 + 1),
        getSize: () => ({ width: 4096, height: 4096 }),
      }),
    };

    await expect(captureWindowedDesktopScreenshot(webContents)).rejects.toThrow('Windowed OS screenshot is too large');
  });
});

describe('captureWindowedBrowserScreenshot', () => {
  it('normalizes a BrowserView screenshot into the Windowed OS screenshot contract', async () => {
    const result = await captureWindowedBrowserScreenshot(
      vi.fn().mockResolvedValue({
        mimeType: 'image/png',
        dataBase64: Buffer.from('browser-png').toString('base64'),
        viewport: { width: 1279.6, height: 719.5 },
        capturedAt: '2026-07-06T00:00:00.000Z',
      }),
      { windowId: 'route:browser' },
    );

    expect(result).toEqual({
      image: {
        mimeType: 'image/png',
        data: Buffer.from('browser-png').toString('base64'),
        width: 1280,
        height: 720,
        capturedAt: '2026-07-06T00:00:00.000Z',
        windowId: 'route:browser',
      },
    });
  });

  it('rejects oversized BrowserView screenshots before base64 transfer', async () => {
    await expect(
      captureWindowedBrowserScreenshot(() =>
        Promise.resolve({
          mimeType: 'image/png',
          dataBase64: Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64'),
          viewport: { width: 4096, height: 4096 },
          capturedAt: '2026-07-06T00:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('Windowed OS screenshot is too large');
  });
});
