import type { ExtensionRegistryApiState } from '../client/api';

export const criticalExtensionRegistryPrewarm: Promise<ExtensionRegistryApiState> | null = import.meta.env.PROD
  ? fetch('/api/extensions/registry/critical', { cache: 'no-store' }).then((res) => {
      if (!res.ok) throw new Error(`Extension critical registry failed: ${res.status}`);
      return res.json() as Promise<ExtensionRegistryApiState>;
    })
  : null;
