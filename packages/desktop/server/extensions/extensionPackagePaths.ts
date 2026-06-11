import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readConfiguredExtensionPaths, readEnvironmentExtensionPaths } from './extensionSearchPaths.js';

export interface ExtensionPackagePath {
  packageRoot: string;
  source: 'bundled' | 'external';
}

const DEFAULT_INSTALLABLE_EXTENSION_IDS = new Set(['system-dynamic-workflows']);

function resolveExplicitRepoRoot(): string | null {
  const repoRoot = process.env.NEON_PILOT_REPO_ROOT?.trim();
  if (!repoRoot) return null;
  const resolved = resolve(repoRoot);
  return existsSync(resolve(resolved, 'packages')) ? resolved : null;
}

function candidateBundledExtensionRoots(): string[] {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const explicitRepoRoot = resolveExplicitRepoRoot();
  return [
    explicitRepoRoot ? resolve(explicitRepoRoot, 'extensions') : null,
    resolve(process.cwd(), 'extensions'),
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'extensions') : null,
    resolve(currentDir, '../../../../extensions'),
    resolve(currentDir, '../../../../../extensions'),
  ].filter((value): value is string => Boolean(value));
}

function shouldLoadBundledExtension(packageRoot: string, source: ExtensionPackagePath['source']): boolean {
  if (source !== 'bundled') return true;
  return !DEFAULT_INSTALLABLE_EXTENSION_IDS.has(basename(packageRoot));
}

function expandExtensionPath(rootOrPackage: string, source: ExtensionPackagePath['source']): ExtensionPackagePath[] {
  const root = resolve(rootOrPackage);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return [];
  }

  if (existsSync(resolve(root, 'extension.json'))) {
    return shouldLoadBundledExtension(root, source) ? [{ packageRoot: root, source }] : [];
  }

  return readdirSync(root)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((entryName): ExtensionPackagePath[] => {
      const packageRoot = resolve(root, entryName);
      if (!statSync(packageRoot).isDirectory() || !existsSync(resolve(packageRoot, 'extension.json'))) {
        return [];
      }
      return shouldLoadBundledExtension(packageRoot, source) ? [{ packageRoot, source }] : [];
    });
}

export function listExtensionPackagePaths(options: { runtimeRoot?: string } = {}): ExtensionPackagePath[] {
  const seen = new Set<string>();
  const inputs: Array<{ path: string; source: ExtensionPackagePath['source'] }> = [
    ...candidateBundledExtensionRoots().map((path) => ({ path, source: 'bundled' as const })),
    ...(options.runtimeRoot ? [{ path: options.runtimeRoot, source: 'external' as const }] : []),
    ...readConfiguredExtensionPaths().map((path) => ({ path, source: 'external' as const })),
    ...readEnvironmentExtensionPaths().map((path) => ({ path, source: 'external' as const })),
  ];

  const cwd = resolve(process.cwd());
  const resourcesRoot =
    typeof process.resourcesPath === 'string' && existsSync(resolve(process.resourcesPath))
      ? realpathSync(resolve(process.resourcesPath))
      : null;
  const explicitRepoRoot = resolveExplicitRepoRoot();
  const explicitRepoRootReal = explicitRepoRoot ? realpathSync(explicitRepoRoot) : null;
  return inputs
    .flatMap(({ path, source }) => expandExtensionPath(path, source))
    .sort((left, right) => {
      const leftRealPackageRoot = realpathSync(left.packageRoot);
      const rightRealPackageRoot = realpathSync(right.packageRoot);
      const leftInExplicitRepo = explicitRepoRootReal
        ? leftRealPackageRoot === explicitRepoRootReal || leftRealPackageRoot.startsWith(`${explicitRepoRootReal}/`)
        : false;
      const rightInExplicitRepo = explicitRepoRootReal
        ? rightRealPackageRoot === explicitRepoRootReal || rightRealPackageRoot.startsWith(`${explicitRepoRootReal}/`)
        : false;
      if (leftInExplicitRepo !== rightInExplicitRepo) return leftInExplicitRepo ? -1 : 1;

      const leftInResources = resourcesRoot
        ? leftRealPackageRoot === resourcesRoot || leftRealPackageRoot.startsWith(`${resourcesRoot}/`)
        : false;
      const rightInResources = resourcesRoot
        ? rightRealPackageRoot === resourcesRoot || rightRealPackageRoot.startsWith(`${resourcesRoot}/`)
        : false;
      const leftInAsar = left.packageRoot.includes('.asar/');
      const rightInAsar = right.packageRoot.includes('.asar/');
      if (leftInResources !== rightInResources) return leftInResources ? -1 : 1;
      if (leftInAsar !== rightInAsar) return leftInAsar ? 1 : -1;

      const leftInCwd = left.packageRoot === cwd || left.packageRoot.startsWith(`${cwd}/`);
      const rightInCwd = right.packageRoot === cwd || right.packageRoot.startsWith(`${cwd}/`);
      if (leftInCwd !== rightInCwd) return leftInCwd ? -1 : 1;
      return 0;
    })
    .filter((entry) => {
      const key = entry.packageRoot;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
