#!/usr/bin/env node
/* eslint-env node */
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(fileURLToPath(import.meta.url), '..', '..');
const packageNodeModules = resolve(dir, 'node_modules');
const rootNodeModules = resolve(dir, '..', '..', 'node_modules');
const nodePaths = [packageNodeModules, rootNodeModules];

// Tauri supervises this sidecar from Rust. It owns the product backend, daemon
// runtime, and JS extension execution while host-authority calls route back to
// Rust over the host-core RPC bridge.
await build({
  entryPoints: [resolve(dir, 'src', 'backend', 'local-backend-child.ts')],
  outfile: resolve(dir, 'dist', 'backend', 'local-backend-child.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: {
    js: `import { createRequire as __paBackendCreateRequire } from 'node:module';var require=__paBackendCreateRequire(import.meta.url);`,
  },
  external: ['fsevents'],
  logLevel: 'info',
  nodePaths,
});
