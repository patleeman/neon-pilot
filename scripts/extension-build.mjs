#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HOST_RUNTIME_EXTERNAL_IMPORT_RE = /^(process|@xenova\/transformers|better-sqlite3|esbuild)(\/.*)?$/;
const FORBIDDEN_BACKEND_IMPORTS = new Set([
  'child_process',
  'node:child_process',
  'cluster',
  'node:cluster',
  'worker_threads',
  'node:worker_threads',
]);
const FORBIDDEN_USER_BACKEND_IMPORTS = new Set([
  ...FORBIDDEN_BACKEND_IMPORTS,
  'fs',
  'fs/promises',
  'node:fs',
  'node:fs/promises',
  'http',
  'https',
  'http2',
  'net',
  'tls',
  'dgram',
  'dns',
  'node:http',
  'node:https',
  'node:http2',
  'node:net',
  'node:tls',
  'node:dgram',
  'node:dns',
  'module',
  'node:module',
  'process',
  'node:process',
  'electron',
  'fsevents',
  'esbuild',
  'better-sqlite3',
  '@xenova/transformers',
]);
const PUBLIC_BACKEND_SUBPATHS = new Set([
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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagedVendorRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../vendor');
const packagedEsbuildModule = join(packagedVendorRoot, 'esbuild/lib/main.js');
const packagedEsbuildBinary = join(packagedVendorRoot, `esbuild-bin-darwin-${process.arch}`);
if (existsSync(packagedEsbuildBinary)) process.env.ESBUILD_BINARY_PATH = packagedEsbuildBinary;
const { build } = existsSync(packagedEsbuildModule) ? await import(pathToFileURL(packagedEsbuildModule).href) : await import('esbuild');
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const emitSourceMaps = args.includes('--sourcemap');
const packageArg = args.find((arg) => arg !== '--sourcemap');
const packageRoot = resolve(packageArg || process.cwd());
const manifestPath = join(packageRoot, 'extension.json');
if (!existsSync(manifestPath)) {
  console.error(`No extension.json found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
// Trust is derived from the checked-in system-extension source boundary, not
// from package-controlled manifest metadata. A copied or generated extension
// cannot opt out of the user build restrictions by claiming packageType=system.
const systemExtensionSourceRoot = join(repoRoot, 'extensions');
const isBundledSystemSource =
  String(manifest.id ?? '').startsWith('system-') &&
  existsSync(systemExtensionSourceRoot) &&
  isPathInside(systemExtensionSourceRoot, packageRoot);
const isUserPackage = !isBundledSystemSource;
if (manifest.schemaVersion !== 2) {
  console.error('Only native extension manifest schemaVersion 2 is supported by this builder.');
  process.exit(1);
}
if (isUserPackage) assertNoUserPackageSymlinks();

// dist is generated, but build it atomically. Native sidecars and bundlers can
// fail after doing real work; never delete the last good packaged extension
// until the replacement dist is complete.
const distPath = join(packageRoot, 'dist');
const tempDistPath = join(packageRoot, `.dist.tmp-${process.pid}-${Date.now()}`);
rmSync(tempDistPath, { recursive: true, force: true });
mkdirSync(tempDistPath, { recursive: true });
process.on('exit', () => {
  rmSync(tempDistPath, { recursive: true, force: true });
});

const buildOutputs = [];
buildNativeSidecarIfPresent();
copyStaticDirectoryIfPresent('bin', buildOutputs);
copyStaticDirectoryIfPresent('templates', buildOutputs);
copyStaticDirectoryIfPresent('webapp', buildOutputs, {
  filter: (source) => !/\.[cm]?[tj]sx?$/u.test(source),
});
await buildStandaloneWebappIfPresent(buildOutputs);

const frontendSource = join(packageRoot, 'src', 'frontend.tsx');
if (manifest.frontend?.entry && existsSync(frontendSource)) {
  const outfile = toBuildOutputPath(String(manifest.frontend.entry));
  mkdirSync(dirname(outfile), { recursive: true });
  const result = await build({
    entryPoints: [frontendSource],
    outdir: dirname(outfile),
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    bundle: true,
    splitting: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    define: {
      'import.meta.env.PROD': 'false',
      'import.meta.env.DEV': 'true',
    },
    jsx: 'automatic',
    sourcemap: emitSourceMaps,
    logLevel: 'info',
    conditions: ['browser', 'production'],
    loader: {
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
      '.otf': 'dataurl',
    },
    plugins: [createFrontendRawCssPlugin(), createFrontendSharedReactPlugin(), createFrontendExtensionSdkPlugin()],
    nodePaths: findAppNodeModules(),
    metafile: true,
  });
  if (isUserPackage) assertUserBuildInputsContained(result.metafile, 'frontend');
  recordBuildOutputs(buildOutputs, result.metafile);
  if (!manifest.backend?.entry || !existsSync(join(packageRoot, 'src', 'backend.ts'))) {
    writeBundledRuntimePackageJson(outfile, buildOutputs);
  }
}

const backendSource = join(packageRoot, 'src', 'backend.ts');
if (manifest.backend?.entry && existsSync(backendSource)) {
  const backendEntry = String(manifest.backend.entry);
  const outfile = backendEntry.startsWith('src/') ? join(tempDistPath, 'backend.mjs') : toBuildOutputPath(backendEntry);
  mkdirSync(dirname(outfile), { recursive: true });
  const result = await build({
    entryPoints: [backendSource],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: emitSourceMaps,
    logLevel: 'info',
    banner: isUserPackage
      ? undefined
      : {
          js: 'import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);',
        },
    external: [
      '@neon-pilot/extensions/host',
      '@neon-pilot/extensions/ui',
      '@neon-pilot/extensions/workbench',
      '@neon-pilot/extensions/workbench-artifacts',
      '@neon-pilot/extensions/workbench-browser',
      '@neon-pilot/extensions/workbench-diffs',
      '@neon-pilot/extensions/workbench-files',
      '@neon-pilot/extensions/workbench-runs',
      '@neon-pilot/extensions/workbench-transcript',
      '@neon-pilot/extensions/settings',
      '@neon-pilot/extensions/data',
      '@neon-pilot/extensions/excalidraw',
      ...(isUserPackage ? [] : ['electron', 'fsevents', 'process']),
    ],
    nodePaths: findAppNodeModules(),
    plugins: [
      createForbiddenBackendImportPlugin(packageRoot, isUserPackage),
      createExtensionBackendApiPlugin(),
      createHostRuntimeExternalPlugin(isUserPackage),
      createJsdomWorkerPlugin(),
    ],
    metafile: true,
  });
  if (isUserPackage) assertUserBuildInputsContained(result.metafile, 'backend');
  if (isUserPackage) assertUserBackendBundleIsStatic(result.metafile, outfile);
  recordBuildOutputs(buildOutputs, result.metafile);
  copyJsdomSyncWorkerIfNeeded(outfile, buildOutputs);
  writeBundledRuntimePackageJson(outfile, buildOutputs);
}

writeBuildManifest(buildOutputs);
commitTempDist();

function platformBinarySuffix() {
  const platform = process.platform === 'darwin' ? 'macos' : process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `${platform}-${arch}`;
}

function readCargoPackageName(cargoToml) {
  const text = readFileSync(cargoToml, 'utf8');
  const match = text.match(/^name\s*=\s*"([^"]+)"/m);
  return match?.[1] ?? null;
}

function buildNativeSidecarIfPresent() {
  const cargoToml = join(packageRoot, 'sidecar', 'Cargo.toml');
  if (!existsSync(cargoToml)) return;
  if (existsSync(join(repoRoot, 'authoring-sdk'))) {
    throw new Error(
      'Native sidecars cannot be built from the installed app. Build and audit sidecars in a trusted development environment.',
    );
  }
  const packageName = readCargoPackageName(cargoToml);
  if (!packageName) throw new Error(`Unable to read sidecar package name from ${cargoToml}`);

  execFileSync('cargo', ['build', '--release', '--manifest-path', cargoToml], { cwd: packageRoot, stdio: 'inherit' });

  const source = join(packageRoot, 'sidecar', 'target', 'release', packageName);
  if (!existsSync(source)) throw new Error(`Built sidecar binary is missing: ${source}`);
  const destination = join(packageRoot, 'bin', `${packageName}-${platformBinarySuffix()}`);
  const aliasDestination = join(packageRoot, 'bin', packageName);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  copyFileSync(source, aliasDestination);
}

function copyStaticDirectoryIfPresent(name, buildOutputs, options = {}) {
  const source = join(packageRoot, name);
  if (!existsSync(source)) return;
  const destination = join(tempDistPath, name);
  cpSync(source, destination, {
    recursive: true,
    ...(typeof options.filter === 'function' ? { filter: options.filter } : {}),
  });
  buildOutputs.push({ path: relativeToPackage(destination), bytes: 0, imports: [] });
}

async function buildStandaloneWebappIfPresent(buildOutputs) {
  const candidates = ['app.tsx', 'app.ts', 'main.tsx', 'main.ts'];
  const entry = candidates.map((name) => join(packageRoot, 'webapp', name)).find((candidate) => existsSync(candidate));
  if (!entry) return;

  const outdir = join(tempDistPath, 'webapp');
  mkdirSync(outdir, { recursive: true });
  const result = await build({
    entryPoints: [entry],
    outdir,
    entryNames: 'app',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    bundle: true,
    splitting: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    define: {
      'import.meta.env.PROD': 'false',
      'import.meta.env.DEV': 'true',
    },
    jsx: 'automatic',
    sourcemap: emitSourceMaps,
    logLevel: 'info',
    conditions: ['browser', 'production'],
    nodePaths: findAppNodeModules(),
    metafile: true,
    loader: {
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
      '.otf': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.svg': 'dataurl',
    },
  });
  if (isUserPackage) assertUserBuildInputsContained(result.metafile, 'webapp');
  recordBuildOutputs(buildOutputs, result.metafile);
}

function toBuildOutputPath(manifestRelativePath) {
  const normalized = manifestRelativePath.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..') || !normalized.startsWith('dist/')) {
    throw new Error(`Extension build entry must be a relative path under dist/: ${manifestRelativePath}`);
  }
  return join(tempDistPath, normalized.slice('dist/'.length));
}

function commitTempDist() {
  rmSync(distPath, { recursive: true, force: true });
  renameSync(tempDistPath, distPath);
}

function isPathInside(parent, child) {
  const childRelative = relative(realpathSync(parent), realpathSync(child));
  return childRelative === '' || (!childRelative.startsWith('..') && !isAbsolute(childRelative));
}

function isTrustedUserBuildInput(inputPath) {
  if (!existsSync(inputPath)) return false;
  if (isPathInside(packageRoot, inputPath)) return true;
  return [
    ...findAppNodeModules(),
    join(repoRoot, 'authoring-sdk'),
    join(repoRoot, 'packages', 'extensions', 'src'),
    join(repoRoot, 'packages', 'ui', 'src'),
    join(repoRoot, 'packages', 'desktop', 'ui', 'src', 'extensions'),
    join(repoRoot, 'vendor'),
  ].some((root) => existsSync(root) && isPathInside(root, inputPath));
}

function assertNoUserPackageSymlinks() {
  const roots = ['extension.json', 'src', 'webapp', 'bin', 'templates', 'skills', 'snapshots', 'exports']
    .map((name) => join(packageRoot, name))
    .filter((candidate) => existsSync(candidate));
  const pending = [...roots];
  while (pending.length > 0) {
    const current = pending.pop();
    const stats = lstatSync(current);
    if (stats.isSymbolicLink()) {
      throw new Error(`User extension inputs cannot contain symbolic links: ${current}`);
    }
    if (!stats.isDirectory()) continue;
    for (const entry of readdirSync(current)) pending.push(join(current, entry));
  }
}

function maskNonCode(source) {
  const chars = [...source];
  const mask = (index) => {
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
  };
  const scanString = (start, quote) => {
    let index = start;
    mask(index++);
    while (index < chars.length) {
      if (chars[index] === '\\') {
        mask(index++);
        if (index < chars.length) mask(index++);
        continue;
      }
      const current = chars[index];
      mask(index++);
      if (current === quote) break;
    }
    return index;
  };
  const scanTemplate = (start) => {
    let index = start;
    mask(index++);
    while (index < chars.length) {
      if (chars[index] === '\\') {
        mask(index++);
        if (index < chars.length) mask(index++);
        continue;
      }
      if (chars[index] === '`') {
        mask(index++);
        break;
      }
      if (chars[index] === '$' && chars[index + 1] === '{') {
        index = scanCode(index + 2, true);
        if (chars[index] === '}') index += 1;
        continue;
      }
      mask(index++);
    }
    return index;
  };
  const scanCode = (start, stopAtClosingBrace = false) => {
    let index = start;
    let braceDepth = 0;
    while (index < chars.length) {
      const char = chars[index];
      const next = chars[index + 1];
      if (stopAtClosingBrace && char === '}' && braceDepth === 0) return index;
      if (char === '{') {
        braceDepth += 1;
        index += 1;
        continue;
      }
      if (char === '}' && braceDepth > 0) {
        braceDepth -= 1;
        index += 1;
        continue;
      }
      if (char === '/' && next === '/') {
        mask(index++);
        mask(index++);
        while (index < chars.length && chars[index] !== '\n') mask(index++);
        continue;
      }
      if (char === '/' && next === '*') {
        mask(index++);
        mask(index++);
        while (index < chars.length) {
          if (chars[index] === '*' && chars[index + 1] === '/') {
            mask(index++);
            mask(index++);
            break;
          }
          mask(index++);
        }
        continue;
      }
      if (char === '/') {
        let previous = index - 1;
        while (previous >= 0 && /\s/u.test(chars[previous])) previous -= 1;
        if (previous < 0 || /[=(:,!&|?{;\[]/u.test(chars[previous])) {
          mask(index++);
          while (index < chars.length) {
            if (chars[index] === '\\') {
              mask(index++);
              if (index < chars.length) mask(index++);
              continue;
            }
            const current = chars[index];
            mask(index++);
            if (current === '/') {
              while (index < chars.length && /[a-z]/iu.test(chars[index])) mask(index++);
              break;
            }
          }
          continue;
        }
      }
      if (char === "'" || char === '"') {
        index = scanString(index, char);
        continue;
      }
      if (char === '`') {
        index = scanTemplate(index);
        continue;
      }
      index += 1;
    }
    return index;
  };
  scanCode(0);
  return chars.join('');
}

function assertUserBuildInputsContained(metafile, side) {
  for (const input of Object.keys(metafile?.inputs ?? {})) {
    if (input.startsWith('neon-pilot-') || input.startsWith('<')) continue;
    const inputPath = isAbsolute(input) ? input : resolve(process.cwd(), input);
    if (!existsSync(inputPath) || isTrustedUserBuildInput(inputPath)) continue;
    throw new Error(`User extension ${side} import escapes its package or public SDK roots: ${inputPath}`);
  }
  if (side !== 'backend') return;
  for (const input of Object.keys(metafile?.inputs ?? {})) {
    const inputPath = isAbsolute(input) ? input : resolve(process.cwd(), input);
    if (!existsSync(inputPath) || !isPathInside(packageRoot, inputPath)) continue;
    const code = maskNonCode(readFileSync(inputPath, 'utf8'));
    if (/\bprocess\s*(?:\.|\[)/u.test(code)) {
      throw new Error(`User extension backend cannot access the host process directly: ${inputPath}`);
    }
    if (/\b(?:eval|Function)\s*\(|\bglobalThis\b|\bimport\s*\(/u.test(code)) {
      throw new Error(`User extension backend cannot use dynamic code, dynamic imports, or host globals: ${inputPath}`);
    }
  }
}

function assertUserBackendBundleIsStatic(metafile, outfile) {
  const output = Object.entries(metafile?.outputs ?? {}).find(([outputPath]) => resolve(outputPath) === resolve(outfile))?.[1];
  for (const imported of output?.imports ?? []) {
    if (imported.kind === 'dynamic-import') {
      throw new Error(`User extension backend cannot retain dynamic imports: ${imported.path}`);
    }
  }
}

function createFrontendRawCssPlugin() {
  return {
    name: 'neon-pilot-frontend-raw-css',
    setup(buildContext) {
      buildContext.onResolve({ filter: /\.css\?raw$/ }, async (args) => {
        const cssPath = args.path.slice(0, -'?raw'.length);
        const resolved = await buildContext.resolve(cssPath, { importer: args.importer, kind: args.kind, resolveDir: args.resolveDir });
        if (resolved.errors.length > 0) return { errors: resolved.errors };
        if (isUserPackage && resolved.path && !isTrustedUserBuildInput(resolved.path)) {
          return { errors: [{ text: `User extension raw CSS import escapes its package or trusted dependency roots: ${resolved.path}` }] };
        }
        return { path: resolved.path, namespace: 'neon-pilot-raw-css' };
      });
      buildContext.onLoad({ filter: /\.css$/, namespace: 'neon-pilot-raw-css' }, (args) => ({
        contents: readFileSync(args.path, 'utf8'),
        loader: 'text',
      }));
    },
  };
}

function createFrontendSharedReactPlugin() {
  const reactFacade = `const React = globalThis.__NEON_PILOT_REACT__;
if (!React) throw new Error('Neon Pilot React host runtime is unavailable.');
export const Children = React.Children;
export const Component = React.Component;
export const Fragment = React.Fragment;
export const Profiler = React.Profiler;
export const PureComponent = React.PureComponent;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;
export const cloneElement = React.cloneElement;
export const createContext = React.createContext;
export const createElement = React.createElement;
export const createRef = React.createRef;
export const forwardRef = React.forwardRef;
export const isValidElement = React.isValidElement;
export const lazy = React.lazy;
export const memo = React.memo;
export const startTransition = React.startTransition;
export const use = React.use;
export const useActionState = React.useActionState;
export const useCallback = React.useCallback;
export const useContext = React.useContext;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useEffect = React.useEffect;
export const useId = React.useId;
export const useImperativeHandle = React.useImperativeHandle;
export const useInsertionEffect = React.useInsertionEffect;
export const useLayoutEffect = React.useLayoutEffect;
export const useMemo = React.useMemo;
export const useOptimistic = React.useOptimistic;
export const useReducer = React.useReducer;
export const useRef = React.useRef;
export const useState = React.useState;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useTransition = React.useTransition;
export const version = React.version;
export default React;
`;
  const reactDomFacade = `const ReactDom = globalThis.__NEON_PILOT_REACT_DOM__;
if (!ReactDom) throw new Error('Neon Pilot React DOM host runtime is unavailable.');
export const createPortal = ReactDom.createPortal;
export const flushSync = ReactDom.flushSync;
export const findDOMNode = ReactDom.findDOMNode;
export const hydrate = ReactDom.hydrate;
export const render = ReactDom.render;
export const unmountComponentAtNode = ReactDom.unmountComponentAtNode;
export const unstable_batchedUpdates = ReactDom.unstable_batchedUpdates;
export const version = ReactDom.version;
export default ReactDom;
`;
  const reactDomClientFacade = `const ReactDomClient = globalThis.__NEON_PILOT_REACT_DOM_CLIENT__;
if (!ReactDomClient) throw new Error('Neon Pilot React DOM client host runtime is unavailable.');
export const createRoot = ReactDomClient.createRoot;
export const hydrateRoot = ReactDomClient.hydrateRoot;
export default ReactDomClient;
`;
  const jsxRuntimeFacade = `const runtime = globalThis.__NEON_PILOT_REACT_JSX_RUNTIME__;
if (!runtime) throw new Error('Neon Pilot React JSX runtime is unavailable.');
export const Fragment = runtime.Fragment;
export const jsx = runtime.jsx;
export const jsxs = runtime.jsxs;
export const jsxDEV = runtime.jsxDEV;
`;
  return {
    name: 'neon-pilot-frontend-shared-react',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^react$/ }, () => ({ path: 'neon-pilot-shared-react', namespace: 'neon-pilot-shared-react' }));
      buildContext.onResolve({ filter: /^react-dom$/ }, () => ({
        path: 'neon-pilot-shared-react-dom',
        namespace: 'neon-pilot-shared-react',
      }));
      buildContext.onResolve({ filter: /^react-dom\/client$/ }, () => ({
        path: 'neon-pilot-shared-react-dom-client',
        namespace: 'neon-pilot-shared-react',
      }));
      buildContext.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
        path: 'neon-pilot-shared-react-jsx-runtime',
        namespace: 'neon-pilot-shared-react',
      }));
      buildContext.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
        path: 'neon-pilot-shared-react-jsx-dev-runtime',
        namespace: 'neon-pilot-shared-react',
      }));
      buildContext.onLoad({ filter: /^neon-pilot-shared-react$/, namespace: 'neon-pilot-shared-react' }, () => ({
        contents: reactFacade,
        loader: 'js',
      }));
      buildContext.onLoad({ filter: /^neon-pilot-shared-react-dom$/, namespace: 'neon-pilot-shared-react' }, () => ({
        contents: reactDomFacade,
        loader: 'js',
      }));
      buildContext.onLoad({ filter: /^neon-pilot-shared-react-dom-client$/, namespace: 'neon-pilot-shared-react' }, () => ({
        contents: reactDomClientFacade,
        loader: 'js',
      }));
      buildContext.onLoad({ filter: /^neon-pilot-shared-react-jsx-(?:dev-)?runtime$/, namespace: 'neon-pilot-shared-react' }, () => ({
        contents: jsxRuntimeFacade,
        loader: 'js',
      }));
    },
  };
}

