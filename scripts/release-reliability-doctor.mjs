#!/usr/bin/env node
/* eslint-env node */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(repoRoot, 'package.json');
const installableExtensionCatalogPath = join(repoRoot, 'packages/desktop/server/extensions/installableExtensionCatalog.generated.ts');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseVersion(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.').filter(Boolean) ?? [],
  };
}

function compareIdentifier(left, right) {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null;
  if (leftNumber !== null && rightNumber !== null) return Math.sign(leftNumber - rightNumber);
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left.localeCompare(right);
}

function compareVersions(left, right) {
  if (left.major !== right.major) return Math.sign(left.major - right.major);
  if (left.minor !== right.minor) return Math.sign(left.minor - right.minor);
  if (left.patch !== right.patch) return Math.sign(left.patch - right.patch);
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const compared = compareIdentifier(leftPart, rightPart);
    if (compared !== 0) return compared;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = comparator.match(/^(>=|<=|>|<|=)?\s*v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  if (!match) return null;
  const target = parseVersion(match[2]);
  if (!target) return null;
  const compared = compareVersions(version, target);
  const operator = match[1] ?? '=';
  if (operator === '>=') return compared >= 0;
  if (operator === '<=') return compared <= 0;
  if (operator === '>') return compared > 0;
  if (operator === '<') return compared < 0;
  return compared === 0;
}

export function satisfiesVersionRange(versionValue, rangeValue) {
  const version = parseVersion(versionValue);
  if (!version) return null;
  const tokens = String(rangeValue ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0 || tokens.some((token) => token === '*' || token.toLowerCase() === 'x')) return true;
  let sawComparableToken = false;
  for (const token of tokens) {
    const result = satisfiesComparator(version, token);
    if (result === null) return null;
    sawComparableToken = true;
    if (!result) return false;
  }
  return sawComparableToken ? true : null;
}

function listExtensionManifests(root = join(repoRoot, 'extensions')) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, 'extension.json'))
    .filter((path) => existsSync(path))
    .sort();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectAdminSurfaceInventory(manifests = listExtensionManifests().map((path) => ({ path, manifest: readJson(path) }))) {
  const tools = [];
  const cliCommands = [];
  for (const { path, manifest } of manifests) {
    const extensionId = manifest.id;
    for (const tool of asArray(manifest.contributes?.tools)) {
      tools.push({ extensionId, manifestPath: path, id: tool.id, name: tool.name, description: tool.description ?? '' });
    }
    for (const command of asArray(manifest.contributes?.cliCommands)) {
      cliCommands.push({ extensionId, manifestPath: path, id: command.id, command: command.command, action: command.action });
    }
  }
  return { tools, cliCommands };
}

function isExplicitNonNeonPilotAdminSurface(tool) {
  const description = String(tool.description ?? '').toLowerCase();
  return (
    tool.extensionId === 'system-mcp' &&
    tool.name === 'mcp' &&
    description.includes('not a neon pilot self-admin surface') &&
    (description.includes('use neon_pilot') || description.includes('use the canonical neon_pilot tool'))
  );
}

export function checkUnifiedAdminSurface(manifests) {
  const inventory = collectAdminSurfaceInventory(manifests);
  const failures = [];
  const neonPilotTools = inventory.tools.filter((tool) => tool.name === 'neon_pilot');
  if (neonPilotTools.length !== 1 || neonPilotTools[0]?.extensionId !== 'system-neon-pilot-admin-cli') {
    failures.push(
      `Expected exactly one internal neon_pilot tool from system-neon-pilot-admin-cli; found ${JSON.stringify(neonPilotTools)}`,
    );
  }

  const adminLikeTools = inventory.tools.filter((tool) => {
    if (isExplicitNonNeonPilotAdminSurface(tool)) return false;
    const haystack = `${tool.name ?? ''} ${tool.id ?? ''} ${tool.description ?? ''}`.toLowerCase();
    return /(^|[_-])admin($|[_-])|(^|[_-])admin-like|admin tool|admin surface|self-admin|self admin|control plane|control-plane/.test(
      haystack,
    );
  });
  for (const tool of adminLikeTools) {
    if (tool.name !== 'neon_pilot') failures.push(`Unexpected internal admin-like tool ${tool.name ?? tool.id} in ${tool.extensionId}`);
  }

  const mcpManifest = manifests
    ? manifests.find((entry) => entry.manifest?.id === 'system-mcp')
    : listExtensionManifests()
        .map((path) => ({ path, manifest: readJson(path) }))
        .find((entry) => entry.manifest.id === 'system-mcp');
  const mcpTools = asArray(mcpManifest?.manifest?.contributes?.tools);
  for (const tool of mcpTools) {
    const haystack = `${tool.name ?? ''} ${tool.id ?? ''} ${tool.description ?? ''}`.toLowerCase();
    if (haystack.includes('self-admin') && !isExplicitNonNeonPilotAdminSurface({ ...tool, extensionId: 'system-mcp' })) {
      failures.push('system-mcp describes itself as a Neon Pilot self-admin surface.');
    }
  }

  const packageJson = readJson(join(repoRoot, 'package.json'));
  if (packageJson.bin?.['neon-pilot'] !== './scripts/neon-pilot-cli.mjs')
    failures.push('package.json must expose external neon-pilot CLI bin.');
  return { ok: failures.length === 0, failures, inventory };
}

