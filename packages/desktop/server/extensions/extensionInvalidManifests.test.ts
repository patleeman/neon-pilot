import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fallbackInvalidExtensionId, readInvalidExtensionManifestMetadata } from './extensionInvalidManifests';

describe('extensionInvalidManifests', () => {
  it('derives fallback ids from package roots', () => {
    expect(fallbackInvalidExtensionId('/tmp/extensions/broken-board')).toBe('broken-board');
    expect(fallbackInvalidExtensionId('')).toBe('invalid-extension');
  });

  it('reads id and name metadata from malformed manifests when present', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-invalid-ext-'));
    const manifestPath = join(root, 'extension.json');
    writeFileSync(manifestPath, JSON.stringify({ id: ' broken ', name: ' Broken Extension ' }));

    expect(readInvalidExtensionManifestMetadata(manifestPath, root)).toEqual({ id: 'broken', name: 'Broken Extension' });
  });

  it('falls back to package root metadata for unreadable or incomplete manifests', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-invalid-ext-'));
    const manifestPath = join(root, 'extension.json');
    writeFileSync(manifestPath, '{not json');

    expect(readInvalidExtensionManifestMetadata(manifestPath, root)).toEqual({ id: root.split('/').at(-1), name: root.split('/').at(-1) });
  });
});