function createFrontendExtensionSdkPlugin() {
  const moduleFiles = {
    '@neon-pilot/extensions/host': 'host.ts',
    '@neon-pilot/extensions/ui': 'ui.ts',
    '@neon-pilot/extensions/workbench': 'workbench.ts',
    '@neon-pilot/extensions/data': 'data.ts',
    '@neon-pilot/extensions/settings': 'settings.ts',
    '@neon-pilot/extensions/host-view-components': 'host-view-components.ts',
    '@neon-pilot/extensions/workbench-artifacts': 'workbench-artifacts.ts',
    '@neon-pilot/extensions/workbench-browser': 'workbench-browser.ts',
    '@neon-pilot/extensions/workbench-diffs': 'workbench-diffs.ts',
    '@neon-pilot/extensions/workbench-files': 'workbench-files.ts',
    '@neon-pilot/extensions/workbench-runs': 'workbench-runs.ts',
    '@neon-pilot/extensions/workbench-transcript': 'workbench-transcript.ts',
    '@neon-pilot/extensions/excalidraw': 'excalidraw.ts',
    '@neon-pilot/extensions/composer': 'composer.ts',
  };
  const packageSourceFiles = {
    '@neon-pilot/extensions/excalidraw': join(repoRoot, 'packages/extensions/src/excalidraw.ts'),
    '@neon-pilot/extensions/composer': join(repoRoot, 'packages/extensions/src/composer.ts'),
  };
  return {
    name: 'neon-pilot-frontend-extension-sdk',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@neon-pilot\/ui$/ }, () => ({
        path: firstExistingPath([join(repoRoot, 'authoring-sdk/frontend/ui.js'), join(repoRoot, 'packages/ui/src/index.ts')]),
      }));
      buildContext.onResolve({ filter: /^\.\/systemExtensionModules$/ }, (args) => {
        if (!args.importer.includes('/packages/desktop/ui/src/extensions/')) return;
        return { path: 'neon-pilot-empty-system-extension-modules', namespace: 'neon-pilot-extension-sdk' };
      });
      buildContext.onLoad({ filter: /^neon-pilot-empty-system-extension-modules$/, namespace: 'neon-pilot-extension-sdk' }, () => ({
        contents: 'export const systemExtensionModules = new Map();',
        loader: 'js',
      }));
      buildContext.onResolve(
        {
          filter:
            /^@neon-pilot\/extensions\/(host|ui|workbench|host-view-components|workbench-artifacts|workbench-browser|workbench-diffs|workbench-files|workbench-runs|workbench-transcript|data|settings|excalidraw|composer)$/,
        },
        (args) => {
          const moduleFile = moduleFiles[args.path];
          const generatedFile = moduleFile ? join(repoRoot, 'authoring-sdk/frontend', moduleFile.replace(/\.ts$/u, '.js')) : null;
          const sourceFile =
            packageSourceFiles[args.path] ?? (moduleFile ? join(repoRoot, 'packages/desktop/ui/src/extensions', moduleFile) : null);
          const resolved = firstExistingPath([generatedFile, sourceFile]);
          if (!resolved || !existsSync(resolved)) {
            return { errors: [{ text: `Could not resolve ${args.path} for frontend extension build.` }] };
          }
          return { path: resolved };
        },
      );
    },
  };
}

