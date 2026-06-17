#!/usr/bin/env node
/* eslint-env node */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { init, parse } from 'es-module-lexer';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdkPackagePath = join(repoRoot, 'packages/extensions/package.json');
const sdkBackendRoot = join(repoRoot, 'packages/extensions/src/backend');
const hostBackendApiRoot = join(repoRoot, 'packages/desktop/server/extensions/backendApi');
const buildScriptPath = join(repoRoot, 'scripts/extension-build.mjs');
const desktopServerBuildScriptPath = join(repoRoot, 'packages/desktop/scripts/build-server-bundle.mjs');

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const forbiddenStaticImportPrefixes = [
  '@neon-pilot/core',
  '@neon-pilot/daemon',
  '@earendil-works/pi-coding-agent',
  '@sinclair/typebox',
  'jsdom',
  '../extensionBackend.js',
  '../runtimeAgentHooks.js',
  '../extensionRegistry.js',
  '../extensionLifecycle.js',
  '../extensionDoctor.js',
  '../../conversations/',
  '../../routes/',
  '../../automation/',
  '../../gateways/',
  '../../shared/',
];
const allowedStringHostApiGlobals = new Map([
  [
    'gateways.ts',
    new Set([
      // Legacy seam published by routes/gateways.ts. New backend API host access
      // should use serverModuleResolver or the extension host capability bridge.
      'TELEGRAM_GATEWAY_HOST_API_GLOBAL',
    ]),
  ],
]);
const allowedHostOnlyBackendValueExports = new Map([
  [
    'agent',
    new Set([
      // Test hooks for backendApi/agent.ts dynamic-import seams.
      'resetExtensionAgentDynamicImportForTests',
      'setExtensionAgentDynamicImportForTests',
    ]),
  ],
  [
    'automations',
    new Set([
      // Internal helpers used by host routes; not part of the public extension backend SDK.
      'cancelAttentionEventForSessionFile',
      'enqueueAttentionEventForSessionFile',
      'listAttentionEventsForSessionFile',
    ]),
  ],
  [
    'compaction',
    new Set([
      // Test hooks for backendApi/compaction.ts dynamic-import seams.
      'resetExtensionCompactionDynamicImportForTests',
      'setExtensionCompactionDynamicImportForTests',
    ]),
  ],
  [
    'gateways',
    new Set([
      // Legacy host global seam; public SDK exposes typed gateway operations instead.
      'TELEGRAM_GATEWAY_HOST_API_GLOBAL',
    ]),
  ],
]);
const backendApiModulesWithoutDedicatedTests = new Map([
  [
    'browser',
    'worker bridge plus in-process fallback seam needs focused behavior coverage; add dedicated bridge tests before removing this allowlist',
  ],
  [
    'images',
    'image host bridge plus probe-store resolver seam needs focused behavior coverage; add dedicated bridge tests before removing this allowlist',
  ],
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sdkBackendSubpaths() {
  const packageJson = readJson(sdkPackagePath);
  return Object.keys(packageJson.exports ?? {})
    .filter((subpath) => subpath.startsWith('./backend/'))
    .map((subpath) => subpath.slice('./backend/'.length))
    .sort();
}

function hostBackendApiModules() {
  return readdirSync(hostBackendApiRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts') &&
        entry.name !== 'index.ts' &&
        entry.name !== 'daemonBridge.ts' &&
        entry.name !== 'serverModuleResolver.ts',
    )
    .map((entry) => basename(entry.name, extname(entry.name)))
    .sort();
}

function collectImportSpecifiers(filePath, { staticOnly = false } = {}) {
  const source = readFileSync(filePath, 'utf8');
  const [imports] = parse(source);
  return imports
    .filter((importRecord) => !staticOnly || importRecord.d === -1)
    .map((importRecord) => importRecord.n)
    .filter(Boolean)
    .sort();
}

function collectStaticExportSpecifiers(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const matches = source.matchAll(/\bexport\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g);
  return [...new Set([...matches].map((match) => match[1]))].sort();
}

function collectTypeImportSpecifiers(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const importTypeMatches = source.matchAll(/\bimport\s+type\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g);
  const typeofImportMatches = source.matchAll(/\btypeof\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  return [...new Set([...importTypeMatches, ...typeofImportMatches].map((match) => match[1]))].sort();
}

function collectHostBackendRuntimeSpecifiers(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const serverRelativeMatches = [...source.matchAll(/['"](\.\.\/\.\.\/[^'"]+\.js)['"]/g)].map((match) => match[1]);
  const extensionRelativeMatches = [
    ...source.matchAll(/\b(?:callServerExtensionModuleExport|importServerExtensionModule)\s*\(\s*['"](\.\.\/[^'"]+\.js)['"]/g),
  ].map((match) => match[1]);
  return [...new Set([...serverRelativeMatches, ...extensionRelativeMatches].map(normalizeHostBackendRuntimeSpecifier))]
    .filter(Boolean)
    .sort();
}

function collectAmbiguousExtensionRelativeServerResolverCalls(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const matches = source.matchAll(
    /\b(?:callModuleExport|callServerModuleExport|importServerModule)\s*\(\s*['"](\.\.\/(?!\.\.\/)[^'"]+\.js)['"]/g,
  );
  return [...new Set([...matches].map((match) => match[1]))].sort();
}

function normalizeHostBackendRuntimeSpecifier(specifier) {
  if (specifier.startsWith('../../')) return specifier.slice('../../'.length);
  if (specifier.startsWith('../')) return `extensions/${specifier.slice('../'.length)}`;
  return undefined;
}

function collectRawDynamicImportUsages(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const matches = source.matchAll(/new\s+Function\s*\([^)]*\bimport\s*\(/g);
  return [...matches].map((match) => match[0]);
}

function collectStringHostApiGlobals(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const matches = source.matchAll(/\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*HOST_API_GLOBAL)\b/g);
  return [...new Set([...matches].map((match) => match[1]))].sort();
}

function collectLiteralExportConstants(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const constants = new Map();
  const matches = source.matchAll(/\bexport\s+const\s+([A-Z][A-Z0-9_]*)(?:\s*:[^=]+)?\s*=\s*([^;]+);/g);
  for (const match of matches) {
    const [, name, rawExpression] = match;
    const expression = rawExpression.replace(/\s+as\s+const\b/g, '').trim();
    if (expression.includes('=>') || expression.includes('hostResolved')) continue;
    try {
      constants.set(name, JSON.stringify(Function(`"use strict"; return (${expression});`)()));
    } catch {
      // Ignore non-literal exports; this check only guards duplicated literal public contract data.
    }
  }
  return constants;
}

function collectExportedValueNames(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const names = new Set();
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\bexport\s+class\s+([A-Za-z_$][\w$]*)\b/g)) {
    names.add(match[1]);
  }
  return names;
}

function isForbiddenStaticImport(specifier) {
  if (nodeBuiltins.has(specifier) || specifier.startsWith('node:')) return false;
  if (/^(?:\.\.\/)+\.\.\/core\/src\//.test(specifier)) return true;
  return forbiddenStaticImportPrefixes.some((prefix) => specifier === prefix || specifier.startsWith(prefix));
}

function assert(condition, failures, message) {
  if (!condition) failures.push(message);
}

await init;

const failures = [];
const sdkSubpaths = sdkBackendSubpaths();
const hostModules = hostBackendApiModules();
const sdkSubpathSet = new Set(sdkSubpaths);
const hostModuleSet = new Set(hostModules);

for (const subpath of sdkSubpaths) {
  assert(
    existsSync(join(sdkBackendRoot, `${subpath}.ts`)),
    failures,
    `SDK backend export ./backend/${subpath} has no packages/extensions/src/backend/${subpath}.ts stub`,
  );
  assert(
    hostModuleSet.has(subpath),
    failures,
    `SDK backend export ./backend/${subpath} has no host backendApi/${subpath}.ts implementation`,
  );
}

for (const moduleName of hostModules) {
  assert(
    sdkSubpathSet.has(moduleName),
    failures,
    `host backendApi/${moduleName}.ts is not exported from @neon-pilot/extensions ./backend/${moduleName}`,
  );
}

for (const fileName of readdirSync(hostBackendApiRoot)) {
  if (!fileName.endsWith('.ts')) continue;
  const filePath = join(hostBackendApiRoot, fileName);
  const forbidden = [
    ...collectImportSpecifiers(filePath, { staticOnly: true }),
    ...collectStaticExportSpecifiers(filePath),
    ...collectTypeImportSpecifiers(filePath),
  ].filter(isForbiddenStaticImport);
  assert(
    forbidden.length === 0,
    failures,
    `backendApi/${fileName} statically imports, type-imports, or re-exports heavy/runtime modules (${forbidden.join(', ')}); route them through a narrow lazy host seam instead`,
  );
  if (fileName !== 'serverModuleResolver.ts') {
    const rawDynamicImportUsages = collectRawDynamicImportUsages(filePath);
    assert(
      rawDynamicImportUsages.length === 0,
      failures,
      `backendApi/${fileName} defines raw dynamic import helpers (${rawDynamicImportUsages.join(', ')}); use serverModuleResolver instead`,
    );
    const ambiguousExtensionRelativeServerResolverCalls = collectAmbiguousExtensionRelativeServerResolverCalls(filePath);
    assert(
      ambiguousExtensionRelativeServerResolverCalls.length === 0,
      failures,
      `backendApi/${fileName} passes extension-relative specifiers to server-module resolvers (${ambiguousExtensionRelativeServerResolverCalls.join(', ')}); use callServerExtensionModuleExport or importServerExtensionModule instead`,
    );
  }
  const stringHostApiGlobals = collectStringHostApiGlobals(filePath);
  const allowedStringHostApiGlobalsForFile = allowedStringHostApiGlobals.get(fileName) ?? new Set();
  const disallowedStringHostApiGlobals = stringHostApiGlobals.filter((name) => !allowedStringHostApiGlobalsForFile.has(name));
  assert(
    disallowedStringHostApiGlobals.length === 0,
    failures,
    `backendApi/${fileName} defines string-key host API globals (${disallowedStringHostApiGlobals.join(', ')}); use serverModuleResolver or the extension host capability bridge instead`,
  );
}

const buildScript = readFileSync(buildScriptPath, 'utf8');
const desktopServerBuildScript = readFileSync(desktopServerBuildScriptPath, 'utf8');
const bundledLazyServerModules = new Set([...desktopServerBuildScript.matchAll(/\['([^']+\.js)'\s*,/g)].map((match) => match[1]));
assert(
  buildScript.includes('/^@neon-pilot\\/extensions\\/backend\\/(.+)$/'),
  failures,
  'extension-build.mjs does not resolve @neon-pilot/extensions/backend/* subpaths explicitly',
);

for (const fileName of readdirSync(hostBackendApiRoot)) {
  if (!fileName.endsWith('.ts') || fileName.endsWith('.test.ts')) continue;
  const filePath = join(hostBackendApiRoot, fileName);
  const runtimeHostSpecifiers = collectHostBackendRuntimeSpecifiers(filePath);
  const missingBundleEntries = runtimeHostSpecifiers.filter((specifier) => !bundledLazyServerModules.has(specifier));
  assert(
    missingBundleEntries.length === 0,
    failures,
    `backendApi/${fileName} lazy-loads host modules missing from packaged server bundle (${missingBundleEntries.join(', ')})`,
  );
}
assert(
  buildScript.includes('packages/desktop/server/extensions/backendApi/${args.path.split'),
  failures,
  'extension-build.mjs backend subpath resolver no longer points at host backendApi modules',
);

for (const moduleName of hostModules) {
  const size = statSync(join(hostBackendApiRoot, `${moduleName}.ts`)).size;
  assert(
    size < 64 * 1024,
    failures,
    `backendApi/${moduleName}.ts is ${size} bytes; backend API seams should stay narrow, split or lazy-load implementation code`,
  );
  assert(
    existsSync(join(hostBackendApiRoot, `${moduleName}.test.ts`)) || backendApiModulesWithoutDedicatedTests.has(moduleName),
    failures,
    `backendApi/${moduleName}.ts has no dedicated test file; add packages/desktop/server/extensions/backendApi/${moduleName}.test.ts or a documented allowlist reason`,
  );
}

for (const moduleName of ['automations', 'conversations']) {
  const sdkConstants = collectLiteralExportConstants(join(sdkBackendRoot, `${moduleName}.ts`));
  const hostConstants = collectLiteralExportConstants(join(hostBackendApiRoot, `${moduleName}.ts`));
  for (const [name, hostValue] of hostConstants) {
    if (!sdkConstants.has(name)) continue;
    assert(
      sdkConstants.get(name) === hostValue,
      failures,
      `SDK backend/${moduleName}.ts constant ${name} differs from host backendApi/${moduleName}.ts`,
    );
  }
}

for (const moduleName of hostModules) {
  const sdkExports = collectExportedValueNames(join(sdkBackendRoot, `${moduleName}.ts`));
  const hostExports = collectExportedValueNames(join(hostBackendApiRoot, `${moduleName}.ts`));
  const allowedHostOnlyExports = allowedHostOnlyBackendValueExports.get(moduleName) ?? new Set();
  const missingSdkExports = [...hostExports].filter((name) => !sdkExports.has(name) && !allowedHostOnlyExports.has(name)).sort();
  assert(
    missingSdkExports.length === 0,
    failures,
    `host backendApi/${moduleName}.ts exports values missing from packages/extensions/src/backend/${moduleName}.ts (${missingSdkExports.join(', ')})`,
  );
}

if (failures.length > 0) {
  console.error('\nExtension backend API check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Extension backend API check passed (${sdkSubpaths.length} public subpaths, ${hostModules.length} host modules).`);
