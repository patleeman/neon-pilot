import { join } from 'node:path';

import { isExtensionEnabled, listExtensionEntries } from './extensionRegistry.js';

export function listRuntimeExtensionBackendEntries(): string[] {
  return listExtensionEntries()
    .filter((entry) => {
      if (entry.source !== 'system') return true;
      return isExtensionEnabled(entry.manifest.id);
    })
    .flatMap((entry) => {
      const backend = entry.manifest.backend?.entry;
      if (!backend) return [];
      return entry.packageRoot ? [join(entry.packageRoot, backend)] : [];
    });
}
