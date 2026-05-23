import { readFileSync } from 'node:fs';

import { isRecord } from './extensionRegistryConfig.js';

export function fallbackInvalidExtensionId(packageRoot: string): string {
  return packageRoot.split(/[\\/]/).filter(Boolean).at(-1) ?? 'invalid-extension';
}

export function readInvalidExtensionManifestMetadata(manifestPath: string, packageRoot: string): { id: string; name: string } {
  let id = fallbackInvalidExtensionId(packageRoot);
  let name = id;
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown;
    if (isRecord(raw)) {
      if (typeof raw.id === 'string' && raw.id.trim()) id = raw.id.trim();
      if (typeof raw.name === 'string' && raw.name.trim()) name = raw.name.trim();
    }
  } catch {
    // Keep path-derived fallback metadata.
  }
  return { id, name };
}
