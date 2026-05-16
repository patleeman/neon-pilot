import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readConfiguredExtensionPaths, readEnvironmentExtensionPaths } from './extensionSearchPaths.js';

export interface ExtensionPackagePath {
  packageRoot: string;
  source: 'bundled' | 'experimental' | 'external';
}

function candidateBundledExtensionRoots(): string[] {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return [
    process.env.PERSONAL_AGENT_REPO_ROOT ? resolve(process.env.PERSONAL_AGENT_REPO_ROOT, 'extensions') : null,
    resolve(process.cwd(), 'extensions'),
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'extensions') : null,
    resolve(currentDir, '../../../../extensions'),
    resolve(currentDir, '../../../../../extensions'),
  ].filter((value): value is string => Boolean(value));
}

function candidateExperimentalExtensionRoots(): string[] {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return [
    process.env.PERSONAL_AGENT_REPO_ROOT ? resolve(process.env.PERSONAL_AGENT_REPO_ROOT, 'experimental-extensions/extensions') : null,
    resolve(process.cwd(), 'experimental-extensions/extensions'),
    typeof process.resourcesPath === 'string' ? resolve(process.resourcesPath, 'experimental-extensions/extensions') : null,
    resolve(currentDir, '../../../../experimental-extensions/extensions'),
    resolve(currentDir, '../../../../../experimental-extensions/extensions'),
  ].filter((value): value is string => Boolean(value));
}

function expandExtensionPath(rootOrPackage: string, source: ExtensionPackagePath['source']): ExtensionPackagePath[] {
  const root = resolve(rootOrPackage);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return [];
  }

  if (existsSync(resolve(root, 'extension.json'))) {
    return [{ packageRoot: root, source }];
  }

  return readdirSync(root)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((entryName): ExtensionPackagePath[] => {
      const packageRoot = resolve(root, entryName);
      if (!statSync(packageRoot).isDirectory() || !existsSync(resolve(packageRoot, 'extension.json'))) {
        return [];
      }
      return [{ packageRoot, source }];
    });
}

export function listExtensionPackagePaths(options: { runtimeRoot?: string } = {}): ExtensionPackagePath[] {
  const seen = new Set<string>();
  const inputs: Array<{ path: string; source: ExtensionPackagePath['source'] }> = [
    ...candidateBundledExtensionRoots().map((path) => ({ path, source: 'bundled' as const })),
    ...candidateExperimentalExtensionRoots().map((path) => ({ path, source: 'experimental' as const })),
    ...(options.runtimeRoot ? [{ path: options.runtimeRoot, source: 'external' as const }] : []),
    ...readConfiguredExtensionPaths().map((path) => ({ path, source: 'external' as const })),
    ...readEnvironmentExtensionPaths().map((path) => ({ path, source: 'external' as const })),
  ];

  const cwd = resolve(process.cwd());
  const resourcesRoot =
    typeof process.resourcesPath === 'string' && existsSync(resolve(process.resourcesPath))
      ? realpathSync(resolve(process.resourcesPath))
      : null;
  return inputs
    .flatMap(({ path, source }) => expandExtensionPath(path, source))
    .sort((left, right) => {
      const leftRealPackageRoot = realpathSync(left.packageRoot);
      const rightRealPackageRoot = realpathSync(right.packageRoot);
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
