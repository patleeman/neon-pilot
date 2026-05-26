import type { ExtensionPackageType, ExtensionSecretContribution, ExtensionSettingsContribution } from './extensionManifest.js';

export interface ExtensionSettingsRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  key: string;
  type: string;
  control?: string;
  default?: unknown;
  description?: string;
  group: string;
  enum?: string[];
  placeholder?: string;
  order: number;
}

export interface ExtensionSecretRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  key: string;
  label: string;
  description?: string;
  env?: string;
  placeholder?: string;
  order: number;
}

export function buildExtensionSettingsRegistrations(input: {
  extensionId: string;
  packageType?: ExtensionPackageType;
  settings?: Record<string, ExtensionSettingsContribution>;
}): ExtensionSettingsRegistration[] {
  if (!input.settings) {
    return [];
  }
  return Object.entries(input.settings).flatMap(([key, setting]) => {
    if (!setting || typeof setting !== 'object') {
      return [];
    }
    const type = typeof setting.type === 'string' ? setting.type : 'string';
    if (!['string', 'boolean', 'number', 'select'].includes(type)) {
      return [];
    }
    return [
      {
        extensionId: input.extensionId,
        packageType: input.packageType ?? 'user',
        key,
        type,
        control: typeof setting.control === 'string' && setting.control.trim() ? setting.control.trim() : undefined,
        default: setting.default,
        description: typeof setting.description === 'string' ? setting.description : undefined,
        group: typeof setting.group === 'string' && setting.group.trim() ? setting.group.trim() : 'General',
        enum: Array.isArray(setting.enum) ? setting.enum.filter((entry): entry is string => typeof entry === 'string') : undefined,
        placeholder: typeof setting.placeholder === 'string' ? setting.placeholder : undefined,
        order: typeof setting.order === 'number' ? setting.order : 0,
      },
    ];
  });
}

export function buildExtensionSecretRegistrations(input: {
  extensionId: string;
  packageType?: ExtensionPackageType;
  secrets?: Record<string, ExtensionSecretContribution>;
}): ExtensionSecretRegistration[] {
  if (!input.secrets) return [];
  return Object.entries(input.secrets).flatMap(([id, secret]): ExtensionSecretRegistration[] => {
    const normalizedId = id.trim();
    const label = typeof secret.label === 'string' ? secret.label.trim() : '';
    if (!normalizedId || !label) return [];
    return [
      {
        extensionId: input.extensionId,
        packageType: input.packageType ?? 'user',
        id: normalizedId,
        key: `${input.extensionId}.${normalizedId}`,
        label,
        description: typeof secret.description === 'string' ? secret.description : undefined,
        env: typeof secret.env === 'string' && secret.env.trim() ? secret.env.trim() : undefined,
        placeholder: typeof secret.placeholder === 'string' ? secret.placeholder : undefined,
        order: typeof secret.order === 'number' ? secret.order : 0,
      },
    ];
  });
}