function findManifest(manifests, extensionId) {
  return (manifests ?? listExtensionManifests().map((path) => ({ path, manifest: readJson(path) }))).find(
    (entry) => entry.manifest.id === extensionId,
  )?.manifest;
}

function commandNames(manifest) {
  return asArray(manifest?.contributes?.cliCommands)
    .map((entry) => entry.command)
    .filter(Boolean);
}

function toolNames(manifest) {
  return asArray(manifest?.contributes?.tools)
    .map((entry) => entry.name)
    .filter(Boolean);
}

function backendActionInputActions(manifest, actionId) {
  const action = asArray(manifest?.backend?.actions).find((entry) => entry.id === actionId || entry.handler === actionId);
  return asArray(action?.worker?.inputActions);
}

export function checkConversationAdminFlows(manifests) {
  const failures = [];
  const manifest = findManifest(manifests, 'system-conversation-tools');
  const commands = commandNames(manifest);
  for (const command of [
    'conversations create',
    'conversations inspect',
    'conversations open add',
    'conversations open list',
    'conversations open active',
  ]) {
    if (!commands.includes(command)) failures.push(`Conversation CLI missing ${command}.`);
  }
  const agentExtension = readFileSync(join(repoRoot, 'extensions/system-conversation-tools/src/conversationAgentExtension.ts'), 'utf8');
  if (!agentExtension.includes("name: 'conversation_admin'")) failures.push('Conversation admin agent tool missing.');
  const actions = backendActionInputActions(manifest, 'conversationTool');
  for (const action of ['create', 'inspect', 'workspace_open_update']) {
    if (!actions.includes(action)) failures.push(`Conversation backend worker missing ${action}.`);
  }
  return { ok: failures.length === 0, failures };
}

export function checkDeferredResumeLifecycle(manifests) {
  const failures = [];
  const manifest = findManifest(manifests, 'system-conversation-tools');
  if (!backendActionInputActions(manifest, 'conversationTool').includes('deferred_resume')) {
    failures.push('Conversation backend worker missing deferred_resume.');
  }
  const schema = readFileSync(join(repoRoot, 'extensions/system-conversation-tools/src/conversationToolSchema.ts'), 'utf8');
  for (const token of ['deferred_resume', 'deferredAction', 'add', 'list', 'cancel']) {
    if (!schema.includes(token)) failures.push(`Deferred resume schema missing ${token}.`);
  }
  const lifecycle = readFileSync(join(repoRoot, 'packages/desktop/server/runs/deferred-resume-conversations.ts'), 'utf8');
  for (const event of ['scheduled', 'ready', 'retry_scheduled', 'completed', 'cancelled']) {
    if (!lifecycle.includes(`conversation.deferred_resume.${event}`)) failures.push(`Deferred resume lifecycle missing ${event} event.`);
  }
  return { ok: failures.length === 0, failures };
}

export function checkExtensionStateSanity(manifests) {
  const failures = [];
  const manifest = findManifest(manifests, 'system-extension-manager');
  const commands = commandNames(manifest);
  for (const command of ['extensions list', 'extensions validate', 'extensions enable', 'extensions disable', 'extensions delete']) {
    if (!commands.includes(command)) failures.push(`Extension manager CLI missing ${command}.`);
  }
  const actions = backendActionInputActions(manifest, 'manageExtension');
  for (const action of ['list', 'validate', 'enable', 'disable', 'delete']) {
    if (!actions.includes(action)) failures.push(`Extension manager worker missing ${action}.`);
  }
  const backend = readFileSync(join(repoRoot, 'extensions/system-extension-manager/src/backend.ts'), 'utf8');
  if (!backend.includes("command === 'extensions delete' || command === 'extensions uninstall'")) {
    failures.push('Extension uninstall alias no longer routes to delete.');
  }
  if (!backend.includes('ctx.extensions?.setEnabled?.(extensionId'))
    failures.push('Extension enable/disable no longer calls host state API.');
  return { ok: failures.length === 0, failures };
}

