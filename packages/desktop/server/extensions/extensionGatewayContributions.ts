import type { ExtensionPackageType } from './extensionManifest.js';
import { assertRecordArray, requireString, validateEnum, validateOptionalString } from './extensionManifestValidation.js';
import type { ExtensionRegistryEntry } from './extensionRegistry.js';

const GATEWAY_CONFIGURATION_LOCATIONS = ['gateways', 'settings', 'extension', 'external'] as const;
const GATEWAY_PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i;

export interface ExtensionGatewayProviderRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  label: string;
  description?: string;
  icon?: string;
  implemented: boolean;
  configurationLocation: (typeof GATEWAY_CONFIGURATION_LOCATIONS)[number];
  setupRoute?: string;
  docsUrl?: string;
  order?: number;
}

export function validateGatewayProviderContributions(value: unknown): void {
  for (const [index, provider] of assertRecordArray(value, 'contributes.gatewayProviders').entries()) {
    const id = requireString(provider.id, `contributes.gatewayProviders[${index}].id`);
    if (!GATEWAY_PROVIDER_ID_PATTERN.test(id)) {
      throw new Error(
        `Extension manifest contributes.gatewayProviders[${index}].id must start with an alphanumeric character and contain only letters, numbers, _, ., :, or -.`,
      );
    }
    requireString(provider.label, `contributes.gatewayProviders[${index}].label`);
    validateOptionalString(provider.description, `contributes.gatewayProviders[${index}].description`);
    validateOptionalString(provider.icon, `contributes.gatewayProviders[${index}].icon`);
    if (provider.configurationLocation !== undefined) {
      validateEnum(
        provider.configurationLocation,
        GATEWAY_CONFIGURATION_LOCATIONS,
        `contributes.gatewayProviders[${index}].configurationLocation`,
      );
    }
    validateOptionalString(provider.setupRoute, `contributes.gatewayProviders[${index}].setupRoute`);
    validateOptionalString(provider.docsUrl, `contributes.gatewayProviders[${index}].docsUrl`);
    if (provider.implemented !== undefined && typeof provider.implemented !== 'boolean') {
      throw new Error(`Extension manifest contributes.gatewayProviders[${index}].implemented must be a boolean.`);
    }
    if (provider.order !== undefined && (typeof provider.order !== 'number' || !Number.isInteger(provider.order))) {
      throw new Error(`Extension manifest contributes.gatewayProviders[${index}].order must be an integer.`);
    }
  }
}

export function buildExtensionGatewayProviderRegistrations(entry: ExtensionRegistryEntry): ExtensionGatewayProviderRegistration[] {
  const packageType = entry.manifest.packageType ?? 'user';
  return (entry.manifest.contributes?.gatewayProviders ?? []).map((provider) => ({
    extensionId: entry.manifest.id,
    packageType,
    id: provider.id,
    label: provider.label,
    ...(provider.description ? { description: provider.description } : {}),
    ...(provider.icon ? { icon: provider.icon } : {}),
    implemented: provider.implemented ?? true,
    configurationLocation: provider.configurationLocation ?? 'extension',
    ...(provider.setupRoute ? { setupRoute: provider.setupRoute } : {}),
    ...(provider.docsUrl ? { docsUrl: provider.docsUrl } : {}),
    ...(provider.order !== undefined ? { order: provider.order } : {}),
  }));
}
