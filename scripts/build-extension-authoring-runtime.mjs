#!/usr/bin/env node
/* eslint-env node */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(repoRoot, 'dist/extension-authoring');
const sdkRoot = join(outputRoot, 'authoring-sdk');

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(join(outputRoot, 'scripts'), { recursive: true });
mkdirSync(join(outputRoot, 'vendor'), { recursive: true });
mkdirSync(join(sdkRoot, 'frontend'), { recursive: true });
mkdirSync(join(sdkRoot, 'backend'), { recursive: true });
cpSync(join(repoRoot, 'scripts/extension-build.mjs'), join(outputRoot, 'scripts/extension-build.mjs'));
writeFileSync(join(outputRoot, 'package.json'), '{"type":"module"}\n');

const frontendEntries = {
  host: 'packages/desktop/ui/src/extensions/host.ts',
  ui: 'packages/desktop/ui/src/extensions/ui.ts',
  workbench: 'packages/desktop/ui/src/extensions/workbench.ts',
  data: 'packages/desktop/ui/src/extensions/data.ts',
  settings: 'packages/desktop/ui/src/extensions/settings.ts',
  'host-view-components': 'packages/desktop/ui/src/extensions/hostViewComponents.tsx',
  'workbench-artifacts': 'packages/desktop/ui/src/extensions/workbench-artifacts.ts',
  'workbench-browser': 'packages/desktop/ui/src/extensions/workbench-browser.ts',
  'workbench-diffs': 'packages/desktop/ui/src/extensions/workbench-diffs.ts',
  'workbench-files': 'packages/desktop/ui/src/extensions/workbench-files.ts',
  'workbench-runs': 'packages/desktop/ui/src/extensions/workbench-runs.ts',
  'workbench-transcript': 'packages/desktop/ui/src/extensions/workbench-transcript.ts',
  excalidraw: 'packages/extensions/src/excalidraw.ts',
  composer: 'packages/extensions/src/composer.ts',
};

await build({
  entryPoints: Object.fromEntries(Object.entries(frontendEntries).map(([name, path]) => [name, resolve(repoRoot, path)])),
  outdir: join(sdkRoot, 'frontend'),
  bundle: true,
  splitting: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  plugins: [
    {
      name: 'empty-system-extension-modules',
      setup(context) {
        context.onResolve({ filter: /^\.\/systemExtensionModules$/ }, () => ({
          path: 'empty-system-extension-modules',
          namespace: 'authoring-runtime',
        }));
        context.onLoad({ filter: /.*/, namespace: 'authoring-runtime' }, () => ({
          contents: 'export const systemExtensionModules = new Map();',
          loader: 'js',
        }));
      },
    },
  ],
});

const backendRoot = resolve(repoRoot, 'packages/desktop/server/extensions/backendApi');
const publicBackendSubpaths = new Set([
  'agent',
  'artifacts',
  'audio',
  'automations',
  'browser',
  'checkpoints',
  'cli',
  'compaction',
  'conversations',
  'documents',
  'events',
  'extensions',
  'gateways',
  'images',
  'index',
  'knowledge',
  'mcp',
  'modelGateway',
  'promptAssembly',
  'runs',
  'runtime',
  'settings',
  'skills',
  'telemetry',
  'terminal',
  'tools',
  'transcription',
  'videos',
  'webContent',
]);
const backendEntries = Object.fromEntries(
  readdirSync(backendRoot)
    .filter((name) => name.endsWith('.ts') && publicBackendSubpaths.has(name.slice(0, -3)))
    .map((name) => [name.slice(0, -3), join(backendRoot, name)]),
);
backendEntries['host-view-components'] = resolve(repoRoot, 'packages/extensions/src/host-view-components.ts');

await build({
  entryPoints: backendEntries,
  outdir: join(sdkRoot, 'backend'),
  bundle: true,
  splitting: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
});

cpSync(resolve(repoRoot, 'node_modules/esbuild'), resolve(outputRoot, 'vendor/esbuild'), { recursive: true, dereference: true });
// pnpm exposes a workspace-only self-link inside this package. It is not used by
// esbuild's JS API and becomes an invalid absolute symlink in a packaged app.
rmSync(resolve(outputRoot, 'vendor/esbuild/esbuild'), { recursive: true, force: true });

const esbuildVersion = JSON.parse(readFileSync(resolve(repoRoot, 'node_modules/esbuild/package.json'), 'utf8')).version;
for (const packageName of ['@esbuild/darwin-arm64', '@esbuild/darwin-x64']) {
  const source = resolve(repoRoot, `node_modules/.pnpm/${packageName.replace('/', '+')}@${esbuildVersion}/node_modules/${packageName}`);
  if (existsSync(source)) {
    cpSync(resolve(source, 'bin/esbuild'), resolve(outputRoot, 'vendor', `esbuild-bin-${packageName.replace('@esbuild/', '')}`));
  }
}

console.log(`Built packaged extension authoring runtime at ${outputRoot}`);
