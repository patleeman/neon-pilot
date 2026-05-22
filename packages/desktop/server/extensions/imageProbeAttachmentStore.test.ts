import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ getPiAgentRuntimeDir: vi.fn() }));

vi.mock('@neon-pilot/core', () => core);

import {
  clearImageProbeAttachmentCacheForTests,
  getImageProbeAttachments,
  getImageProbeAttachmentsById,
  MAX_IMAGE_PROBE_ATTACHMENTS_PER_PROMPT,
  rememberImageProbeAttachments,
} from './imageProbeAttachmentStore.js';

const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString('base64');
const gifData = Buffer.from('GIF89ahello', 'ascii').toString('base64');

describe('imageProbeAttachmentStore', () => {
  const runtimeDir = join(tmpdir(), `image-probe-store-${process.pid}`);

  beforeEach(() => {
    rmSync(runtimeDir, { recursive: true, force: true });
    core.getPiAgentRuntimeDir.mockReturnValue(runtimeDir);
    clearImageProbeAttachmentCacheForTests();
  });

  afterEach(() => {
    clearImageProbeAttachmentCacheForTests();
    rmSync(runtimeDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('stores supported image attachments on disk with detected mime types and sanitized names', () => {
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));

    const stored = rememberImageProbeAttachments('session/id', [
      { type: 'image', data: pngData, mimeType: 'image/unknown', name: 'Screen Shot 1.png' },
      { type: 'image', data: gifData, mimeType: 'image/png', name: 'funny.gif' },
    ]);

    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ type: 'image', mimeType: 'image/png', name: 'Screen Shot 1.png', sizeBytes: 11 });
    expect(stored[1]).toMatchObject({ type: 'image', mimeType: 'image/gif', name: 'funny.gif' });
    expect(stored.every((attachment) => existsSync(attachment.path))).toBe(true);
    expect(stored[0].path).toContain('2026-05-22T12-00-00-000Z-1-img_');
    expect(stored[0].path).toContain('Screen-Shot-1.png');

    expect(getImageProbeAttachments('session/id')).toEqual(stored);
    expect(getImageProbeAttachmentsById('session/id', [stored[1].id, 'missing'])).toEqual([stored[1]]);
  });

  it('persists metadata and reloads valid attachments after the in-memory cache is cleared', () => {
    const [stored] = rememberImageProbeAttachments('session-1', [
      { type: 'image', data: pngData, mimeType: 'image/png', name: 'note.png' },
    ]);

    clearImageProbeAttachmentCacheForTests();

    expect(getImageProbeAttachments('session-1')).toEqual([
      expect.objectContaining({ id: stored.id, path: stored.path, data: pngData, mimeType: 'image/png', name: 'note.png', sizeBytes: 11 }),
    ]);
  });

  it('ignores corrupt metadata, missing files, and non-image persisted attachments', () => {
    const sessionDir = join(runtimeDir, 'image-probes', 'session-1');
    mkdirSync(sessionDir, { recursive: true });
    const textPath = join(sessionDir, 'not-image.png');
    writeFileSync(textPath, 'not an image');
    writeFileSync(
      join(sessionDir, 'metadata.json'),
      JSON.stringify({
        version: 1,
        attachments: [
          { id: 'img_123456789abc', path: textPath, mimeType: 'image/png', sizeBytes: 12 },
          { id: 'bad', path: textPath, mimeType: 'image/png', sizeBytes: 12 },
          { id: 'img_abcdef123456', path: join(sessionDir, 'missing.png'), mimeType: 'image/png', sizeBytes: 12 },
        ],
      }),
    );

    expect(getImageProbeAttachments('session-1')).toEqual([]);

    clearImageProbeAttachmentCacheForTests();
    writeFileSync(join(sessionDir, 'metadata.json'), '{bad');
    expect(getImageProbeAttachments('session-1')).toEqual([]);
  });

  it('rejects unsupported images and too many attachments', () => {
    expect(() =>
      rememberImageProbeAttachments('session-1', [
        { type: 'image', data: Buffer.from('plain text').toString('base64'), mimeType: 'image/png' },
      ]),
    ).toThrow('Image 1 is not a supported image file.');

    const tooMany = Array.from({ length: MAX_IMAGE_PROBE_ATTACHMENTS_PER_PROMPT + 1 }, () => ({
      type: 'image' as const,
      data: pngData,
      mimeType: 'image/png',
    }));
    expect(() => rememberImageProbeAttachments('session-1', tooMany)).toThrow('Image probing supports at most 8 images per prompt.');
  });
});