export function checkHeartbeatConfig(manifests) {
  const failures = [];
  const admin = findManifest(manifests, 'system-neon-pilot-admin-cli');
  const tool = asArray(admin?.contributes?.tools).find((entry) => entry.name === 'neon_pilot');
  const commands = tool?.inputSchema?.properties?.command?.enum ?? [];
  for (const command of ['heartbeat_start', 'heartbeat_list', 'heartbeat_stop']) {
    if (!commands.includes(command)) failures.push(`neon_pilot schema missing ${command}.`);
  }
  const cliCommands = asArray(admin?.contributes?.cliCommands).map((entry) => entry.command);
  for (const command of ['heartbeats start', 'heartbeats list', 'heartbeats stop']) {
    if (!cliCommands.includes(command)) failures.push(`Admin CLI missing ${command}.`);
  }
  const backend = readFileSync(join(repoRoot, 'extensions/system-neon-pilot-admin-cli/src/backend.ts'), 'utf8');
  if (!backend.includes('return `*/${minutes} * * * *`;')) failures.push('Heartbeat cron helper no longer emits */N * * * * expressions.');
  if (!backend.includes("policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }]"))
    failures.push('Heartbeat start/stop must retain overlap skip policy.');
  if (!backend.includes('applyScheduledTaskThreadBinding'))
    failures.push('Heartbeat start must bind scheduled task to a conversation thread.');
  return { ok: failures.length === 0, failures };
}

export function collectInstallableCatalogCompatibility(source = readFileSync(installableExtensionCatalogPath, 'utf8')) {
  return [
    ...source.matchAll(
      /\{\s*id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?compatibility:\s*\{[\s\S]*?neonPilot:\s*'([^']+)'[\s\S]*?\}\s*,?\s*\}/g,
    ),
  ].map((match) => ({
    id: match[1],
    name: match[2],
    neonPilot: match[3],
  }));
}

export function checkInstallableCatalogCompatibility(
  appVersion = readJson(packageJsonPath).version,
  entries = collectInstallableCatalogCompatibility(),
) {
  const failures = [];
  for (const entry of entries) {
    const compatible = satisfiesVersionRange(appVersion, entry.neonPilot);
    if (compatible === false) {
      failures.push(
        `Installable catalog entry ${entry.id} (${entry.name}) requires Neon Pilot ${entry.neonPilot}, but package.json is ${appVersion}.`,
      );
    } else if (compatible === null) {
      failures.push(
        `Installable catalog entry ${entry.id} (${entry.name}) has unsupported Neon Pilot compatibility range: ${entry.neonPilot}.`,
      );
    }
  }
  return { ok: failures.length === 0, failures };
}

