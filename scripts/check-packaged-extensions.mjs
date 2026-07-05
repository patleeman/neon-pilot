#!/usr/bin/env node
/* eslint-env node */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { init, parse } from 'es-module-lexer';

import { backendBundleByteLimit, criticalSmokeActionInput, FORBIDDEN_BUNDLED_PATH_FRAGMENTS } from './extension-hardening-config.mjs';
import { defaultInstallableBundleNames, defaultInstallableExtensionIds } from './default-installable-extensions.mjs';

process.setMaxListeners(0);

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const smokeRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-packaged-extension-smoke-'));
const smokeStateRoot = join(smokeRoot, 'state');
const smokeConfigRoot = join(smokeRoot, 'config');
const smokeKnowledgeRoot = join(smokeRoot, 'knowledge');
mkdirSync(smokeStateRoot, { recursive: true });
mkdirSync(smokeConfigRoot, { recursive: true });
mkdirSync(smokeKnowledgeRoot, { recursive: true });
writeFileSync(join(smokeKnowledgeRoot, 'smoke.md'), '# Smoke\n');
process.env.NEON_PILOT_STATE_ROOT ??= smokeStateRoot;
process.env.NEON_PILOT_CONFIG_ROOT ??= smokeConfigRoot;
process.env.NEON_PILOT_KNOWLEDGE_ROOT ??= smokeKnowledgeRoot;
const inputRoot = process.argv[2] ? resolve(process.argv[2]) : repoRoot;
const packagedAppResourcesRoot = inputRoot.endsWith('.app') ? join(inputRoot, 'Contents', 'Resources') : null;
const directExtensionRoot = !packagedAppResourcesRoot && existsSync(join(inputRoot, 'extension.json')) ? inputRoot : null;
const extensionsRoot = packagedAppResourcesRoot ? join(packagedAppResourcesRoot, 'extensions') : join(inputRoot, 'extensions');
const defaultInstallableExtensionIdSet = new Set(defaultInstallableExtensionIds);
const defaultInstallableBundleNameSet = new Set(defaultInstallableBundleNames);

if (packagedAppResourcesRoot) {
  Object.defineProperty(process, 'resourcesPath', {
    value: packagedAppResourcesRoot,
    configurable: true,
  });
}

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const allowedBackendBareImports = new Set([
  'better-sqlite3',
  'electron',
  'esbuild',
  'fsevents',
  '@neon-pilot/extensions/host',
  '@neon-pilot/extensions/ui',
  '@neon-pilot/extensions/workbench',
  '@neon-pilot/extensions/settings',
  '@neon-pilot/extensions/data',
  '@neon-pilot/extensions/excalidraw',
]);
const allowedFrontendBareImports = new Set(['@neon-pilot/extensions', 'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']);
const forbiddenBackendPrefixes = [
  '@earendil-works/pi-coding-agent',
  '@neon-pilot/core',
  '@neon-pilot/daemon',
  '@neon-pilot/extensions/backend',
  '@sinclair/typebox',
  'jsdom',
];
const allowedHostBackedExtensionIds = new Set(['system-knowledge', 'system-prompt-assembly']);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listExtensionDirs(root, predicate = () => true) {
  if (!root || !existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && predicate(entry.name))
    .map((entry) => join(root, entry.name))
    .filter((dir) => existsSync(join(dir, 'extension.json')))
    .sort((left, right) => left.localeCompare(right));
}

function listSourceExtensionDirs() {
  return listExtensionDirs(join(repoRoot, 'extensions'), (name) => name.startsWith('system-'));
}

function listPackagedExtensionDirs() {
  if (directExtensionRoot) return [directExtensionRoot];
  return listExtensionDirs(extensionsRoot, (name) => name.startsWith('system-'));
}

function isBareSpecifier(specifier) {
  return !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:') && !specifier.startsWith('data:');
}

function packageNameFor(specifier) {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return `${scope}/${name ?? ''}`;
  }
  return specifier.split('/')[0];
}

