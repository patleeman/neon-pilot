import { requireString, validateOptionalString } from './extensionManifestValidation.js';
import { isRecord } from './extensionRegistryConfig.js';

function validateOptionalInteger(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value))) {
    throw new Error(`Extension manifest ${path} must be an integer.`);
  }
}

export function validateSettingsComponentContribution(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('Extension manifest contributes.settingsComponent must be an object.');
  }
  requireString(value.id, 'contributes.settingsComponent.id');
  requireString(value.component, 'contributes.settingsComponent.component');
  requireString(value.sectionId, 'contributes.settingsComponent.sectionId');
  requireString(value.label, 'contributes.settingsComponent.label');
  validateOptionalString(value.description, 'contributes.settingsComponent.description');
  validateOptionalInteger(value.order, 'contributes.settingsComponent.order');
}

export function validateSettingsContributions(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('Extension manifest contributes.settings must be an object.');
  }
  for (const [key, setting] of Object.entries(value)) {
    if (!isRecord(setting)) {
      throw new Error(`Extension manifest contributes.settings.${key} must be an object.`);
    }
    const allowedTypes = ['string', 'boolean', 'number', 'select'];
    if (typeof setting.type === 'string' && !allowedTypes.includes(setting.type)) {
      throw new Error(`Extension manifest contributes.settings.${key}.type must be one of: ${allowedTypes.join(', ')}.`);
    }
    if (setting.enum !== undefined && !Array.isArray(setting.enum)) {
      throw new Error(`Extension manifest contributes.settings.${key}.enum must be an array.`);
    }
  }
}

export function validateSecretContributions(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('Extension manifest contributes.secrets must be an object.');
  }
  for (const [key, secret] of Object.entries(value)) {
    if (!isRecord(secret)) {
      throw new Error(`Extension manifest contributes.secrets.${key} must be an object.`);
    }
    requireString(secret.label, `contributes.secrets.${key}.label`);
    validateOptionalString(secret.description, `contributes.secrets.${key}.description`);
    validateOptionalString(secret.env, `contributes.secrets.${key}.env`);
    validateOptionalString(secret.placeholder, `contributes.secrets.${key}.placeholder`);
    validateOptionalInteger(secret.order, `contributes.secrets.${key}.order`);
  }
}
