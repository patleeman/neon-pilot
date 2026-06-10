import { type ExtensionPackageType } from './extensionManifest.js';

export function buildInvalidExtensionInstallSummary(entry: {
  id: string;
  name: string;
  packageType: ExtensionPackageType;
  errors: string[];
  packageRoot?: string;
}) {
  return {
    id: entry.id,
    name: entry.name,
    packageType: entry.packageType,
    enabled: false,
    status: 'invalid' as const,
    errors: entry.errors,
    packageRoot: entry.packageRoot,
    uninstallable: Boolean(entry.packageRoot),
    manifest: { schemaVersion: 2 as const, id: entry.id, name: entry.name, packageType: entry.packageType },
    permissions: [],
    surfaces: [],
    backendActions: [],
    services: [],
    subscriptions: [],
    dependsOn: [],
    skills: [],
    mentions: [],
    tools: [],
    modelProfiles: [],
    routes: [],
  };
}