function createForbiddenBackendImportPlugin(extensionPackageRoot, userPackage) {
  const sourceRoot = `${realpathSync(resolve(extensionPackageRoot, 'src'))}/`;
  const forbiddenImports = userPackage ? FORBIDDEN_USER_BACKEND_IMPORTS : FORBIDDEN_BACKEND_IMPORTS;
  return {
    name: 'neon-pilot-forbidden-backend-imports',
    setup(buildContext) {
      buildContext.onResolve({ filter: /.*/ }, (args) => {
        if (!forbiddenImports.has(args.path)) return;
        if (!args.importer || !existsSync(args.importer) || !realpathSync(args.importer).startsWith(sourceRoot)) return;
        return {
          errors: [
            {
              text: `Extension backend cannot import ${args.path}. Use ctx.shell so PA can apply execution wrappers and sandbox policy.`,
            },
          ],
        };
      });
    },
  };
}

function createExtensionBackendApiPlugin() {
  return {
    name: 'neon-pilot-extension-backend-api',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@neon-pilot\/extensions\/backend$/ }, () => ({
        path: firstExistingPath([
          join(repoRoot, 'authoring-sdk/backend/index.js'),
          join(repoRoot, 'packages/desktop/server/extensions/backendApi/index.ts'),
        ]),
      }));
      buildContext.onResolve({ filter: /^@neon-pilot\/extensions\/backend\/(.+)$/ }, (args) => {
        const subpath = args.path.slice('@neon-pilot/extensions/backend/'.length);
        if (!PUBLIC_BACKEND_SUBPATHS.has(subpath)) {
          return { errors: [{ text: `${args.path} is not a public extension backend API.` }] };
        }
        return {
          path: firstExistingPath([
            join(repoRoot, `authoring-sdk/backend/${subpath}.js`),
            join(repoRoot, `packages/desktop/server/extensions/backendApi/${subpath}.ts`),
          ]),
        };
      });
      buildContext.onResolve({ filter: /^@neon-pilot\/extensions\/host-view-components$/ }, () => ({
        path: firstExistingPath([
          join(repoRoot, 'authoring-sdk/backend/host-view-components.js'),
          join(repoRoot, 'packages/extensions/src/host-view-components.ts'),
        ]),
      }));
      buildContext.onResolve({ filter: /^@neon-pilot\/daemon$/ }, (args) => {
        const desktopDaemonBundleCandidates = [
          join(repoRoot, 'packages/desktop/server/dist/daemon/index.js'),
          join(repoRoot, 'packages/desktop/dist/server/daemon/index.js'),
        ];
        const desktopDaemonBundle = desktopDaemonBundleCandidates.find((candidate) => existsSync(candidate));
        // Bundle the daemon runtime inline so extensions work in packaged
        // apps where the absolute build-time path no longer exists.
        return desktopDaemonBundle ? { path: desktopDaemonBundle, external: false } : { path: args.path, external: true };
      });
    },
  };
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => typeof candidate === 'string' && existsSync(candidate)) ?? candidates.find(Boolean);
}