function collectImportSpecifiers(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const [imports] = parse(source);
  return imports
    .map((importRecord) => importRecord.n)
    .filter(Boolean)
    .sort();
}

function collectBareImports(filePath) {
  const specifiers = new Set();
  for (const specifier of collectImportSpecifiers(filePath)) {
    if (!isBareSpecifier(specifier) || nodeBuiltins.has(specifier)) continue;
    specifiers.add(specifier);
  }
  return [...specifiers].sort();
}

function collectNonPortableImports(filePath) {
  return collectImportSpecifiers(filePath).filter((specifier) => specifier.startsWith('/') || specifier.startsWith('file:'));
}

function isForbiddenExtensionSourceImport(specifier) {
  return (
    specifier === '@neon-pilot/core' ||
    specifier.startsWith('@neon-pilot/core/') ||
    specifier === '@neon-pilot/daemon' ||
    specifier.startsWith('@neon-pilot/daemon/') ||
    specifier.includes('/packages/desktop/server/') ||
    specifier.includes('/packages/core/')
  );
}

function collectSourceFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(path));
    else if (/\.(?:ts|tsx|js|jsx|d\.ts)$/.test(entry.name)) files.push(path);
  }
  return files.sort();
}

function collectSourceImportStatements(source) {
  const imports = [];
  const importFromPattern = /(^|\n)\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  const sideEffectImportPattern = /(^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importFromPattern)) imports.push({ statement: match[0], specifier: match[3] });
  for (const match of source.matchAll(sideEffectImportPattern)) imports.push({ statement: match[0], specifier: match[2] });
  return imports;
}

function isTypeOnlyImportStatement(statement) {
  return /^\s*import\s+type\b/.test(statement.trim());
}

function collectForbiddenExtensionSourceImports(extensionDir) {
  const sourceRoot = join(extensionDir, 'src');
  const failures = [];
  for (const sourcePath of collectSourceFiles(sourceRoot)) {
    if (/\.test\.[cm]?[jt]sx?$/.test(sourcePath)) continue;
    if (sourcePath.endsWith('.d.ts')) {
      failures.push(
        `${sourcePath.slice(extensionDir.length + 1)} is a generated declaration file; keep extension src portable and source-only`,
      );
      continue;
    }
    const source = readFileSync(sourcePath, 'utf8');
    const relative = sourcePath.slice(extensionDir.length + 1);
    for (const importRecord of collectSourceImportStatements(source)) {
      const specifier = importRecord.specifier;
      if (!specifier) continue;
      if (isForbiddenExtensionSourceImport(specifier)) failures.push(`${relative} imports ${specifier}`);
      if (
        (specifier === '@earendil-works/pi-coding-agent' || specifier.startsWith('@earendil-works/pi-coding-agent/')) &&
        !isTypeOnlyImportStatement(importRecord.statement)
      ) {
        failures.push(`${relative} imports runtime value ${specifier}; use a focused @neon-pilot/extensions/backend/* seam`);
      }
    }
  }
  return failures;
}

