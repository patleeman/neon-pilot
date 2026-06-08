import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dynamicImport = <T>(specifier: string): Promise<T> => import(specifier) as Promise<T>;

interface ResolveServerModuleSpecifierOptions {
  importMetaUrl: string;
  relativeSpecifier: string;
  normalize?: (relativeSpecifier: string) => string;
  resourcesPath?: string;
}

export function normalizeServerModuleSpecifier(relativeSpecifier: string): string {
  return relativeSpecifier.replace(/^\.\.\/\.\.\//, '').replace(/^\/+/, '');
}

export function normalizeServerExtensionModuleSpecifier(relativeSpecifier: string): string {
  return relativeSpecifier.replace(/^\.\.\//, 'extensions/').replace(/^\/+/, '');
}

function packageEntryCandidates(specifier: string, resourcesPath: string | undefined): string[] {
  const repoRoots = [process.env.NEON_PILOT_REPO_ROOT, process.cwd()].filter((value): value is string => Boolean(value));
  const desktopRoots = repoRoots.flatMap((root) => [resolve(root, 'packages/desktop'), root]);
  const candidates: string[] = [];
  const pushRepoPath = (relativePath: string) => {
    for (const repoRoot of repoRoots) candidates.push(resolve(repoRoot, relativePath));
  };
  const pushDesktopPath = (relativePath: string) => {
    for (const desktopRoot of desktopRoots) candidates.push(resolve(desktopRoot, relativePath));
  };
  const pushResourcePath = (relativePath: string) => {
    if (typeof resourcesPath !== 'string') return;
    candidates.push(resolve(resourcesPath, 'app.asar', relativePath));
    candidates.push(resolve(resourcesPath, 'app.asar.unpacked', relativePath));
  };

  if (specifier === '@neon-pilot/core') {
    pushRepoPath('packages/desktop/server/dist/core/index.js');
    pushRepoPath('packages/desktop/dist/server/core/index.js');
    pushRepoPath('packages/core/dist/index.js');
    pushDesktopPath('server/dist/core/index.js');
    pushDesktopPath('dist/server/core/index.js');
    pushResourcePath('server/dist/core/index.js');
    pushResourcePath('packages/desktop/server/dist/core/index.js');
    pushResourcePath('packages/desktop/dist/server/core/index.js');
    pushResourcePath('packages/core/dist/index.js');
  } else if (specifier === '@neon-pilot/daemon') {
    pushRepoPath('packages/desktop/server/dist/daemon/index.js');
    pushDesktopPath('server/dist/daemon/index.js');
    pushDesktopPath('dist/server/daemon/index.js');
    pushResourcePath('packages/desktop/server/dist/daemon/index.js');
    pushResourcePath('server/dist/daemon/index.js');
  } else if (specifier === '@earendil-works/pi-coding-agent') {
    pushRepoPath('node_modules/@earendil-works/pi-coding-agent/dist/index.js');
    pushResourcePath('node_modules/@earendil-works/pi-coding-agent/dist/index.js');
  }

  return candidates;
}

export function resolveServerModuleSpecifierFrom({
  importMetaUrl,
  relativeSpecifier,
  normalize = normalizeServerModuleSpecifier,
  resourcesPath: providedResourcesPath,
}: ResolveServerModuleSpecifierOptions): string {
  const resourcesPath = providedResourcesPath ?? process.resourcesPath;
  if (!relativeSpecifier.startsWith('.')) {
    const foundPackageEntry = packageEntryCandidates(relativeSpecifier, resourcesPath).find((candidate) => existsSync(candidate));
    return foundPackageEntry ? pathToFileURL(foundPackageEntry).href : relativeSpecifier;
  }

  const normalized = normalize(relativeSpecifier);

  // Derive an additional candidate from importMetaUrl when available.
  // This handles bundled extension backend modules whose relative paths
  // (originally relative to packages/desktop/server/extensions/backendApi/)
  // need to resolve against the repo root.  Walk up from the bundle's
  // location until we find packages/desktop/dist/server or hit the fs root.
  const importMetaCandidate =
    !process.env.NEON_PILOT_REPO_ROOT && isFileUrl(importMetaUrl) ? resolveRepoRootFromImportMeta(importMetaUrl, normalized) : undefined;

  const candidates = [
    ...(process.env.NEON_PILOT_REPO_ROOT
      ? [
          resolve(process.env.NEON_PILOT_REPO_ROOT, 'packages/desktop/server/dist', normalized),
          resolve(process.env.NEON_PILOT_REPO_ROOT, 'packages/desktop/dist/server', normalized),
        ]
      : []),
    resolve(process.cwd(), 'packages/desktop/server/dist', normalized),
    resolve(process.cwd(), 'server/dist', normalized),
    resolve(process.cwd(), 'packages/desktop/dist/server', normalized),
    resolve(process.cwd(), 'dist/server', normalized),
    ...(importMetaCandidate ? [importMetaCandidate] : []),
    ...(typeof resourcesPath === 'string'
      ? [
          resolve(resourcesPath, 'app.asar.unpacked/packages/desktop/server/dist', normalized),
          resolve(resourcesPath, 'app.asar.unpacked/packages/desktop/dist/server', normalized),
          resolve(resourcesPath, 'app.asar.unpacked/server/dist', normalized),
          resolve(resourcesPath, 'app.asar/server/dist', normalized),
          resolve(resourcesPath, 'server/dist', normalized),
        ]
      : []),
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  return found ? pathToFileURL(found).href : relativeSpecifier;
}

/** True when the string looks like a file:// URL. */
function isFileUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'file:';
  } catch {
    return false;
  }
}

/**
 * Walk up from the given file URL's directory looking for
 * packages/desktop/dist/server/{normalized}.  This lets bundled
 * extension modules (living under extensions/.../dist/backend.mjs)
 * resolve server-relative paths without NEON_PILOT_REPO_ROOT.
 */
function resolveRepoRootFromImportMeta(importMetaUrl: string, normalized: string): string | undefined {
  try {
    let dir = new URL(importMetaUrl).pathname;
    // Make sure we start with a directory (strip filename)
    if (!dir.endsWith('/')) dir = dir.slice(0, dir.lastIndexOf('/'));
    const markerSegments = ['packages', 'desktop', 'dist', 'server'];
    for (;;) {
      // Check if this directory has the expected marker
      const checkPath = resolve(dir, ...markerSegments);
      if (existsSync(checkPath)) {
        return resolve(dir, ...markerSegments, normalized);
      }
      // Walk up
      const parent = resolve(dir, '..');
      if (parent === dir) break; // hit filesystem root
      dir = parent;
    }
  } catch {
    // Ignore resolution failures
  }
  return undefined;
}

export function resolveServerModuleSpecifier(relativeSpecifier: string): string {
  return resolveServerModuleSpecifierFrom({ importMetaUrl: import.meta.url, relativeSpecifier });
}

export function resolveServerExtensionModuleSpecifier(relativeSpecifier: string): string {
  return resolveServerModuleSpecifierFrom({
    importMetaUrl: import.meta.url,
    relativeSpecifier,
    normalize: normalizeServerExtensionModuleSpecifier,
  });
}

export async function importServerModule<T = Record<string, unknown>>(relativeSpecifier: string): Promise<T> {
  return dynamicImport<T>(resolveServerModuleSpecifier(relativeSpecifier));
}

export async function importServerExtensionModule<T = Record<string, unknown>>(relativeSpecifier: string): Promise<T> {
  return dynamicImport<T>(resolveServerExtensionModuleSpecifier(relativeSpecifier));
}

export async function callServerModuleExport<T>(relativeSpecifier: string, name: string, ...args: unknown[]): Promise<T> {
  const module = await importServerModule<Record<string, unknown>>(relativeSpecifier);
  const fn = module[name];
  if (typeof fn !== 'function') throw new Error(`Backend API export ${name} is unavailable.`);
  return (fn as (...callArgs: unknown[]) => Promise<T> | T)(...args);
}