function createHostRuntimeExternalPlugin(userPackage) {
  return {
    name: 'neon-pilot-extension-host-runtime-externals',
    setup(buildContext) {
      buildContext.onResolve({ filter: HOST_RUNTIME_EXTERNAL_IMPORT_RE }, (args) =>
        userPackage
          ? {
              errors: [
                { text: `User extension backend cannot import host runtime module ${args.path}. Use a typed ctx capability instead.` },
              ],
            }
          : { path: args.path, external: true },
      );
    },
  };
}

function createJsdomWorkerPlugin() {
  return {
    name: 'neon-pilot-jsdom-worker-stub',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^\.\/xhr-sync-worker\.js$/ }, () => ({
        path: 'neon-pilot-jsdom-xhr-sync-worker',
        namespace: 'neon-pilot-jsdom',
      }));
      buildContext.onLoad({ filter: /.*/, namespace: 'neon-pilot-jsdom' }, () => ({ contents: 'export default "";', loader: 'js' }));
    },
  };
}

function recordBuildOutputs(buildOutputs, metafile) {
  for (const [outputPath, output] of Object.entries(metafile.outputs ?? {})) {
    buildOutputs.push({
      path: relativeToPackage(outputPath),
      bytes: output.bytes ?? 0,
      imports: (output.imports ?? []).map((item) => item.path).sort(),
    });
  }
}

