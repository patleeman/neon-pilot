#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);

function usage() {
  console.error(`Usage: pa-extension <command> [args]

Commands:
  build [--sourcemap] <extension-dir>   Build frontend/backend bundles into dist/
  doctor <extension-dir>                Validate a built extension package
  pack <extension-dir> [--out file]     Zip a built extension package
`);
}

function runNodeScript(script, scriptArgs) {
  const result = spawnSync(process.execPath, [join(repoRoot, script), ...scriptArgs], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

switch (command) {
  case 'build':
    runNodeScript('scripts/extension-build.mjs', args);
    break;
  case 'doctor':
    runNodeScript('scripts/check-packaged-extensions.mjs', args);
    break;
  case 'pack':
    runNodeScript('scripts/extension-pack.mjs', args);
    break;
  case undefined:
  case '-h':
  case '--help':
    usage();
    process.exit(command ? 0 : 1);
    break;
  default:
    console.error(`Unknown pa-extension command: ${command}`);
    usage();
    process.exit(1);
}