function collectForbiddenInternalExtensionFrontendFetches(extensionDir) {
  const sourceRoot = join(extensionDir, 'src');
  const failures = [];
  for (const sourcePath of collectSourceFiles(sourceRoot)) {
    if (!/\.(?:tsx|jsx)$/.test(sourcePath) || /\.test\.[cm]?[jt]sx?$/.test(sourcePath)) continue;
    const source = readFileSync(sourcePath, 'utf8');
    if (/fetch\s*\(\s*['"`]\/api\/extensions(?:\/|['"`])/.test(source)) {
      failures.push(
        `${sourcePath.slice(extensionDir.length + 1)} fetches an internal extension API route; extension UI must use the native PA client/action bridge`,
      );
    }
  }
  return failures;
}

function collectDeprecatedFrontendActionClientUses(extensionDir) {
  const sourceRoot = join(extensionDir, 'src');
  const failures = [];
  for (const sourcePath of collectSourceFiles(sourceRoot)) {
    if (!/\.(?:tsx|jsx)$/.test(sourcePath) || /\.test\.[cm]?[jt]sx?$/.test(sourcePath)) continue;
    const source = readFileSync(sourcePath, 'utf8');
    if (/\bpa\.actions\b/.test(source)) {
      failures.push(
        `${sourcePath.slice(extensionDir.length + 1)} uses pa.actions; extension UI must call backend actions with pa.extension.invoke(actionId, input)`,
      );
    }
  }
  return failures;
}

function collectMissingWorkerDeclarations(manifest) {
  const missing = [];
  for (const action of manifest.backend?.actions ?? []) {
    if (action.worker?.enabled !== true) missing.push(`backend action "${action.id}"`);
  }
  for (const route of manifest.backend?.routes ?? []) {
    if (route.worker?.enabled !== true) missing.push(`backend route "${route.method} ${route.path}"`);
  }
  for (const service of manifest.backend?.services ?? []) {
    if (service.worker?.enabled !== true) missing.push(`backend service "${service.id}"`);
  }
  return missing;
}

function collectForbiddenBundledPaths(filePath) {
  const source = readFileSync(filePath, 'utf8');
  return FORBIDDEN_BUNDLED_PATH_FRAGMENTS.filter((fragment) => source.includes(fragment));
}

function collectForbiddenDynamicRuntimeImports(filePath) {
  const source = readFileSync(filePath, 'utf8');
  return forbiddenBackendPrefixes.filter(
    (specifier) =>
      specifier.startsWith('@') &&
      [`dynamicImport(\"${specifier}\")`, `dynamicImport('${specifier}')`, `import(\"${specifier}\")`, `import('${specifier}')`].some(
        (needle) => source.includes(needle),
      ),
  );
}

function isAllowedBackendImport(specifier) {
  if (allowedBackendBareImports.has(specifier)) return true;
  const packageName = packageNameFor(specifier);
  return allowedBackendBareImports.has(packageName);
}

function isAllowedFrontendImport(specifier) {
  if (allowedFrontendBareImports.has(specifier)) return true;
  return allowedFrontendBareImports.has(packageNameFor(specifier));
}

function isForbiddenBackendImport(specifier) {
  return forbiddenBackendPrefixes.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`));
}

function backendEntryPath(extensionDir, manifest) {
  const entry = manifest.backend?.entry;
  if (!entry) return undefined;
  return entry.startsWith('src/') ? join(extensionDir, 'dist', 'backend.mjs') : join(extensionDir, entry);
}

function frontendEntryPath(extensionDir, manifest) {
  const entry = manifest.frontend?.entry;
  return entry ? join(extensionDir, entry) : undefined;
}

function requiredBuiltEntries(manifest) {
  const entries = [];
  if (typeof manifest.frontend?.entry === 'string' && manifest.frontend.entry.trim().length > 0) {
    entries.push(manifest.frontend.entry);
  }
  for (const styleEntry of manifest.frontend?.styles ?? []) {
    if (typeof styleEntry === 'string' && styleEntry.trim().length > 0) entries.push(styleEntry);
  }
  if (typeof manifest.backend?.entry === 'string' && manifest.backend.entry.trim().length > 0) {
    entries.push(manifest.backend.entry.startsWith('src/') ? 'dist/backend.mjs' : manifest.backend.entry);
  }
  for (const webapp of manifest.contributes?.webapps ?? []) {
    if (typeof webapp.entry === 'string' && webapp.entry.trim().length > 0) entries.push(webapp.entry);
  }
  if (entries.length > 0) entries.push('dist/build-manifest.json');
  return [...new Set(entries)];
}

function sourceEntryPath(extensionDir, relativePath) {
  if (!relativePath || !relativePath.startsWith('src/')) return undefined;
  return join(extensionDir, relativePath);
}

function listFilesRecursively(root) {
  if (!existsSync(root)) return [];
  const result = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        result.push(path);
      }
    }
  };
  visit(root);
  return result;
}

function listSourceHashPaths(extensionDir, manifestPath) {
  return [
    manifestPath,
    ...listFilesRecursively(join(extensionDir, 'src')).filter((sourcePath) => !/\.test\.[cm]?[tj]sx?$/u.test(sourcePath)),
    ...listFilesRecursively(join(extensionDir, 'webapp')),
  ];
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function sourceHashEntries(extensionDir, sourcePaths) {
  return sourcePaths
    .filter((sourcePath) => sourcePath && existsSync(sourcePath))
    .map((sourcePath) => ({
      path: sourcePath.startsWith(`${extensionDir}/`) ? sourcePath.slice(extensionDir.length + 1) : sourcePath,
      sha256: sha256File(sourcePath),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function assertPackagedAppContainsEveryExtensionBundle() {
  if (!packagedAppResourcesRoot) return;

  const packagedById = new Map();
  for (const extensionDir of listPackagedExtensionDirs()) {
    const manifest = readJson(join(extensionDir, 'extension.json'));
    const id = manifest.id ?? extensionDir;
    packagedById.set(id, extensionDir);
  }

  for (const sourceDir of listSourceExtensionDirs()) {
    const sourceManifest = readJson(join(sourceDir, 'extension.json'));
    const id = sourceManifest.id ?? sourceDir;
    const packagedDir = packagedById.get(id);
    if (!packagedDir) {
      if (defaultInstallableExtensionIdSet.has(id)) {
        const bundlePath = join(packagedAppResourcesRoot, 'installable-extension-bundles', `${id}.neon-extension.zip`);
        if (!existsSync(bundlePath)) failures.push(`${id}: default installable extension is missing packaged bundle ${bundlePath}`);
        continue;
      }
      failures.push(`${id}: extension exists in source tree but is missing from packaged app resources`);
      continue;
    }
    for (const entry of requiredBuiltEntries(sourceManifest)) {
      const packagedEntry = join(packagedDir, entry);
      if (!existsSync(packagedEntry)) failures.push(`${id}: packaged app is missing required prebuilt bundle ${entry}`);
    }
  }

  const bundleRoot = join(packagedAppResourcesRoot, 'installable-extension-bundles');
  if (!existsSync(bundleRoot)) return;
  for (const entry of readdirSync(bundleRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.neon-extension.zip')) continue;
    if (!defaultInstallableBundleNameSet.has(entry.name)) {
      failures.push(`unexpected packaged installable extension bundle: ${entry.name}`);
    }
  }
}

function isBuildManifestStale(buildManifestPath, sourcePaths) {
  if (!existsSync(buildManifestPath)) return true;
  if (packagedAppResourcesRoot) return false;
  const buildManifest = readJson(buildManifestPath);
  if (Array.isArray(buildManifest.sourceHashes)) {
    const extensionDir = dirname(dirname(buildManifestPath));
    const expected = new Map(sourceHashEntries(extensionDir, sourcePaths).map((entry) => [entry.path, entry.sha256]));
    const actual = new Map(
      buildManifest.sourceHashes
        .filter((entry) => entry && typeof entry.path === 'string' && typeof entry.sha256 === 'string')
        .map((entry) => [entry.path, entry.sha256]),
    );
    if (actual.size !== expected.size) return true;
    for (const [path, sha256] of expected) {
      if (actual.get(path) !== sha256) return true;
    }
    return false;
  }
  const buildManifestMtime = statSync(buildManifestPath).mtimeMs;
  return sourcePaths.filter(Boolean).some((sourcePath) => existsSync(sourcePath) && statSync(sourcePath).mtimeMs > buildManifestMtime);
}

function collectStringComponents(value, result = new Set()) {
  if (!value || typeof value !== 'object') return result;
  if (Array.isArray(value)) {
    for (const item of value) collectStringComponents(item, result);
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'component' && typeof child === 'string') result.add(child);
    else if (child && typeof child === 'object') collectStringComponents(child, result);
  }
  return result;
}

function assertNoBundledReactRuntime(id, frontendPath) {
  const source = readFileSync(frontendPath, 'utf8');
  const forbiddenNeedles = ['ReactCurrentDispatcher', 'dispatcher.useState', 'function useState'];
  const found = forbiddenNeedles.filter((needle) => source.includes(needle));
  if (found.length > 0) throw new Error(`frontend bundle appears to include React runtime internals: ${found.join(', ')}`);
}

function installFrontendSmokeGlobals() {
  globalThis.window ??= globalThis;
  globalThis.self ??= globalThis;
  globalThis.navigator ??= { userAgent: 'neon-pilot-extension-smoke' };
  globalThis.location ??= { href: 'http://localhost/', origin: 'http://localhost' };
  globalThis.document ??= {
    createElement: () => ({ style: {}, setAttribute: () => undefined, appendChild: () => undefined }),
    documentElement: { style: {} },
    head: { appendChild: () => undefined },
    body: { appendChild: () => undefined },
  };
  globalThis.localStorage ??= { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  globalThis.sessionStorage ??= { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
}

async function smokeFrontendModule(id, manifest, frontendPath) {
  assertNoBundledReactRuntime(id, frontendPath);
  installFrontendSmokeGlobals();
  const React = await import('react');
  const ReactDom = await import('react-dom');
  const ReactDomClient = await import('react-dom/client');
  const ReactJsxRuntime = await import('react/jsx-runtime');
  globalThis.__NEON_PILOT_REACT__ = React;
  globalThis.__NEON_PILOT_REACT_DOM__ = ReactDom;
  globalThis.__NEON_PILOT_REACT_DOM_CLIENT__ = ReactDomClient;
  globalThis.__NEON_PILOT_REACT_JSX_RUNTIME__ = ReactJsxRuntime;
  const frontendModule = await import(`${pathToFileURL(frontendPath).href}?smoke=${Date.now()}`);
  for (const componentName of collectStringComponents(manifest.contributes)) {
    if (typeof frontendModule[componentName] !== 'function') throw new Error(`missing frontend component export "${componentName}"`);
  }
}

function safeActionInputFor(id, manifest, actionId) {
  const criticalInput = criticalSmokeActionInput(id, actionId);
  if (criticalInput !== undefined) return criticalInput;
  const tool = manifest.contributes?.tools?.find((candidate) => candidate.action === actionId);
  const safeListTools = new Set(['scheduled_task', 'queue_followup']);
  if (!tool?.name || !safeListTools.has(tool.name)) return undefined;
  const actionEnum = tool.inputSchema?.properties?.action?.enum;
  if (Array.isArray(actionEnum) && actionEnum.includes('list')) return { action: 'list' };
  return undefined;
}

function createSmokeContext(extensionId) {
  const noop = () => undefined;
  return {
    extensionId,
    runtimeScope: 'shared',
    runtimeDir: join(repoRoot, 'tmp', 'extension-smoke-runtime'),
    runtimeSettingsFilePath: join(repoRoot, 'tmp', 'extension-smoke-runtime', 'settings.json'),
    toolContext: { conversationId: 'extension-smoke-test', cwd: repoRoot },
    ui: { invalidate: noop },
    log: { info: noop, warn: noop, error: noop },
    runtime: { getRepoRoot: () => repoRoot, getLiveSessionResourceOptions: () => ({}) },
    storage: {
      get: async () => null,
      put: async () => ({ ok: true }),
      delete: async () => ({ ok: true, deleted: false }),
      list: async () => [],
    },
    shell: {
      exec: async (input) => ({
        command: input.command,
        args: input.args ?? [],
        cwd: input.cwd,
        stdout: '',
        stderr: '',
        executionWrappers: [],
      }),
      spawn: async () => ({ pid: null, executionWrappers: [], kill: noop }),
    },
    git: {},
    filesystem: {},
    workspace: {},
    conversations: {},
    executions: {},
    attention: {},
    automations: {},
    vault: {},
    notify: {
      toast: noop,
      system: () => false,
      setBadge: () => ({ badge: 0, aggregated: 0 }),
      clearBadge: noop,
      isSystemAvailable: () => false,
    },
    events: { publish: async () => undefined, subscribe: () => ({ unsubscribe: noop }) },
    extensions: { callAction: async () => undefined, listActions: () => [], getStatus: () => ({ enabled: true, healthy: true }) },
  };
}

async function smokeBackendActions(id, manifest, backendModule) {
  for (const action of manifest.backend?.actions ?? []) {
    const handlerName = action.handler ?? action.id;
    const handler = backendModule[handlerName];
    if (typeof handler !== 'function') {
      throw new Error(`missing backend action handler export "${handlerName}"`);
    }
    const input = safeActionInputFor(id, manifest, action.id);
    if (input === undefined) continue;
    const result = await handler(input, createSmokeContext(id));
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
      throw new Error(`action "${action.id}" smoke call returned failure: ${result.error ?? JSON.stringify(result)}`);
    }
  }
}

await init;

const failures = [];
const rows = [];

assertPackagedAppContainsEveryExtensionBundle();

for (const extensionDir of listPackagedExtensionDirs()) {
  const manifestPath = join(extensionDir, 'extension.json');
  const manifest = readJson(manifestPath);
  const id = manifest.id ?? extensionDir;
  const backendPath = backendEntryPath(extensionDir, manifest);
  const frontendPath = frontendEntryPath(extensionDir, manifest);
  const buildManifestPath = join(extensionDir, 'dist', 'build-manifest.json');
  const row = { id, backend: 'none', frontend: 'none', actions: manifest.backend?.actions?.length ?? 0, manifest: 'missing' };
  const hasBuildManifest = existsSync(buildManifestPath);
  const sourcePaths = [
    ...listSourceHashPaths(extensionDir, manifestPath),
    sourceEntryPath(extensionDir, manifest.frontend?.entry ? 'src/frontend.tsx' : null),
    sourceEntryPath(extensionDir, manifest.backend?.entry),
  ];

  if (hasBuildManifest) row.manifest = isBuildManifestStale(buildManifestPath, sourcePaths) ? 'stale' : 'ok';
  if (row.manifest === 'missing') failures.push(`${id}: missing dist/build-manifest.json`);
  if (row.manifest === 'stale')
    failures.push(`${id}: dist/build-manifest.json is older than extension source or manifest; rebuild the extension`);

  const forbiddenSourceImports = allowedHostBackedExtensionIds.has(id) ? [] : collectForbiddenExtensionSourceImports(extensionDir);
  if (forbiddenSourceImports.length > 0) {
    failures.push(`${id}: backend source imports forbidden host/runtime modules: ${forbiddenSourceImports.join(', ')}`);
  }

  const forbiddenFrontendFetches = collectForbiddenInternalExtensionFrontendFetches(extensionDir);
  if (forbiddenFrontendFetches.length > 0) {
    failures.push(`${id}: frontend uses internal extension HTTP routes: ${forbiddenFrontendFetches.join(', ')}`);
  }
  const deprecatedFrontendActionClients = collectDeprecatedFrontendActionClientUses(extensionDir);
  if (deprecatedFrontendActionClients.length > 0) {
    failures.push(`${id}: frontend uses deprecated PA action client: ${deprecatedFrontendActionClients.join(', ')}`);
  }
  const missingWorkerDeclarations = collectMissingWorkerDeclarations(manifest);
  if (missingWorkerDeclarations.length > 0) {
    failures.push(`${id}: manifest entries must declare worker.enabled before they can run: ${missingWorkerDeclarations.join(', ')}`);
  }

  if (backendPath) {
    if (!existsSync(backendPath)) {
      failures.push(`${id}: missing packaged backend entry ${backendPath}`);
      row.backend = 'missing';
    } else {
      const backendSize = statSync(backendPath).size;
      const backendLimit = backendBundleByteLimit(id);
      const forbiddenBundledPaths = collectForbiddenBundledPaths(backendPath);
      const forbiddenDynamicRuntimeImports = collectForbiddenDynamicRuntimeImports(backendPath);
      if (backendSize > backendLimit) failures.push(`${id}: backend bundle is ${backendSize} bytes, above limit ${backendLimit} bytes`);
      if (forbiddenBundledPaths.length > 0)
        failures.push(`${id}: backend bundle contains forbidden bundled runtime paths: ${forbiddenBundledPaths.join(', ')}`);
      if (forbiddenDynamicRuntimeImports.length > 0)
        failures.push(
          `${id}: backend bundle contains forbidden dynamic packaged-runtime imports: ${forbiddenDynamicRuntimeImports.join(', ')}`,
        );
      const bareImports = collectBareImports(backendPath);
      const nonPortableImports = collectNonPortableImports(backendPath);
      const hostBackedExtension = allowedHostBackedExtensionIds.has(id);
      const forbidden = hostBackedExtension ? [] : bareImports.filter(isForbiddenBackendImport);
      const unexpected = bareImports.filter(
        (specifier) => !isAllowedBackendImport(specifier) && !(hostBackedExtension && specifier === '@neon-pilot/daemon'),
      );
      if (forbidden.length > 0) failures.push(`${id}: backend bundle contains forbidden packaged-runtime imports: ${forbidden.join(', ')}`);
      if (unexpected.length > 0) failures.push(`${id}: backend bundle contains unexpected bare imports: ${unexpected.join(', ')}`);
      if (nonPortableImports.length > 0)
        failures.push(`${id}: backend bundle contains non-portable absolute imports: ${nonPortableImports.join(', ')}`);
      try {
        const backendModule = await import(pathToFileURL(backendPath).href);
        await smokeBackendActions(id, manifest, backendModule);
        row.backend = bareImports.length > 0 ? `ok (${bareImports.length} external)` : 'ok';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (hostBackedExtension && message.includes("Cannot find package '@neon-pilot/daemon'")) {
          row.backend = bareImports.length > 0 ? `ok (${bareImports.length} host external)` : 'ok';
          continue;
        }
        failures.push(`${id}: backend import failed: ${error instanceof Error ? error.message : String(error)}`);
        row.backend = 'failed';
      }
    }
  }

  if (frontendPath) {
    if (!existsSync(frontendPath)) {
      failures.push(`${id}: missing packaged frontend entry ${frontendPath}`);
      row.frontend = 'missing';
    } else {
      const bareImports = collectBareImports(frontendPath);
      const nonPortableImports = collectNonPortableImports(frontendPath);
      const unexpected = bareImports.filter((specifier) => !isAllowedFrontendImport(specifier));
      if (unexpected.length > 0) failures.push(`${id}: frontend bundle contains unexpected bare imports: ${unexpected.join(', ')}`);
      if (nonPortableImports.length > 0)
        failures.push(`${id}: frontend bundle contains non-portable absolute imports: ${nonPortableImports.join(', ')}`);
      try {
        await smokeFrontendModule(id, manifest, frontendPath);
        row.frontend = bareImports.length > 0 ? `ok (${bareImports.length} external)` : 'ok';
      } catch (error) {
        failures.push(`${id}: frontend smoke import failed: ${error instanceof Error ? error.message : String(error)}`);
        row.frontend = 'failed';
      }
    }
  }

  rows.push(row);
}

console.table(rows);

if (failures.length > 0) {
  console.error('\nPackaged extension check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Packaged extension check passed for ${rows.length} extensions.`);
