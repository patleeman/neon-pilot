import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { init, parse } from 'es-module-lexer';

import type { ExtensionManifest, ExtensionPermission } from './extensionManifest.js';
import { manifestHasAnyPermission } from './extensionPermissions.js';
import { forbiddenExtensionBackendNativeImports } from './extensionProcessGuard.js';
import type { LoadedExtensionManifest } from './extensionRegistry.js';
import { findExtensionEntry, parseExtensionManifest } from './extensionRegistry.js';
import { isKnownHostCommand } from './hostCommands.js';

export type ExtensionDoctorSeverity = 'error' | 'warning' | 'info';

export interface ExtensionDoctorFinding {
  severity: ExtensionDoctorSeverity;
  code: string;
  message: string;
  path?: string;
  fix?: string;
}

export interface ExtensionDoctorReport {
  ok: boolean;
  extensionId: string;
  packageRoot: string;
  manifest?: ExtensionManifest;
  findings: ExtensionDoctorFinding[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const forbiddenPackagedBackendPrefixes = [
  '@earendil-works/pi-coding-agent',
  '@neon-pilot/core',
  '@neon-pilot/daemon',
  '@neon-pilot/extensions/backend',
  '@sinclair/typebox',
  'jsdom',
];
const forbiddenUserBackendImports = new Set([
  ...forbiddenExtensionBackendNativeImports,
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

export async function validateExtensionPackage(input: { extensionId?: string; packageRoot?: string }): Promise<ExtensionDoctorReport> {
  const entry = input.extensionId ? findExtensionEntry(input.extensionId) : null;
  const packageRoot = resolve(input.packageRoot ?? entry?.packageRoot ?? '');
  const findings: ExtensionDoctorFinding[] = [];
  const extensionId = input.extensionId ?? entry?.manifest.id ?? packageRoot.split(/[\\/]/).pop() ?? 'extension';

  if (!packageRoot || packageRoot === resolve('')) {
    add(findings, 'error', 'missing-package-root', 'Provide an extension id or packageRoot to validate.');
    return report(extensionId, packageRoot, undefined, findings);
  }

  const manifestPath = resolve(packageRoot, 'extension.json');
  if (!existsSync(manifestPath)) {
    add(
      findings,
      'error',
      'missing-manifest',
      'extension.json is missing.',
      manifestPath,
      'Create an extension.json manifest at the package root.',
    );
    return report(extensionId, packageRoot, undefined, findings);
  }

  let manifest: ExtensionManifest | undefined;
  let isUserPackage = entry?.source === 'runtime' || entry?.manifest.packageType === 'user' || Boolean(input.packageRoot && !entry);
  try {
    const rawManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { packageType?: unknown };
    isUserPackage ||= rawManifest.packageType === 'user';
    manifest = parseExtensionManifest(rawManifest);
  } catch (error) {
    add(
      findings,
      'error',
      'invalid-manifest',
      `extension.json is invalid: ${error instanceof Error ? error.message : String(error)}`,
      manifestPath,
    );
    return report(extensionId, packageRoot, undefined, findings);
  }

  validateManifestReferences(packageRoot, manifest, findings, isUserPackage);
  await validateBuiltImports(packageRoot, manifest, findings, isUserPackage);
  if (!isUserPackage) await validateBackendImport(packageRoot, manifest, findings);

  return report(manifest.id, packageRoot, manifest, findings);
}

function validateManifestReferences(
  packageRoot: string,
  manifest: ExtensionManifest,
  findings: ExtensionDoctorFinding[],
  isUserPackage: boolean,
) {
  const frontendSource = resolve(packageRoot, 'src', 'frontend.tsx');
  const backendSource = resolve(packageRoot, 'src', 'backend.ts');
  const frontendEntry = manifest.frontend?.entry ? resolve(packageRoot, manifest.frontend.entry) : undefined;
  const backendEntry = manifest.backend?.entry ? resolve(packageRoot, manifest.backend.entry) : undefined;
  const backendRuntimeEntry = resolveBackendRuntimeEntry(packageRoot, manifest);
  const buildManifest = resolve(packageRoot, 'dist', 'build-manifest.json');

  if (!existsSync(buildManifest)) {
    add(findings, 'error', 'missing-build-manifest', 'dist/build-manifest.json is missing.', buildManifest, 'Rebuild the extension.');
  } else if (
    [resolve(packageRoot, 'extension.json'), frontendSource, backendSource].some(
      (sourcePath) => existsSync(sourcePath) && statSync(sourcePath).mtimeMs > statSync(buildManifest).mtimeMs,
    )
  ) {
    add(
      findings,
      'error',
      'stale-build-manifest',
      'dist/build-manifest.json is older than extension source or manifest.',
      buildManifest,
      'Rebuild the extension.',
    );
  }

  if (manifest.frontend?.entry) {
    if (!existsSync(frontendEntry!))
      add(
        findings,
        'error',
        'missing-frontend-dist',
        `Frontend entry is missing: ${manifest.frontend.entry}`,
        frontendEntry,
        'Build the extension.',
      );
    if (!existsSync(frontendSource)) add(findings, 'warning', 'missing-frontend-source', 'src/frontend.tsx is missing.', frontendSource);
    if (frontendEntry && existsSync(frontendEntry)) validateFrontendBundleRuntime(frontendEntry, findings);
  }

  if (manifest.backend?.entry) {
    if (!backendRuntimeEntry || !existsSync(backendRuntimeEntry))
      add(
        findings,
        'error',
        'missing-backend-dist',
        `Backend runtime entry is missing: ${isSourceBackendEntry(manifest.backend.entry) ? 'dist/backend.mjs' : manifest.backend.entry}`,
        backendRuntimeEntry,
        'Build the extension.',
      );
    if (!existsSync(backendSource)) add(findings, 'warning', 'missing-backend-source', 'src/backend.ts is missing.', backendSource);
    if (isUserPackage && existsSync(backendSource)) validateForbiddenSourceImports(backendSource, findings);
  }
  validateFrontendActionClient(frontendSource, frontendEntry, findings);
  for (const sourceFile of frontendSourceFiles(packageRoot)) {
    validateUserExtensionFrontendPatterns(sourceFile, isUserPackage, findings);
  }
  validateBackendWorkerDeclarations(manifest, manifestPath(packageRoot), findings);

  const frontendContent = existsSync(frontendSource)
    ? readFileSync(frontendSource, 'utf8')
    : frontendEntry && existsSync(frontendEntry)
      ? readFileSync(frontendEntry, 'utf8')
      : '';
  const backendContent = existsSync(backendSource)
    ? readFileSync(backendSource, 'utf8')
    : backendEntry && existsSync(backendEntry)
      ? readFileSync(backendEntry, 'utf8')
      : '';

  validateBackendCapabilityPermissions(manifest, backendContent, backendSource, findings);
  validateContributedActionReferences(manifest, findings);
  validateExternalApplicationNavigation(manifest, findings);

  for (const component of collectFrontendComponents(manifest)) {
    if (frontendContent && !hasExport(frontendContent, component)) {
      add(
        findings,
        'error',
        'missing-frontend-export',
        `Frontend component "${component}" is referenced by the manifest but is not exported.`,
        frontendSource,
      );
    }
  }

  for (const action of manifest.backend?.actions ?? []) {
    const handler = action.handler ?? action.id;
    if (!handler?.trim()) add(findings, 'error', 'missing-action-handler', `Backend action "${action.id}" is missing a handler.`);
    else if (backendContent && !hasExport(backendContent, handler)) {
      add(
        findings,
        'error',
        'missing-backend-export',
        `Backend handler "${handler}" is referenced by the manifest but is not exported.`,
        backendSource,
      );
    }
  }

  for (const entrypoint of manifest.backend?.protocolEntrypoints ?? []) {
    const handler = entrypoint.handler ?? entrypoint.id;
    if (!handler?.trim())
      add(findings, 'error', 'missing-protocol-handler', `Protocol entrypoint "${entrypoint.id}" is missing a handler.`);
    else if (backendContent && !hasExport(backendContent, handler)) {
      add(
        findings,
        'error',
        'missing-backend-export',
        `Protocol handler "${handler}" is referenced by the manifest but is not exported.`,
        backendSource,
      );
    }
  }

  for (const service of manifest.backend?.services ?? []) {
    const handler = service.handler?.trim();
    if (!handler) add(findings, 'error', 'missing-service-handler', `Backend service "${service.id}" is missing a handler.`);
    else if (backendContent && !hasExport(backendContent, handler)) {
      add(
        findings,
        'error',
        'missing-backend-export',
        `Backend service handler "${handler}" is referenced by the manifest but is not exported.`,
        backendSource,
      );
    }
    const healthCheck = service.healthCheck?.trim();
    if (healthCheck && backendContent && !hasExport(backendContent, healthCheck)) {
      add(
        findings,
        'error',
        'missing-backend-export',
        `Backend service healthCheck "${healthCheck}" is referenced by the manifest but is not exported.`,
        backendSource,
      );
    }
    const stopHandler = service.stopHandler?.trim();
    if (stopHandler && backendContent && !hasExport(backendContent, stopHandler)) {
      add(
        findings,
        'error',
        'missing-backend-export',
        `Backend service stopHandler "${stopHandler}" is referenced by the manifest but is not exported.`,
        backendSource,
      );
    }
    if (!manifestHasAnyPermission(manifest, ['network:listen'])) {
      add(
        findings,
        'error',
        'missing-capability-permission',
        `Backend service "${service.id}" requires permission "network:listen".`,
        manifestPath(packageRoot),
      );
    }
  }

  // Validate backend lifecycle handler references.
  for (const [field, exportName] of [
    ['backend.startupAction', manifest.backend?.startupAction],
    ['backend.onEnableAction', manifest.backend?.onEnableAction],
    ['backend.onDisableAction', manifest.backend?.onDisableAction],
    ['backend.onUninstallAction', manifest.backend?.onUninstallAction],
    ['backend.agentExtension', manifest.backend?.agentExtension],
  ] as const) {
    if (exportName && backendContent && !hasExport(backendContent, exportName)) {
      add(
        findings,
        'error',
        'missing-backend-export',
        `${field} references "${exportName}" but it is not exported from the backend.`,
        backendSource,
      );
    }
  }

  for (const tool of manifest.contributes?.tools ?? []) {
    if (!tool.id?.trim()) add(findings, 'error', 'invalid-tool', 'Tool contribution is missing id.');
    if (!tool.description?.trim()) add(findings, 'error', 'invalid-tool', `Tool "${tool.id}" is missing description.`);
    if (tool.inputSchema?.type !== 'object')
      add(findings, 'error', 'invalid-tool-schema', `Tool "${tool.id}" inputSchema must have type "object".`);
    if (!tool.inputSchema?.properties || typeof tool.inputSchema.properties !== 'object') {
      add(findings, 'error', 'invalid-tool-schema', `Tool "${tool.id}" inputSchema must define properties.`);
    }
  }

  for (const skill of manifest.contributes?.skills ?? []) {
    const skillPath = typeof skill === 'string' ? skill : skill.path;
    if (skillPath && !existsSync(resolve(packageRoot, skillPath)))
      add(findings, 'error', 'missing-skill', `Skill file is missing: ${skillPath}`, resolve(packageRoot, skillPath));
  }

  validateDistFreshness(packageRoot, manifest, findings);
}

function maskNonCode(source: string): string {
  const chars = [...source];
  const mask = (index: number) => {
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
  };
  const scanString = (start: number, quote: string): number => {
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
  const scanTemplate = (start: number): number => {
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
  const scanCode = (start: number, stopAtClosingBrace = false): number => {
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
        while (previous >= 0 && /\s/u.test(chars[previous]!)) previous -= 1;
        if (previous < 0 || '=(:,!&|?{;['.includes(chars[previous]!)) {
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
              while (index < chars.length && /[a-z]/iu.test(chars[index]!)) mask(index++);
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

function maskComments(source: string): string {
  const chars = [...source];
  const mask = (index: number) => {
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
  };
  let index = 0;
  let quote = '';
  while (index < chars.length) {
    const char = chars[index]!;
    const next = chars[index + 1];
    if (quote) {
      if (char === '\\') index += 2;
      else {
        if (char === quote) quote = '';
        index += 1;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
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
    index += 1;
  }
  return chars.join('');
}

function addBinding(bindings: Set<string>, candidate: string | undefined): void {
  const value = candidate?.trim();
  if (value && /^[A-Z_$][\w$]*$/u.test(value)) bindings.add(value);
}

function unboundJsxComponents(source: string, _fileName: string): string[] {
  const code = maskNonCode(source);
  const runtimeBindings = new Set<string>();

  for (const match of code.matchAll(/\bimport\s+(?!type\b)([\s\S]*?)\s+from\b/gu)) {
    const clause = match[1]!.trim();
    addBinding(runtimeBindings, clause.match(/^([\w$]+)/u)?.[1]);
    addBinding(runtimeBindings, clause.match(/\*\s+as\s+([\w$]+)/u)?.[1]);
    const named = clause.match(/\{([\s\S]*?)\}/u)?.[1] ?? '';
    for (const item of named.split(',')) {
      const cleaned = item.trim();
      if (!cleaned || cleaned.startsWith('type ')) continue;
      const parts = cleaned.split(/\s+as\s+/u);
      addBinding(runtimeBindings, parts[1] ?? parts[0]);
    }
  }
  for (const match of code.matchAll(/\b(?:const|let|var|function|class|enum)\s+([\w$]+)/gu)) {
    addBinding(runtimeBindings, match[1]);
  }
  for (const match of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/gu)) {
    for (const item of match[1]!.split(',')) {
      const [property, alias] = item.split(':').map((part) => part.trim());
      addBinding(runtimeBindings, (alias ?? property)?.replace(/=.*$/u, '').trim());
    }
  }
  for (const match of code.matchAll(/\bfunction\s+[\w$]+\s*\(\s*\{([^}]*)\}/gu)) {
    for (const item of match[1]!.split(',')) {
      const [property, alias] = item.split(':').map((part) => part.trim());
      addBinding(runtimeBindings, (alias ?? property)?.replace(/=.*$/u, '').trim());
    }
  }

  const missing = new Set<string>();
  for (const match of code.matchAll(/<\/?\s*([A-Z_$][\w$]*)(?=[.\s/>])/gu)) {
    const isClosingTag = code.startsWith('</', match.index);
    const preceding = match.index > 0 ? code[match.index - 1] : '';
    // In TSX, a capitalized name immediately following an identifier, call,
    // or indexed expression is a type argument (`useState<Model>()` or
    // `ChangeEvent<HTMLInputElement>`), not an opening JSX element.
    if (!isClosingTag && /[\w$.)\]]/u.test(preceding ?? '')) continue;
    if (!runtimeBindings.has(match[1]!)) missing.add(match[1]!);
  }
  return [...missing].sort();
}

function validateUserExtensionFrontendPatterns(frontendSource: string, isUserPackage: boolean, findings: ExtensionDoctorFinding[]): void {
  if (!isUserPackage || !existsSync(frontendSource)) return;
  const source = readFileSync(frontendSource, 'utf8');
  const missingJsxBindings = unboundJsxComponents(source, frontendSource);
  if (missingJsxBindings.length > 0) {
    add(
      findings,
      'error',
      'unbound-jsx-component',
      `JSX components are used without runtime imports or declarations: ${missingJsxBindings.join(', ')}.`,
      frontendSource,
      'Import every shared component from @neon-pilot/extensions/ui (or declare/import the local component) before using it in JSX.',
    );
  }
  if (/\bclassName\s*=/u.test(source)) {
    add(
      findings,
      'error',
      'uncompiled-extension-utilities',
      'User extension frontend source uses className utilities, but the installed-app builder does not compile extension-local Tailwind CSS.',
      frontendSource,
      'Compose @neon-pilot/extensions/ui primitives and use narrow inline style objects only for product-specific layout.',
    );
  }
  // Lowercase JSX names are native elements; PascalCase names are shared
  // components such as Button, TextInput, Select, and Textarea.
  if (/<(?:button|input|select|textarea)\b/u.test(source)) {
    add(
      findings,
      'error',
      'raw-extension-control',
      'User extension frontend source contains raw form or action controls.',
      frontendSource,
      'Use Button, ToolbarButton, IconButton, TextInput, Textarea, Select, Checkbox, Switch, or SegmentedControl from @neon-pilot/extensions/ui.',
    );
  }
  if (/<(?:div|span|li|tr)\b[^>]*\bonClick\s*=/su.test(source)) {
    add(
      findings,
      'error',
      'non-semantic-interactive-container',
      'A clickable list or layout container is not keyboard- and automation-accessible.',
      frontendSource,
      'Use Button or another shared semantic action primitive for clickable rows; do not attach onClick to div, span, li, or tr elements.',
    );
  }
  if (/<DataTableToolbar\b[^>]*(?:searchValue|onSearchChange)=/su.test(source)) {
    add(
      findings,
      'error',
      'invalid-data-table-toolbar-props',
      'DataTableToolbar uses unsupported direct search value/change props.',
      frontendSource,
      'Pass a rendered SearchInput through search={...}; pass visible controls through actions={...}.',
    );
  }
  if (/<ResourceListItem\b[^>]*\b(?:title|description|active|trailing)=/su.test(source)) {
    add(
      findings,
      'error',
      'invalid-resource-list-item-props',
      'ResourceListItem uses unsupported row props, which can render a visually blank list item.',
      frontendSource,
      'Use label for the primary text, detail for secondary text, selected for selection state, and children for badges or other extra content.',
    );
  }
  if (
    /<DataTableToolbar\b(?![^>]*\bactions=)[^>]*>[\s\S]*?<(?:ToolbarButton|Button|IconButton)\b[\s\S]*?<\/DataTableToolbar>/u.test(source)
  ) {
    add(
      findings,
      'error',
      'hidden-data-table-toolbar-actions',
      'DataTableToolbar contains action controls as children, which are not rendered by the shared primitive.',
      frontendSource,
      'Move the controls into actions={<>...</>} so management actions remain visible.',
    );
  }
  if (/<KeyValueTable\b(?![^>]*\bitems=)[^>]*(?:\/>|>[\s\S]*?<\/KeyValueTable>)/u.test(source)) {
    add(
      findings,
      'error',
      'invalid-key-value-table-content',
      'KeyValueTable requires an items array and does not render KeyValueItem children.',
      frontendSource,
      'Pass items={[{ label: "Engine", value: runtime.engine }]} to KeyValueTable, or use KeyValueList with KeyValueItem children.',
    );
  }
  if (/<IconButton\b[^>]*(?:title|aria-label)=\{?['"][^'"]*delete[^'"]*['"][^>]*>[\s\S]*?[×✕x][\s\S]*?<\/IconButton>/iu.test(source)) {
    add(
      findings,
      'error',
      'ambiguous-delete-glyph',
      'A destructive action is rendered as a close glyph, which is ambiguous in a persistent list.',
      frontendSource,
      'Use a clearly labeled destructive Button (for example, “Delete”) until a shared trash icon is available.',
    );
  }
  if (/\bheight\s*:\s*['"]calc\(100vh\b/u.test(source)) {
    add(
      findings,
      'error',
      'host-relative-viewport-height',
      'The page uses a fixed 100vh calculation inside host-owned application chrome.',
      frontendSource,
      'Use WorkbenchShell or flex/minHeight layout so dividers and panes fill the owned content region.',
    );
  }
  if (/<AppPageSection\s*>/u.test(source)) {
    add(
      findings,
      'error',
      'collapsed-app-page-section',
      'AppPageSection without props uses the default split settings layout and reserves an empty 12rem header column.',
      frontendSource,
      'For full-width content, use <AppPageSection layout="stacked"> or compose the page with WorkbenchShell.',
    );
  }
  if (/\b(?:placeholder|title|aria-label)\s*=\s*['"][^'"\n]*\\u[0-9a-f]{4}[^'"\n]*['"]/iu.test(source)) {
    add(
      findings,
      'error',
      'escaped-unicode-ui-copy',
      'A raw JSX attribute contains a Unicode escape such as \\u2026, which JSX renders as implementation text rather than decoding.',
      frontendSource,
      'Use the actual character (for example, “…”) or plain ASCII punctuation in user-facing copy.',
    );
  }
  if (/\b(?:const|let|var)\s+[\w$]+\s*=\s*pa\.storage\.(?:get|list)\s*\(/u.test(source)) {
    add(
      findings,
      'error',
      'unawaited-frontend-storage-read',
      'Frontend code treats an asynchronous pa.storage read as a synchronous value.',
      frontendSource,
      'Await pa.storage.get/list inside an async function before reading the value or putting it into React state.',
    );
  }
  const confirmResultBindings = [...source.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*await\s+pa\.ui\.confirm\s*\(/gu)].map(
    (match) => match[1]!,
  );
  const readsStructuredFrontendConfirm = confirmResultBindings.some((binding) =>
    new RegExp(`\\b${binding.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\.confirmed\\b`, 'u').test(source),
  );
  if (
    readsStructuredFrontendConfirm ||
    /\b(?:const|let|var)\s*\{[^}]*\bconfirmed\b[^}]*\}\s*=\s*await\s+pa\.ui\.confirm\s*\(/u.test(source)
  ) {
    add(
      findings,
      'error',
      'invalid-frontend-confirm-result',
      'Frontend pa.ui.confirm returns a boolean, not a structured confirmation result.',
      frontendSource,
      'Use `const confirmed = await pa.ui.confirm(...); if (!confirmed) return;`. Only backend ctx.ui.confirm returns an object with confirmed/status.',
    );
  }
}

function frontendSourceFiles(packageRoot: string): string[] {
  const srcRoot = resolve(packageRoot, 'src');
  if (!existsSync(srcRoot)) return [];
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.[jt]sx$/u.test(entry.name)) files.push(path);
    }
  };
  visit(srcRoot);
  return files;
}

function manifestPath(packageRoot: string): string {
  return resolve(packageRoot, 'extension.json');
}

function validateFrontendActionClient(frontendSource: string, frontendEntry: string | undefined, findings: ExtensionDoctorFinding[]) {
  const candidates = [frontendSource, frontendEntry].filter((path): path is string => typeof path === 'string' && existsSync(path));
  for (const path of candidates) {
    const source = readFileSync(path, 'utf8');
    if (/\bpa\.actions\b/.test(source)) {
      add(
        findings,
        'error',
        'deprecated-frontend-action-client',
        'Frontend code uses pa.actions, but the packaged runtime exposes backend calls through pa.extension.invoke(actionId, input).',
        path,
        'Replace pa.actions.call(actionId, input) with pa.extension.invoke(actionId, input).',
      );
    }
  }
}

function validateBackendWorkerDeclarations(manifest: ExtensionManifest, manifestPath: string, findings: ExtensionDoctorFinding[]) {
  for (const action of manifest.backend?.actions ?? []) {
    if (action.worker?.enabled !== true) {
      add(
        findings,
        'error',
        'missing-worker-enabled',
        `Backend action "${action.id}" must declare worker.enabled before it can run.`,
        manifestPath,
        `Add "worker": { "enabled": true } to backend.actions entry "${action.id}" when the handler only uses worker-safe context capabilities.`,
      );
    }
  }
  for (const route of manifest.backend?.routes ?? []) {
    if (route.worker?.enabled !== true) {
      add(
        findings,
        'error',
        'missing-worker-enabled',
        `Backend route "${route.method} ${route.path}" must declare worker.enabled before it can run.`,
        manifestPath,
        `Add "worker": { "enabled": true } to backend.routes entry "${route.method} ${route.path}" when the route is non-streaming and worker-safe.`,
      );
    }
  }
  for (const service of manifest.backend?.services ?? []) {
    if (service.worker?.enabled !== true) {
      add(
        findings,
        'error',
        'missing-worker-enabled',
        `Backend service "${service.id}" must declare worker.enabled before it can run.`,
        manifestPath,
        `Add "worker": { "enabled": true } to backend.services entry "${service.id}" when the service only uses worker-safe context capabilities.`,
      );
    }
  }
}

function isSourceBackendEntry(entryPath: string): boolean {
  return /\.[cm]?tsx?$/.test(entryPath);
}

function resolveBackendRuntimeEntry(packageRoot: string, manifest: ExtensionManifest): string | undefined {
  const backendEntry = manifest.backend?.entry;
  if (!backendEntry) return undefined;
  return resolve(packageRoot, isSourceBackendEntry(backendEntry) ? 'dist/backend.mjs' : backendEntry);
}

function latestMtimeUnder(path: string): number | null {
  if (!existsSync(path)) return null;
  const stats = statSync(path);
  if (stats.isFile()) return stats.mtimeMs;
  if (!stats.isDirectory()) return null;

  let latest: number | null = null;
  for (const dirent of readdirSync(path, { withFileTypes: true })) {
    if (dirent.name === 'node_modules' || dirent.name === 'dist' || dirent.name === '.git') continue;
    const childLatest = latestMtimeUnder(resolve(path, dirent.name));
    if (childLatest !== null && (latest === null || childLatest > latest)) latest = childLatest;
  }
  return latest;
}

function validateDistFreshness(
  packageRoot: string,
  manifest: ExtensionManifest | LoadedExtensionManifest,
  findings: ExtensionDoctorFinding[],
) {
  const sourceLatest = Math.max(
    latestMtimeUnder(resolve(packageRoot, 'src')) ?? 0,
    latestMtimeUnder(resolve(packageRoot, 'extension.json')) ?? 0,
  );
  if (sourceLatest <= 0) return;

  const severity: ExtensionDoctorSeverity = (manifest as LoadedExtensionManifest).packageType === 'system' ? 'error' : 'warning';
  const frontendEntry = manifest.frontend?.entry ? resolve(packageRoot, manifest.frontend.entry) : undefined;
  if (frontendEntry && existsSync(frontendEntry) && statSync(frontendEntry).mtimeMs + 1000 < sourceLatest) {
    add(
      findings,
      severity,
      'stale-frontend-dist',
      'dist frontend output is older than extension source or manifest.',
      frontendEntry,
      'Rebuild the extension.',
    );
  }

  const backendEntry = resolveBackendRuntimeEntry(packageRoot, manifest);
  if (backendEntry && existsSync(backendEntry) && statSync(backendEntry).mtimeMs + 1000 < sourceLatest) {
    add(
      findings,
      severity,
      'stale-backend-dist',
      'dist backend output is older than extension source or manifest.',
      backendEntry,
      'Rebuild the extension.',
    );
  }
}

async function validateBuiltImports(
  packageRoot: string,
  manifest: ExtensionManifest,
  findings: ExtensionDoctorFinding[],
  isUserPackage: boolean,
) {
  await init;
  const frontendEntry = manifest.frontend?.entry ? resolve(packageRoot, manifest.frontend.entry) : undefined;
  const backendEntry = resolveBackendRuntimeEntry(packageRoot, manifest);
  if (frontendEntry && existsSync(frontendEntry)) validatePortableImports(frontendEntry, findings, 'frontend', isUserPackage);
  if (backendEntry && existsSync(backendEntry)) validatePortableImports(backendEntry, findings, 'backend', isUserPackage);
}

async function validateBackendImport(packageRoot: string, manifest: ExtensionManifest, findings: ExtensionDoctorFinding[]) {
  const backendEntry = resolveBackendRuntimeEntry(packageRoot, manifest);
  if (!backendEntry || !existsSync(backendEntry)) return;
  try {
    await import(`${pathToFileURL(backendEntry).href}?paDoctor=${Date.now()}`);
  } catch (error) {
    add(
      findings,
      'error',
      'backend-import-failed',
      `Backend module failed to import: ${error instanceof Error ? error.message : String(error)}`,
      backendEntry,
    );
  }
}

function validatePortableImports(
  filePath: string,
  findings: ExtensionDoctorFinding[],
  side: 'frontend' | 'backend',
  isUserPackage: boolean,
) {
  const source = readFileSync(filePath, 'utf8');
  const [imports] = parse(source);
  for (const importRecord of imports) {
    const specifier = importRecord.n;
    if (!specifier) continue;
    if (side === 'backend' && isUserPackage && forbiddenUserBackendImports.has(specifier)) {
      add(
        findings,
        'error',
        'forbidden-backend-runtime-import',
        `User backend bundle imports forbidden host module: ${specifier}`,
        filePath,
      );
      continue;
    }
    if (specifier.startsWith('/') || specifier.startsWith('file:')) {
      add(
        findings,
        'error',
        'non-portable-import',
        `${side} bundle contains non-portable import: ${specifier}`,
        filePath,
        'Rebuild with the app builder and avoid absolute/file imports.',
      );
      continue;
    }
    if (side === 'backend' && !specifier.startsWith('.') && !specifier.startsWith('data:') && !nodeBuiltins.has(specifier)) {
      if (forbiddenPackagedBackendPrefixes.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))) {
        add(
          findings,
          'error',
          'forbidden-backend-runtime-import',
          `Backend bundle contains forbidden packaged-runtime import: ${specifier}`,
          filePath,
        );
      }
    }
  }
}

function validateFrontendBundleRuntime(filePath: string, findings: ExtensionDoctorFinding[]) {
  const source = readFileSync(filePath, 'utf8');
  const forbiddenNeedles = ['ReactCurrentDispatcher', 'dispatcher.useState', 'function useState'];
  const bundledReactNeedles = forbiddenNeedles.filter((needle) => source.includes(needle));
  if (bundledReactNeedles.length > 0) {
    add(
      findings,
      'error',
      'bundled-react-runtime',
      `Frontend bundle appears to include React runtime internals: ${bundledReactNeedles.join(', ')}.`,
      filePath,
      'Rebuild with the app extension builder so React is provided by the host runtime.',
    );
  }
  if (source.includes('import.meta.glob')) {
    add(
      findings,
      'error',
      'uncompiled-vite-glob',
      'Frontend bundle contains import.meta.glob, which will not run when served as an extension module.',
      filePath,
      'Rebuild with the app extension builder and avoid bundling host Vite-only modules.',
    );
  }
}

function validateForbiddenSourceImports(filePath: string, findings: ExtensionDoctorFinding[]) {
  const source = readFileSync(filePath, 'utf8');
  const withoutComments = maskComments(source);
  const code = maskNonCode(source);
  for (const specifier of forbiddenUserBackendImports) {
    const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (new RegExp(`\\b(?:from\\s*|import\\s*(?:\\(\\s*)?|require\\s*\\()\\s*['"]${escaped}['"]`, 'u').test(withoutComments)) {
      add(
        findings,
        'error',
        'forbidden-process-import',
        `User backend source imports forbidden host module ${specifier}; use the typed ctx capability instead.`,
        filePath,
      );
    }
  }
  if (/\bprocess\s*\./u.test(code) || /\bprocess\s*\[/u.test(code)) {
    add(
      findings,
      'error',
      'forbidden-process-access',
      'User backend source accesses the host process directly.',
      filePath,
      'Use ExtensionBackendContext capabilities; environment variables and process globals are outside the extension boundary.',
    );
  }
  if (/\b(?:eval|Function)\s*\(|\bglobalThis\b|\bimport\s*\(/u.test(code)) {
    add(
      findings,
      'error',
      'forbidden-dynamic-code',
      'User backend source uses dynamic code, dynamic imports, or host globals.',
      filePath,
      'Use static imports and ExtensionBackendContext capabilities only.',
    );
  }
}

function hasAnyPermission(manifest: ExtensionManifest, expected: string[]): boolean {
  return manifestHasAnyPermission(manifest, expected as ExtensionPermission[]);
}

function validateBackendCapabilityPermissions(
  manifest: ExtensionManifest,
  source: string,
  sourcePath: string,
  findings: ExtensionDoctorFinding[],
): void {
  if (!source) return;
  const requirements = [
    { pattern: /\bctx\.storage\.(?:get|list)\s*\(/u, permissions: ['storage:read', 'storage:readwrite'], capability: 'storage reads' },
    { pattern: /\bctx\.storage\.(?:put|delete)\s*\(/u, permissions: ['storage:write', 'storage:readwrite'], capability: 'storage writes' },
    { pattern: /\bctx\.secrets\.get\s*\(/u, permissions: ['secrets:read'], capability: 'secret reads' },
    { pattern: /\bctx\.shell\.(?:exec|spawn)\s*\(/u, permissions: ['shell:execute'], capability: 'shell execution' },
    {
      pattern: /\bctx\.filesystem\.(?:requestRoot|workspace|app|cache|temp)\s*\(/u,
      permissions: ['filesystem:read', 'filesystem:write', 'filesystem:readwrite'],
      capability: 'filesystem access',
    },
    {
      pattern: /\bctx\.extensions\.(?:callAction|listActions|getStatus)\s*\(/u,
      permissions: ['extensions:read'],
      capability: 'extension reads/calls',
    },
    { pattern: /\bctx\.extensions\.setEnabled\s*\(/u, permissions: ['extensions:write'], capability: 'extension writes' },
    { pattern: /\bctx\.ui\.confirm\s*\(/u, permissions: ['ui:confirm'], capability: 'confirmation UI' },
    { pattern: /\bctx\.ui\.invalidate\s*\(/u, permissions: ['ui:invalidate'], capability: 'UI invalidation' },
    { pattern: /\bctx\.notify\.(?:toast|system|setBadge|clearBadge)\s*\(/u, permissions: ['ui:notify'], capability: 'notifications' },
  ];
  for (const requirement of requirements) {
    if (!requirement.pattern.test(source) || hasAnyPermission(manifest, requirement.permissions)) continue;
    add(
      findings,
      'error',
      'missing-capability-permission',
      `Backend source uses ${requirement.capability} but does not declare one of: ${requirement.permissions.join(', ')}.`,
      sourcePath,
    );
  }
}

function validateContributedActionReferences(manifest: ExtensionManifest, findings: ExtensionDoctorFinding[]): void {
  const backendActions = new Set((manifest.backend?.actions ?? []).map((action) => action.id));
  const references = [
    ...(manifest.contributes?.commands ?? []).map((item) => ({ kind: 'command', id: item.id, action: item.action })),
    ...(manifest.contributes?.contextMenus ?? []).map((item) => ({ kind: 'context menu', id: item.id, action: item.action })),
    ...(manifest.contributes?.toolbarActions ?? []).map((item) => ({ kind: 'toolbar action', id: item.id, action: item.action })),
    ...(manifest.contributes?.messageActions ?? []).map((item) => ({ kind: 'message action', id: item.id, action: item.action })),
    ...(manifest.contributes?.statusBarItems ?? [])
      .filter((item) => typeof item.action === 'string')
      .map((item) => ({ kind: 'status item', id: item.id, action: item.action! })),
  ];
  for (const reference of references) {
    if (backendActions.has(reference.action) || isKnownHostCommand(reference.action)) continue;
    add(
      findings,
      'error',
      'dangling-contributed-action',
      `Contributed ${reference.kind} "${reference.id}" references unknown action "${reference.action}".`,
      undefined,
      'Reference a declared backend action or a documented host command.',
    );
  }
}

function validateExternalApplicationNavigation(manifest: ExtensionManifest, findings: ExtensionDoctorFinding[]): void {
  for (const item of manifest.contributes?.nav ?? []) {
    if (!item.applicationId || item.applicationId.startsWith(`${manifest.id}:`)) continue;
    const separator = item.applicationId.indexOf(':');
    if (separator <= 0) continue;
    const targetExtensionId = item.applicationId.slice(0, separator);
    const target = findExtensionEntry(targetExtensionId);
    const application = target?.manifest.contributes?.applications?.find(
      (candidate) => `${targetExtensionId}:${candidate.id}` === item.applicationId,
    );
    if (!application) {
      add(
        findings,
        'error',
        'unknown-target-application',
        `Navigation "${item.id}" targets unavailable application "${item.applicationId}".`,
      );
      continue;
    }
    if (item.slot && !(application.navigationSlots ?? []).some((slot) => slot.id === item.slot)) {
      add(
        findings,
        'error',
        'unknown-target-navigation-slot',
        `Navigation "${item.id}" targets undeclared slot "${item.slot}" in application "${item.applicationId}".`,
      );
    }
  }
}

function collectFrontendComponents(manifest: ExtensionManifest): string[] {
  const contributions = manifest.contributes;
  const viewComponents = (contributions?.views ?? []).flatMap((item) => {
    if (typeof item.component === 'string') return [item.component];
    if (!item.component || typeof item.component !== 'object' || !('overrides' in item.component)) return [];
    const overrides = item.component.overrides;
    return overrides && typeof overrides === 'object'
      ? Object.values(overrides).filter((value): value is string => typeof value === 'string')
      : [];
  });
  return [
    ...viewComponents,
    ...(contributions?.composerControls ?? []).map((item) => item.component),
    ...(contributions?.composerInputTools ?? []).map((item) => item.component),
    ...(contributions?.composerShelves ?? []).map((item) => item.component),
    ...(contributions?.topBarElements ?? []).map((item) => item.component),
    ...(contributions?.conversationHeaderElements ?? []).map((item) => item.component),
    ...(contributions?.conversationDecorators ?? []).map((item) => item.component),
    ...(contributions?.conversationLifecycle ?? []).map((item) => item.component),
    ...(contributions?.newConversationPanels ?? []).map((item) => item.component),
    ...(contributions?.statusBarItems ?? []).map((item) => item.component).filter(Boolean),
    ...(contributions?.transcriptRenderers ?? []).map((item) => item.component),
    ...(contributions?.transcriptBlocks ?? []).map((item) => item.component),
    ...(contributions?.threadHeaderActions ?? []).map((item) => item.component),
    ...(contributions?.activityTreeItemElements ?? []).map((item) => item.component),
    ...(contributions?.composerAttachmentRenderers ?? []).map((item) => item.component),
    contributions?.settingsComponent?.component,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function hasExport(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`export\\s+(async\\s+)?function\\s+${escaped}\\b`).test(source) ||
    new RegExp(`export\\s+(const|let|var|class)\\s+${escaped}\\b`).test(source) ||
    new RegExp(`export\\s*\\{[^}]*\\b${escaped}\\b`).test(source)
  );
}

function add(
  findings: ExtensionDoctorFinding[],
  severity: ExtensionDoctorSeverity,
  code: string,
  message: string,
  path?: string,
  fix?: string,
) {
  findings.push({ severity, code, message, ...(path ? { path } : {}), ...(fix ? { fix } : {}) });
}

function report(
  extensionId: string,
  packageRoot: string,
  manifest: ExtensionManifest | undefined,
  findings: ExtensionDoctorFinding[],
): ExtensionDoctorReport {
  const summary = {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  };
  return { ok: summary.errors === 0, extensionId, packageRoot, ...(manifest ? { manifest } : {}), findings, summary };
}
