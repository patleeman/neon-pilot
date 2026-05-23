import { assertArray, requireString, requireStringArray, validateOptionalString } from './extensionManifestValidation.js';
import { isRecord } from './extensionRegistryConfig.js';

export function assertExtensionManifestRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Extension manifest must be an object.');
  }
}

export function validateExtensionManifestBasics(value: Record<string, unknown>): void {
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    throw new Error('Extension manifest schemaVersion must be 1 or 2.');
  }
  requireString(value.id, 'id');
  requireString(value.name, 'name');
  if (value.defaultEnabled !== undefined && typeof value.defaultEnabled !== 'boolean') {
    throw new Error('Extension manifest defaultEnabled must be a boolean.');
  }
  validateOptionalString(value.description, 'description');
  validateOptionalString(value.version, 'version');
}

export function validateExtensionManifestDependencies(value: unknown): void {
  for (const [index, dependency] of assertArray(value, 'dependsOn').entries()) {
    if (typeof dependency === 'string') {
      requireString(dependency, `dependsOn[${index}]`);
      continue;
    }
    if (!isRecord(dependency)) throw new Error(`Extension manifest dependsOn[${index}] must be a string or object.`);
    requireString(dependency.id, `dependsOn[${index}].id`);
    if (dependency.optional !== undefined && typeof dependency.optional !== 'boolean') {
      throw new Error(`Extension manifest dependsOn[${index}].optional must be a boolean.`);
    }
    validateOptionalString(dependency.version, `dependsOn[${index}].version`);
  }
}

export function validateExtensionManifestFrontend(value: unknown): void {
  if (!isRecord(value)) throw new Error('Extension manifest frontend must be an object.');
  requireString(value.entry, 'frontend.entry');
  if (value.styles !== undefined) requireStringArray(value.styles, 'frontend.styles');
}
