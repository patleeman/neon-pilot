import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ExtensionBackendLoadTargetEntry {
  source: 'system' | 'runtime';
  packageRoot?: string;
}

export interface PrebuiltExtensionBackendLoadTarget {
  path: string;
  hash: string;
}

function buildPrebuiltExtensionBackendLoadTarget(path: string): PrebuiltExtensionBackendLoadTarget | null {
  if (!existsSync(path) || !statSync(path).isFile()) {
    return null;
  }

  const stats = statSync(path);
  return {
    path,
    hash: `prebuilt:${stats.size}:${stats.mtimeMs}`,
  };
}

function normalizeBackendEntry(backendEntry: string): string {
  return backendEntry.trim();
}

export function isSourceExtensionBackendEntry(backendEntry: string): boolean {
  const normalizedBackendEntry = normalizeBackendEntry(backendEntry);
  return (
    normalizedBackendEntry.startsWith('src/') ||
    normalizedBackendEntry.endsWith('.ts') ||
    normalizedBackendEntry.endsWith('.tsx') ||
    normalizedBackendEntry.endsWith('.mts') ||
    normalizedBackendEntry.endsWith('.cts')
  );
}

export function resolveExtensionBackendLoadTarget(
  entry: ExtensionBackendLoadTargetEntry,
  backendEntry: string,
): PrebuiltExtensionBackendLoadTarget | null {
  if (!entry.packageRoot) {
    return null;
  }

  const normalizedBackendEntry = normalizeBackendEntry(backendEntry);
  if (normalizedBackendEntry.length === 0) {
    return null;
  }

  if (isSourceExtensionBackendEntry(normalizedBackendEntry)) {
    return buildPrebuiltExtensionBackendLoadTarget(resolve(entry.packageRoot, 'dist', 'backend.mjs'));
  }

  return buildPrebuiltExtensionBackendLoadTarget(resolve(entry.packageRoot, normalizedBackendEntry));
}

export function resolvePrebuiltSystemExtensionBackend(entry: ExtensionBackendLoadTargetEntry): PrebuiltExtensionBackendLoadTarget | null {
  if (entry.source !== 'system' || !entry.packageRoot) {
    return null;
  }

  return buildPrebuiltExtensionBackendLoadTarget(resolve(entry.packageRoot, 'dist', 'backend.mjs'));
}
