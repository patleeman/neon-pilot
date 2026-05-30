#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDir, '..');
const outdir = resolve(packageRoot, 'server', 'dist');

rmSync(outdir, { recursive: true, force: true });

const createRequireBanner =
  'import { createRequire as __paServerCreateRequire } from "node:module"; const require = __paServerCreateRequire(import.meta.url);';

const extensionApiAliasPlugin = {
  name: 'extension-api-aliases',
  setup(build) {
    build.onResolve({ filter: /^@neon-pilot\/extensions\/host-view-components$/ }, () => ({
      path: resolve(packageRoot, '..', 'extensions', 'src', 'host-view-components.ts'),
    }));
  },
};

const sharedEsbuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: false,
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
  external: [
    '@xenova/transformers',
    'better-sqlite3',
    'electron',
    'esbuild',
    'fsevents',
    'node-pty',
    // AI provider SDKs — only needed when the user configures that provider.
    // Externalizing them keeps the cold-start bundle small and lets Node.js
    // load them lazily from node_modules on first use.
    'openai',
    '@anthropic-ai/sdk',
    '@google/generative-ai',
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-sagemaker-runtime',
    '@cohere-ai/cohere-ai',
    'cohere-ai',
    '@mistralai/mistralai',
    // jiti bundles a full Babel copy (~2MB of parser/transformer code).
    // Only used by @earendil-works/pi-coding-agent for runtime TypeScript
    // compilation; let Node.js load it from node_modules on demand.
    'jiti',
  ],
  plugins: [extensionApiAliasPlugin],
};

const bundleOutputs = [
  resolve(outdir, 'app/localApi.js'),      // Thin bootstrap (fast load)
  resolve(outdir, 'app/localApiFull.js'),  // Full handler module (lazy-loaded)
  resolve(outdir, 'conversations/conversationInspectWorker.js'),
  resolve(outdir, 'traces/traceWorker.js'),
  resolve(outdir, 'daemon/index.js'),
  resolve(outdir, 'daemon/background-agent-runner.js'),
  resolve(outdir, 'core/index.js'),
];

const backendApiLazyModuleEntries = [
  ['conversations/conversationAutoTitle.js', 'server/conversations/conversationAutoTitle.ts'],
  ['conversations/conversationCwd.js', 'server/conversations/conversationCwd.ts'],
  ['conversations/conversationInspectWorkerClient.js', 'server/conversations/conversationInspectWorkerClient.ts'],
  ['conversations/conversationSearchIndex.js', 'server/conversations/conversationSearchIndex.ts'],
  ['conversations/conversationService.js', 'server/conversations/conversationService.ts'],
  ['conversations/conversationSessionCapability.js', 'server/conversations/conversationSessionCapability.ts'],
  ['conversations/conversationSummaries.js', 'server/conversations/conversationSummaries.ts'],
  ['conversations/liveSessions.js', 'server/conversations/liveSessions.ts'],
  ['conversations/sessionExchange.js', 'server/conversations/sessionExchange.ts'],
  ['conversations/sessions.js', 'server/conversations/sessions.ts'],
  ['automation/attentionEvents.js', 'server/automation/attentionEvents.ts'],
  ['automation/deferredResumes.js', 'server/automation/deferredResumes.ts'],
  ['automation/humanDateTime.js', 'server/automation/humanDateTime.ts'],
  ['automation/scheduledTasks.js', 'server/automation/scheduledTasks.ts'],
  ['automation/scheduledTaskThreads.js', 'server/automation/scheduledTaskThreads.ts'],
  ['automation/store.js', 'server/automation/store.ts'],
  ['knowledge/memoryDocs.js', 'server/knowledge/memoryDocs.ts'],
  ['prompts/promptTemplateInventory.js', 'server/prompts/promptTemplateInventory.ts'],
  ['prompt-assembly/promptAssembly.js', 'server/prompt-assembly/promptAssembly.ts'],
  ['prompt-assembly/instructionInventory.js', 'server/prompt-assembly/instructionInventory.ts'],
  ['skills/skillInventory.js', 'server/skills/skillInventory.ts'],
  ['settings/settingsStore.js', 'server/settings/settingsStore.ts'],
  ['shared/appEvents.js', 'server/shared/appEvents.ts'],
  ['tools/toolGateway.js', 'server/tools/toolGateway.ts'],
  ['tools/toolInventory.js', 'server/tools/toolInventory.ts'],
  ['traces/appTelemetry.js', 'server/traces/appTelemetry.ts'],
  ['traces/tracePersistence.js', 'server/traces/tracePersistence.ts'],
  ['extensions/extensionBackend.js', 'server/extensions/extensionBackend.ts'],
  ['extensions/extensionCatalog.js', 'server/extensions/extensionCatalog.ts'],
  ['extensions/extensionConversationMetadata.js', 'server/extensions/extensionConversationMetadata.ts'],
  ['extensions/extensionDoctor.js', 'server/extensions/extensionDoctor.ts'],
  ['extensions/extensionLifecycle.js', 'server/extensions/extensionLifecycle.ts'],
  ['extensions/extensionRegistry.js', 'server/extensions/extensionRegistry.ts'],
  ['extensions/runtimeAgentHooks.js', 'server/extensions/runtimeAgentHooks.ts'],
];

