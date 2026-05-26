import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { installExtension } from './install-extension.mjs';

function makeExtension(root, id, marker) {
  const dir = join(root, id);
  mkdirSync(join(dir, 'dist', 'chunks'), { recursive: true });
  writeFileSync(join(dir, 'extension.json'), JSON.stringify({ id, marker }));
  writeFileSync(join(dir, 'dist', 'chunks', 'chunk.js'), `export default ${JSON.stringify(marker)};\n`);
  return dir;
}

describe('install-extension', () => {
  it('installs through a temporary directory before replacing the existing package', () => {
    const root = mkdtempSync(join(tmpdir(), `install-extension-${process.pid}-`));
    const source = makeExtension(root, 'source', 'next');
    const destination = makeExtension(root, 'system-test', 'old');

    installExtension(source, destination);

    expect(readFileSync(join(destination, 'extension.json'), 'utf8')).toContain('"marker":"next"');
    expect(readFileSync(join(destination, 'dist', 'chunks', 'chunk.js'), 'utf8')).toContain('next');
  });

  it('keeps the existing package when copying the replacement fails', () => {
    const root = mkdtempSync(join(tmpdir(), `install-extension-fail-${process.pid}-`));
    const source = makeExtension(root, 'source', 'next');
    const destination = makeExtension(root, 'system-test', 'old');

    expect(() =>
      installExtension(source, destination, {
        copy() {
          throw new Error('copy failed');
        },
      }),
    ).toThrow('copy failed');

    expect(existsSync(join(destination, 'extension.json'))).toBe(true);
    expect(readFileSync(join(destination, 'extension.json'), 'utf8')).toContain('"marker":"old"');
  });
});