function listFilesRecursively(root) {
  if (!existsSync(root)) return [];
  const result = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) result.push(path);
    }
  };
  visit(root);
  return result;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function collectSourceHashes() {
  return [
    manifestPath,
    ...listFilesRecursively(join(packageRoot, 'src')).filter((sourcePath) => !/\.test\.[cm]?[tj]sx?$/u.test(sourcePath)),
    ...listFilesRecursively(join(packageRoot, 'webapp')),
  ]
    .filter((sourcePath) => sourcePath && existsSync(sourcePath))
    .map((sourcePath) => ({
      path: relativeToPackage(sourcePath),
      sha256: sha256File(sourcePath),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function writeBuildManifest(buildOutputs) {
  writeJson(join(tempDistPath, 'build-manifest.json'), {
    extensionId: manifest.id,
    builtAt: new Date().toISOString(),
    frontendEntry: manifest.frontend?.entry ?? null,
    backendEntry: manifest.backend?.entry ?? null,
    sourceHashes: collectSourceHashes(),
    outputs: buildOutputs.sort((left, right) => left.path.localeCompare(right.path)),
  });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function relativeToPackage(path) {
  if (path === tempDistPath) return 'dist';
  if (path.startsWith(`${tempDistPath}/`)) return `dist/${path.slice(tempDistPath.length + 1)}`;
  return path.startsWith(`${packageRoot}/`) ? path.slice(packageRoot.length + 1) : path;
}

function copyJsdomSyncWorkerIfNeeded(outfile, buildOutputs) {
  // Some bundled dependencies resolve jsdom's sync XHR worker dynamically at
  // runtime, so the literal worker filename is not always present in the
  // bundle. Copying the tiny worker beside backend bundles is harmless and
  // keeps packaged extension import checks deterministic.
  const workerSource = join(repoRoot, 'node_modules', 'jsdom', 'lib', 'jsdom', 'living', 'xhr', 'xhr-sync-worker.js');
  if (!existsSync(workerSource)) return;
  const workerOutput = join(dirname(outfile), 'xhr-sync-worker.js');
  copyFileSync(workerSource, workerOutput);
  buildOutputs.push({ path: relativeToPackage(workerOutput), bytes: readFileSync(workerOutput).byteLength, imports: [] });
}

function writeBundledRuntimePackageJson(outfile, buildOutputs) {
  // Bundled pi runtime modules read their own package metadata at module
  // initialization. In a bundle, import.meta.url points at the extension dist
  // directory instead of node_modules/@earendil-works/pi-coding-agent, so ship
  // a minimal compatible package.json next to backend.mjs for packaged Electron.
  const sourcePath = join(repoRoot, 'node_modules', '@earendil-works', 'pi-coding-agent', 'package.json');
  const source = existsSync(sourcePath)
    ? JSON.parse(readFileSync(sourcePath, 'utf-8'))
    : { name: '@earendil-works/pi-coding-agent', version: '0.0.0', piConfig: { configDir: '.pi' } };
  const outputPath = join(dirname(outfile), 'package.json');
  const metadata = {
    name: source.name ?? '@earendil-works/pi-coding-agent',
    version: source.version ?? '0.0.0',
    piConfig: source.piConfig ?? { configDir: '.pi' },
    type: 'module',
  };
  writeJson(outputPath, metadata);
  buildOutputs.push({ path: relativeToPackage(outputPath), bytes: readFileSync(outputPath).byteLength, imports: [] });
}

function findAppNodeModules() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(currentDir, '..');
  const paths = [
    resolve(process.cwd(), 'node_modules'),
    resolve(repoRoot, 'packages', 'desktop', 'node_modules'),
    resolve(repoRoot, 'packages', 'core', 'node_modules'),
    resolve(repoRoot, 'node_modules'),
  ];
  if (typeof process.resourcesPath === 'string') {
    paths.push(resolve(process.resourcesPath, 'app.asar.unpacked/node_modules'));
  }
  for (let depth = 2; depth <= 5; depth++) {
    paths.push(resolve(currentDir, ...Array(depth).fill('..'), 'node_modules'));
  }
  return [...new Set(paths)];
}