await Promise.all([
  // Thin bootstrap — copied directly without bundling (~9KB, loads in ~5ms).
  // Lazy-imports localApiFull.js on first handler call.
  (() => {
    mkdirSync(resolve(outdir, 'app'), { recursive: true });
    copyFileSync(resolve(packageRoot, 'server/app/localApiBoot.js'), bundleOutputs[0]);
  })(),
  // Full handler module — loaded lazily by bootstrap on first API call.
  build({
    ...sharedEsbuildOptions,
    entryPoints: [resolve(packageRoot, 'server/app/localApi.ts')],
    outfile: bundleOutputs[1],
    banner: {
      js: createRequireBanner,
    },
  }),
  // Conversation inspect worker — runs synchronous file I/O off the main thread
  build({
    ...sharedEsbuildOptions,
    entryPoints: [resolve(packageRoot, 'server/conversations/conversationInspectWorker.ts')],
    outfile: bundleOutputs[2],
    banner: {
      js: createRequireBanner,
    },
  }),
  // Trace worker — runs all trace-db writes off the main thread
  build({
    ...sharedEsbuildOptions,
    entryPoints: [resolve(packageRoot, 'server/traces/traceWorker.ts')],
    outfile: bundleOutputs[3],
  }),
  // Daemon barrel used by @neon-pilot/daemon.
  build({
    ...sharedEsbuildOptions,
    entryPoints: [resolve(packageRoot, 'server/daemon/index.ts')],
    outfile: bundleOutputs[4],
    banner: {
      js: createRequireBanner,
    },
  }),
  // Durable background agent runner spawned by the daemon for subagents and scheduled agent runs.
  build({
    ...sharedEsbuildOptions,
    entryPoints: [resolve(packageRoot, 'server/daemon/background-agent-runner.ts')],
    outfile: bundleOutputs[5],
    banner: {
      js: createRequireBanner,
    },
  }),
  // Package the core runtime behind a stable app.asar path so prebuilt extension
  // backends can resolve @neon-pilot/core without relying on workspace
  // node_modules symlinks that do not exist in signed apps.
  build({
    ...sharedEsbuildOptions,
    entryPoints: [resolve(packageRoot, '..', 'core/src/index.ts')],
    outfile: bundleOutputs[6],
    banner: {
      js: createRequireBanner,
    },
  }),
  // All lazy-loaded backend API modules in a single split build. esbuild extracts
  // shared code (AI SDKs, zod, highlight.js, …) into shared chunks under
  // server/dist/chunks/ instead of duplicating ~5MB into every bundle separately.
  build({
    ...sharedEsbuildOptions,
    splitting: true,
    entryPoints: backendApiLazyModuleEntries.map(([, entryPoint]) => resolve(packageRoot, entryPoint)),
    // outbase maps input paths to output paths: server/conversations/foo.ts → dist/conversations/foo.js
    outbase: resolve(packageRoot, 'server'),
    outdir: outdir,
    chunkNames: 'chunks/[hash]',
    banner: {
      js: createRequireBanner,
    },
  }),
]);

