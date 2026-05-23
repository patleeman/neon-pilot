import { EXTENSION_HOST_VIEW_COMPONENTS, getHostViewComponentDefinition } from './extensionManifest.js';
import { requireString, validateEnum, validateOptionalString } from './extensionManifestValidation.js';
import { isRecord } from './extensionRegistryConfig.js';

export function validateThemeTokens(value: unknown, path: string): void {
  if (!isRecord(value)) {
    throw new Error(`Extension manifest ${path} must be an object.`);
  }

  for (const [key, tokenValue] of Object.entries(value)) {
    if (!/^--color-[a-z0-9-]+$/.test(key)) {
      throw new Error(`Extension manifest ${path}.${key} must be a --color-* CSS variable.`);
    }
    if (typeof tokenValue !== 'string' || !/^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(tokenValue.trim())) {
      throw new Error(`Extension manifest ${path}.${key} must be an RGB triplet string like "187 154 247".`);
    }
  }
}

export function validateViewComponent(value: unknown, path: string): void {
  if (typeof value === 'string' && value.trim().length > 0) {
    return;
  }
  if (!isRecord(value)) {
    throw new Error(`Extension manifest ${path} must be a component export string or host component object.`);
  }
  const host = requireString(value.host, `${path}.host`);
  validateEnum(host, EXTENSION_HOST_VIEW_COMPONENTS, `${path}.host`);
  const definition = getHostViewComponentDefinition(host);
  const allowedOverrideSlots = Object.keys(definition?.overrideSlots ?? {});
  validateOptionalString(value.override, `${path}.override`);
  if (value.props !== undefined && !isRecord(value.props)) {
    throw new Error(`Extension manifest ${path}.props must be an object.`);
  }
  if (value.overrides !== undefined) {
    if (!isRecord(value.overrides)) {
      throw new Error(`Extension manifest ${path}.overrides must be an object.`);
    }
    for (const [slot, exportName] of Object.entries(value.overrides)) {
      if (!allowedOverrideSlots.includes(slot)) {
        throw new Error(`Extension manifest ${path}.overrides.${slot} must be one of: ${allowedOverrideSlots.join(', ')}.`);
      }
      requireString(exportName, `${path}.overrides.${slot}`);
    }
  }
  if (value.override !== undefined && !allowedOverrideSlots.includes('wrapper')) {
    throw new Error(`Extension manifest ${path}.override is only supported by host components with a wrapper slot.`);
  }
}
