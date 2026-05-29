import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type ExtensionManifest, type ExtensionPackageType } from './extensionManifest.js';
import { listExtensionPackagePaths } from './extensionPackagePaths.js';

type LoadedSystemExtensionManifest = ExtensionManifest & { packageType: ExtensionPackageType };

export interface SystemExtensionEntry {
  manifest: LoadedSystemExtensionManifest;
  packageRoot: string;
}

function readExtensionEntries(source: 'bundled'): SystemExtensionEntry[] {
  return listExtensionPackagePaths()
    .filter((entry) => entry.source === source)
    .flatMap((entry): SystemExtensionEntry[] => {
      try {
        const raw = JSON.parse(readFileSync(join(entry.packageRoot, 'extension.json'), 'utf-8')) as Record<string, unknown>;
        if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return [];
        const packageType: ExtensionPackageType = raw.packageType === 'user' ? 'user' : 'system';
        const manifest = raw as unknown as ExtensionManifest;
        return [{ manifest: { ...manifest, packageType }, packageRoot: entry.packageRoot }];
      } catch {
        return [];
      }
    });
}

export function readBundledExtensionEntries(): SystemExtensionEntry[] {
  return readExtensionEntries('bundled');
}

export const SYSTEM_EXTENSION_ENTRIES: SystemExtensionEntry[] = readBundledExtensionEntries();
export const SYSTEM_EXTENSIONS: LoadedSystemExtensionManifest[] = SYSTEM_EXTENSION_ENTRIES.map((entry) => entry.manifest);