// Add lazy module entry point outputs to the known bundle list.
bundleOutputs.push(...backendApiLazyModuleEntries.map(([outfile]) => resolve(outdir, outfile)));

// Pick up the shared chunk files emitted by the split build.
const chunkDir = resolve(outdir, 'chunks');
const chunkFiles = existsSync(chunkDir)
  ? readdirSync(chunkDir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => resolve(chunkDir, f))
  : [];
bundleOutputs.push(...chunkFiles);

// jiti's bundled Babel copy contains a duplicate TypeScript heritage switch case. When
// another esbuild pass parses our server bundle, it reports a noisy duplicate-case warning.
const removeDuplicateTypeScriptHeritageCase = (bundleOutput) => {
  const source = readFileSync(bundleOutput, 'utf-8');
  const cleaned = source.replaceAll(
    'case"TSExpressionWithTypeArguments":case"TSExpressionWithTypeArguments":',
    'case"TSExpressionWithTypeArguments":',
  );

  if (cleaned !== source) {
    writeFileSync(bundleOutput, cleaned);
  }
};

for (const bundleOutput of bundleOutputs) {
  removeDuplicateTypeScriptHeritageCase(bundleOutput);
}

const jsdomXhrSyncWorker = resolve(packageRoot, 'node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js');
const piCodingAgentRoot = resolve(packageRoot, 'node_modules/@earendil-works/pi-coding-agent');
const piCodingAgentPackageJson = resolve(piCodingAgentRoot, 'package.json');
const piCodingAgentReadme = resolve(piCodingAgentRoot, 'README.md');
const piCodingAgentPackageMetadata = existsSync(piCodingAgentPackageJson)
  ? JSON.parse(readFileSync(piCodingAgentPackageJson, 'utf-8'))
  : { name: '@earendil-works/pi-coding-agent', version: '0.0.0', piConfig: { configDir: '.pi' } };
const bundledRuntimePackageJson = {
  name: piCodingAgentPackageMetadata.name ?? '@earendil-works/pi-coding-agent',
  version: piCodingAgentPackageMetadata.version ?? '0.0.0',
  piConfig: piCodingAgentPackageMetadata.piConfig ?? { configDir: '.pi' },
  type: 'module',
};
const desktopPackageMetadata = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf-8'));
const bundledPackageJsonByDir = new Map([
  [
    resolve(outdir, 'daemon'),
    {
      name: '@neon-pilot/daemon',
      version: desktopPackageMetadata.version ?? '0.0.0',
      type: 'module',
      main: './index.js',
    },
  ],
  [
    resolve(outdir, 'core'),
    {
      name: '@neon-pilot/core',
      version: desktopPackageMetadata.version ?? '0.0.0',
      type: 'module',
      main: './index.js',
    },
  ],
]);

// Track processed dirs to avoid redundant writes when multiple bundles share a dir.
const processedOutputDirs = new Set();

for (const bundleOutput of bundleOutputs) {
  const outputDir = dirname(bundleOutput);
  if (processedOutputDirs.has(outputDir)) continue;
  processedOutputDirs.add(outputDir);

  mkdirSync(outputDir, { recursive: true });

  // Only copy xhr-sync-worker.js to dirs that contain a bundle referencing it.
  // jsdom spawns this as a Worker thread; the file must be on-disk next to the
  // bundle that has the "./xhr-sync-worker.js" string.
  const bundlesInDir = bundleOutputs.filter((f) => dirname(f) === outputDir);
  const needsXhrWorker = bundlesInDir.some((f) => {
    try {
      return readFileSync(f, 'utf-8').includes('"./xhr-sync-worker.js"');
    } catch {
      return false;
    }
  });
  if (needsXhrWorker) {
    copyFileSync(jsdomXhrSyncWorker, resolve(outputDir, 'xhr-sync-worker.js'));
  }

  const packageJson = bundledPackageJsonByDir.get(outputDir) ?? bundledRuntimePackageJson;
  writeFileSync(resolve(outputDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
}

if (existsSync(piCodingAgentReadme)) {
  copyFileSync(piCodingAgentReadme, resolve(outdir, 'app', 'README.md'));
}