// Match a bare (non-relative, non-built-in) module specifier as it appears in
// built ESM bundles — either as import("…") / dynamicImport("…"). Node
// built-ins (node:fs, fs, crypto, …) and Electron are excluded downstream.
const BARE_SPECIFIER_IMPORT_RE =
  /(?:\bimport\(|\bdynamicImport\()\s*(['"])(@?[a-zA-Z][a-zA-Z0-9._-]*(?:\/(?:@?[a-zA-Z][a-zA-Z0-9._-]*))*)\1\s*\)/gu;
const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'stream/promises',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

const SERVER_MODULE_RESOLVER_PATH = join(repoRoot, 'packages/desktop/server/extensions/backendApi/serverModuleResolver.ts');
const ELECTRON_BUILDER_CONFIG_PATH = join(repoRoot, 'electron-builder.config.mjs');
const DESKTOP_DIST_DIRS = ['packages/desktop/dist', 'packages/desktop/server/dist'];

function listServerModuleResolverSpecifiers(source = readFileSync(SERVER_MODULE_RESOLVER_PATH, 'utf8')) {
  const specifiers = new Set();
  for (const match of source.matchAll(/specifier\s*===\s*(['"])(@?[a-zA-Z][a-zA-Z0-9._/-]*)\1/gu)) {
    specifiers.add(match[2]);
  }
  return [...specifiers];
}

function isNodeOrElectronBuiltin(specifier) {
  // Match the bare name (e.g. 'fs' from 'fs', 'fs' from 'fs/promises',
  // 'fs' from 'node:fs/promises') and check it against the known built-in set.
  // Prefixes 'node:' and 'electron' are matched as whole-segment prefixes.
  if (specifier.startsWith('node:')) specifier = specifier.slice('node:'.length);
  if (specifier === 'electron' || specifier.startsWith('electron/')) return true;
  const base = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  return NODE_BUILTINS.has(base);
}

function listBuiltBundleBareSpecifiers(basedir) {
  if (!existsSync(basedir)) return [];
  const dir = resolve(repoRoot, basedir);
  const specifiers = new Set();
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && /\.m?js$/u.test(entry.name)) {
        const source = readFileSync(full, 'utf8');
        for (const match of source.matchAll(BARE_SPECIFIER_IMPORT_RE)) specifiers.add(match[2]);
      }
    }
  };
  visit(dir);
  return [...specifiers];
}

// Packages the server module resolver redirects to inlined dist/ files (see
// packageEntryCandidates in serverModuleResolver.ts) rather than real node_modules
// copies. They never need to be shipped to app.asar.unpacked.
const RESOLVER_REDIRECTED_PACKAGES = new Set(['@neon-pilot/core', '@neon-pilot/daemon']);
const REQUIRED_PACKAGED_RUNTIME_SPECIFIERS = [
  '@ffmpeg-installer/darwin-arm64',
  '@ffmpeg-installer/ffmpeg',
  'whisper-cpp-node',
  '@whisper-cpp-node/darwin-arm64',
];

// Bare specifiers that appear in built bundles as dynamic imports but are
// intentionally NOT shipped to app.asar.unpacked. Each entry must have a
// recorded reason; entries cannot be added without one. This is small on
// purpose: most dynamic imports DO need disk files in the packaged app.
const ALLOWED_UNSHIPPED_BARE_SPECIFIERS = {
  // CJS packages resolved via the require() shim at runtime; CommonJS requires
  // read from inside app.asar, so they do not need to be unpacked to disk.
  ajv: 'CJS ajv runtime modules resolved from app.asar via the require shim.',
  'ajv-formats': 'CJS ajv-formats resolved from app.asar via the require shim.',
  // Electron-provided native module on macOS; electron-builder unpacks it
  // automatically, so the explicit asarUnpack entry is redundant.
  fsevents: 'Electron-provided on macOS; auto-unpacked by Electron itself.',
  // Lazy-imported only under process.versions.bun (Bun runtime), which Neon
  // Pilot does not use. The bare specifier is unreachable at runtime in Node.
  'proxy-from-env': 'Only imported under process.versions.bun; unreachable in the Node build.',
};

function isAllowedUnshipped(specifier) {
  const base = specifier.startsWith('@') ? specifier : specifier.split('/')[0];
  return Object.prototype.hasOwnProperty.call(ALLOWED_UNSHIPPED_BARE_SPECIFIERS, base);
}

/**
 * Guarantees every non-builtin package that the packaged app resolves at runtime
 * as a bare specifier (either via esbuild `external` + import("…") in the built
 * bundle, or via serverModuleResolver's computed specifier set) is shipped in
 * BOTH electron-builder `files` and `asarUnpack`, so it lands as real files in
 * app.asar.unpacked. Catches the whole class of "dynamic import survives
 * bundling but the package isn't on disk in the packaged app" failures.
 */
export function checkPackagingExternalsConsistency({ filesShipped = null, asarUnpacked = null, runtimeSpecifiers = null } = {}) {
  const files = filesShipped;
  const unpacked = asarUnpacked;
  if (!Array.isArray(files) || !Array.isArray(unpacked)) {
    return { ok: false, failures: ['electron-builder files/asarUnpack lists could not be read.'] };
  }
  const specifiers = new Set(
    runtimeSpecifiers ?? [
      ...listServerModuleResolverSpecifiers(),
      ...DESKTOP_DIST_DIRS.flatMap(listBuiltBundleBareSpecifiers),
      ...REQUIRED_PACKAGED_RUNTIME_SPECIFIERS,
    ],
  );

  const failures = [];
  const shippedInFiles = new Set();
  const shippedInUnpack = new Set();
  for (const glob of files) {
    const m = glob.match(/^node_modules\/(?<pkg>@[^\/{}]+\/[^{}\/]+|[^{}\/]+)/u);
    if (m) shippedInFiles.add(m.groups.pkg);
  }
  for (const glob of unpacked) {
    const m = glob.match(/^node_modules\/(?<pkg>@[^\/{}]+\/[^{}\/]+|[^{}\/]+)/u);
    if (m) shippedInUnpack.add(m.groups.pkg);
  }

  const needsOnDisk = (specifier) =>
    !isNodeOrElectronBuiltin(specifier) && !RESOLVER_REDIRECTED_PACKAGES.has(specifier) && !isAllowedUnshipped(specifier);

  const baseName = (specifier) => (specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]);

  for (const specifier of specifiers) {
    if (!needsOnDisk(specifier)) continue;
    const pkg = baseName(specifier);
    if (!shippedInFiles.has(pkg)) {
      failures.push(
        `Runtime bare specifier '${specifier}' is not in electron-builder files; add 'node_modules/${pkg}{,/**/*}' so it reaches the bundle.`,
      );
    }
    if (!shippedInUnpack.has(pkg)) {
      failures.push(
        `Runtime bare specifier '${specifier}' is not in asarUnpack; add 'node_modules/${pkg}/**/*' so it is extracted to app.asar.unpacked as real files.`,
      );
    }
  }

  // Flag packages that appear in only one of `files` / `asarUnpack` — an asymmetry
  // that silently breaks the on-disk contract (e.g. shipped-but-not-unpacked
  // leaves the package inside app.asar where ESM/native code cannot resolve it).
  // Allowlisted CJS/Electron-provided packages are exempt (they intentionally
  // stay inside app.asar and resolve via the CJS require shim).
  for (const pkg of shippedInFiles) {
    if (!shippedInUnpack.has(pkg) && !RESOLVER_REDIRECTED_PACKAGES.has(pkg) && !isAllowedUnshipped(pkg)) {
      failures.push(
        `'node_modules/${pkg}' is in electron-builder files but not asarUnpack; extraction is required for runtime resolution from app.asar.unpacked.`,
      );
    }
  }
  for (const pkg of shippedInUnpack) {
    if (!shippedInFiles.has(pkg)) {
      failures.push(
        `'node_modules/${pkg}' is in asarUnpack but not electron-builder files; it will never reach the bundle to be unpacked.`,
      );
    }
  }

  return { ok: failures.length === 0, failures };
}

function runCheck(name, command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });
  return {
    name,
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
    status: result.status,
  };
}

export function runStaticDoctor() {
  const manifests = listExtensionManifests().map((path) => ({ path, manifest: readJson(path) }));
  const { files, asarUnpack } = loadElectronBuilderConfigArrays();
  const checks = [
    { name: 'unified-admin-surface', ...checkUnifiedAdminSurface(manifests) },
    { name: 'conversation-admin-flows', ...checkConversationAdminFlows(manifests) },
    { name: 'deferred-resume-lifecycle', ...checkDeferredResumeLifecycle(manifests) },
    { name: 'extension-state-sanity', ...checkExtensionStateSanity(manifests) },
    { name: 'heartbeat-config', ...checkHeartbeatConfig(manifests) },
    { name: 'installable-catalog-compatibility', ...checkInstallableCatalogCompatibility() },
    { name: 'packaging-externals-consistency', ...checkPackagingExternalsConsistency({ filesShipped: files, asarUnpacked: asarUnpack }) },
    runCheck('packaged-extension-validity', process.execPath, ['scripts/check-packaged-extensions.mjs']),
  ];
  return { ok: checks.every((check) => check.ok), checks };
}

// Load electron-builder.config.mjs' `files`/`asarUnpack` arrays. The config is ESM
// with side effects, so we eval it in a sync child process and JSON-print the two
// arrays (mirrors the existing runCheck spawnSync pattern).
function loadElectronBuilderConfigArrays() {
  const loader = `import(${JSON.stringify(ELECTRON_BUILDER_CONFIG_PATH)}).then(m => console.log(JSON.stringify({ files: m.default.files, asarUnpack: m.default.asarUnpack })))`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', loader], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) return { files: null, asarUnpack: null };
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { files: null, asarUnpack: null };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runStaticDoctor();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
