import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkPackagedNativeRuntime } from './check-packaged-native-runtime.mjs';

function writeFixtureFile(root, relativePath, contents = '') {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

function createPackagedAppFixture({ includeFfmpeg = true } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'neon-packaged-runtime-'));
  const appPath = resolve(root, 'Neon Pilot.app');

  if (includeFfmpeg) {
    const ffmpegPath = writeFixtureFile(appPath, 'Contents/Resources/app.asar.unpacked/node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg');
    chmodSync(ffmpegPath, 0o755);
  }
  writeFixtureFile(appPath, 'Contents/Resources/app.asar.unpacked/node_modules/@whisper-cpp-node/darwin-arm64/whisper.node');
  writeFixtureFile(appPath, 'Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node');
  writeFixtureFile(appPath, 'Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node');
  writeFixtureFile(appPath, 'Contents/Resources/app.asar.unpacked/node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm');
  writeFixtureFile(
    appPath,
    'Contents/Resources/app.asar.unpacked/node_modules/@ffmpeg-installer/ffmpeg/package.json',
    '{"name":"@ffmpeg-installer/ffmpeg","main":"index.js"}',
  );
  writeFixtureFile(
    appPath,
    'Contents/Resources/app.asar.unpacked/node_modules/@ffmpeg-installer/ffmpeg/index.js',
    "module.exports = { path: require('path').join(__dirname, '..', 'darwin-arm64', 'ffmpeg') };",
  );

  return appPath;
}

describe('packaged native runtime check', () => {
  it('accepts a packaged app containing required runtime payloads', async () => {
    const result = await checkPackagedNativeRuntime(createPackagedAppFixture());
    expect(result).toEqual({ ok: true, failures: [] });
  });

  it('flags a missing platform ffmpeg binary', async () => {
    const result = await checkPackagedNativeRuntime(createPackagedAppFixture({ includeFfmpeg: false }));
    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain('Missing packaged ffmpeg binary');
    expect(result.failures.join('\n')).toContain('resolved to a missing binary');
  });
});
