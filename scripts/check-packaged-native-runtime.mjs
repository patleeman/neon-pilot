#!/usr/bin/env node
/* eslint-env node */

import { constants, existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNTIME_FILES = [
  {
    label: 'ffmpeg binary',
    relativePath: 'Contents/Resources/app.asar.unpacked/node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg',
    executable: true,
  },
  {
    label: 'Whisper native binding',
    relativePath: 'Contents/Resources/app.asar.unpacked/node_modules/@whisper-cpp-node/darwin-arm64/whisper.node',
  },
  {
    label: 'node-pty native binding',
    relativePath: 'Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node',
  },
  {
    label: 'better-sqlite3 native binding',
    relativePath: 'Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
  },
  {
    label: 'photon WASM module',
    relativePath: 'Contents/Resources/app.asar.unpacked/node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm',
  },
];

function packageJsonPath(appPath, packagePath) {
  return resolve(appPath, 'Contents/Resources/app.asar.unpacked/node_modules', packagePath, 'package.json');
}

async function canExecute(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function checkPackagedNativeRuntime(appPath) {
  const failures = [];
  for (const runtimeFile of RUNTIME_FILES) {
    const path = resolve(appPath, runtimeFile.relativePath);
    if (!existsSync(path)) {
      failures.push(`Missing packaged ${runtimeFile.label}: ${path}`);
      continue;
    }
    if (runtimeFile.executable && !(await canExecute(path))) {
      failures.push(`Packaged ${runtimeFile.label} is not executable: ${path}`);
    }
  }

  const ffmpegPackageJson = packageJsonPath(appPath, '@ffmpeg-installer/ffmpeg');
  if (!existsSync(ffmpegPackageJson)) {
    failures.push(`Missing packaged ffmpeg installer package.json: ${ffmpegPackageJson}`);
  } else {
    try {
      const packagedRequire = createRequire(ffmpegPackageJson);
      const ffmpeg = packagedRequire('@ffmpeg-installer/ffmpeg');
      if (!ffmpeg?.path || !existsSync(ffmpeg.path)) {
        failures.push(`Packaged @ffmpeg-installer/ffmpeg resolved to a missing binary: ${String(ffmpeg?.path ?? '')}`);
      }
    } catch (error) {
      failures.push(`Packaged @ffmpeg-installer/ffmpeg failed to resolve: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

async function main() {
  const appPath = process.argv[2];
  if (!appPath) {
    console.error('Usage: node scripts/check-packaged-native-runtime.mjs /path/to/Neon Pilot.app');
    process.exit(1);
  }

  const result = await checkPackagedNativeRuntime(appPath);
  if (!result.ok) {
    console.error(result.failures.join('\n'));
    process.exit(1);
  }

  console.log(`Packaged native runtime files are present in ${appPath}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
