import { describe, expect, it, vi } from 'vitest';

import { captureDesktopScreenshot } from './screenshot.js';

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
