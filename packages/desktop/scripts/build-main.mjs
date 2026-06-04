#!/usr/bin/env node
/* eslint-env node */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const dir = resolve(fileURLToPath(import.meta.url), '..', '..');
const packageNodeModules = resolve(dir, 'node_modules');
const rootNodeModules = resolve(dir, '..', '..', 'node_modules');
const extensionsPackageRoot = resolve(dir, '..', 'extensions');
const nodePaths = [packageNodeModules, rootNodeModules];

const extensionApiAliasPlugin = {
  name: 'extension-api-aliases',
  setup(build) {
    build.onResolve({ filter: /^@neon-pilot\/extensions\/host-view-components$/ }, () => ({
      path: resolve(extensionsPackageRoot, 'src', 'host-view-components.ts'),
    }));
  },
};

const sharedNodeBuildOptions = {
  plugins: [extensionApiAliasPlugin],
};

// Build main process bundle
await build({
  entryPoints: [resolve(dir, 'src', 'main.ts')],
  outdir: resolve(dir, 'dist'),
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: {
    js: `import { createRequire as __paCreateRequire } from 'node:module';var require=__paCreateRequire(import.meta.url);`,
  },
  external: ['electron', 'fsevents', 'node-pty'],
  logLevel: 'info',
  nodePaths,
  ...sharedNodeBuildOptions,
});

// Build preload script (must be CommonJS for Electron sandbox)
await build({
  entryPoints: [resolve(dir, 'src', 'preload.cts')],
  outfile: resolve(dir, 'dist', 'preload.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  logLevel: 'info',
  nodePaths,
  ...sharedNodeBuildOptions,
});

// Build local API workers (runs the server bundle in worker threads)
await build({
  entryPoints: [resolve(dir, 'src', 'local-api-worker.ts')],
  outfile: resolve(dir, 'dist', 'local-api-worker.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['electron'],
  logLevel: 'info',
  nodePaths,
  ...sharedNodeBuildOptions,
});
await build({
  entryPoints: [resolve(dir, 'src', 'readonly-local-api-worker.ts')],
  outfile: resolve(dir, 'dist', 'readonly-local-api-worker.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['electron'],
  logLevel: 'info',
  nodePaths,
  ...sharedNodeBuildOptions,
});

// Build local backend child process. Electron main supervises this process; it
// owns the product backend and daemon runtime.
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
  external: ['electron', 'fsevents', 'node-pty'],
  logLevel: 'info',
  nodePaths,
  ...sharedNodeBuildOptions,
});

// Build extension host child process. This is the future extension backend
// execution lane; product-runtime traffic remains on the in-process adapter
// until capability channels are ready for function-bearing contexts.
await build({
  entryPoints: [resolve(dir, 'src', 'backend', 'extension-host-child.ts')],
  outfile: resolve(dir, 'dist', 'backend', 'extension-host-child.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: {
    js: `import { createRequire as __paExtensionHostCreateRequire } from 'node:module';var require=__paExtensionHostCreateRequire(import.meta.url);`,
  },
  external: ['electron', 'fsevents', 'node-pty'],
  logLevel: 'info',
  nodePaths,
  ...sharedNodeBuildOptions,
});

// Build extension backend worker. The extension host will use this lane for
// per-extension backend imports first, then grow it toward handler execution
// as live host capabilities move behind serializable channels.
await build({
  entryPoints: [resolve(dir, 'server', 'extensions', 'extensionBackendWorker.ts')],
  outfile: resolve(dir, 'server', 'dist', 'extensions', 'extensionBackendWorker.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: {
    js: `import { createRequire as __paExtensionBackendWorkerCreateRequire } from 'node:module';var require=__paExtensionBackendWorkerCreateRequire(import.meta.url);`,
  },
  external: ['electron', 'fsevents', 'node-pty'],
  logLevel: 'info',
  nodePaths,
  ...sharedNodeBuildOptions,
});
