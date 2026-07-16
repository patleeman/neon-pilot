import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const backendNames = [
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
];

export const packagedExtensionSdkSeeds = [
  'index.d.ts',
  'desktopBridge.d.ts',
  'host.d.ts',
  'ui.d.ts',
  'settings.d.ts',
  'data.d.ts',
  'composer.d.ts',
  'excalidraw.d.ts',
  'host-view-components.d.ts',
  'workbench.d.ts',
  'workbench-artifacts.d.ts',
  'workbench-browser.d.ts',
  'workbenchBrowserTabs.d.ts',
  'workbench-diffs.d.ts',
  'workbench-files.d.ts',
  'workbench-runs.d.ts',
  'workbench-transcript.d.ts',
  ...backendNames.map((name) => `backend/${name}.d.ts`),
];

function relativeDeclarationImports(source) {
  const imports = [];
  const pattern = /(?:from\s*|import\s*)['"](\.[^'"]+)['"]/gu;
  for (const match of source.matchAll(pattern)) imports.push(match[1]);
  return imports;
}

function declarationPath(from, specifier) {
  const target = normalize(join(dirname(from), specifier));
  if (target.endsWith('.js')) return `${target.slice(0, -3)}.d.ts`;
  if (target.endsWith('.d.ts')) return target;
  return `${target}.d.ts`;
}

export function resolvePackagedExtensionSdkFilter(root, seeds = packagedExtensionSdkSeeds) {
  const included = new Set(seeds);
  const missing = [];
  const pending = [...seeds];
  while (pending.length > 0) {
    const relative = pending.shift();
    const absolute = join(root, relative);
    if (!existsSync(absolute)) {
      missing.push(relative);
      continue;
    }
    for (const specifier of relativeDeclarationImports(readFileSync(absolute, 'utf8'))) {
      const dependency = declarationPath(relative, specifier);
      if (included.has(dependency)) continue;
      included.add(dependency);
      pending.push(dependency);
    }
  }
  if (missing.length > 0) throw new Error(`Missing packaged extension SDK declarations: ${missing.join(', ')}`);
  return [...included].sort();
}
