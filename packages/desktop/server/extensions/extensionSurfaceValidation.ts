import { EXTENSION_ICON_NAMES, EXTENSION_PLACEMENTS, EXTENSION_SURFACE_KINDS } from './extensionManifest.js';
import { assertRecordArray, requireString, validateEnum, validateOptionalString } from './extensionManifestValidation.js';

export function validateExtensionSurfaceContributions(surfaces: unknown): void {
  for (const [index, surface] of assertRecordArray(surfaces, 'surfaces').entries()) {
    requireString(surface.id, `surfaces[${index}].id`);
    validateEnum(surface.placement, EXTENSION_PLACEMENTS, `surfaces[${index}].placement`);
    validateEnum(surface.kind, EXTENSION_SURFACE_KINDS, `surfaces[${index}].kind`);
    validateOptionalString(surface.title, `surfaces[${index}].title`);
    validateOptionalString(surface.label, `surfaces[${index}].label`);
    if (surface.icon !== undefined) validateEnum(surface.icon, EXTENSION_ICON_NAMES, `surfaces[${index}].icon`);
    validateOptionalString(surface.action, `surfaces[${index}].action`);
  }
}
