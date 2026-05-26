export interface ExtensionSettingRegistration {
  key: string;
  type: 'string' | 'boolean' | 'number' | 'select';
  default?: unknown;
  description?: string;
  group?: string;
  enum?: unknown[];
  placeholder?: string;
  order?: number;
}

export async function readExtensionSettings(): Promise<Record<string, unknown>> {
  throw new Error('@neon-pilot/extensions/backend/settings must be resolved by the Neon Pilot host runtime.');
}

export async function readExtensionSettingsSchema(): Promise<ExtensionSettingRegistration[]> {
  throw new Error('@neon-pilot/extensions/backend/settings must be resolved by the Neon Pilot host runtime.');
}

export async function updateExtensionSettings(_overrides: Record<string, unknown>): Promise<Record<string, unknown>> {
  throw new Error('@neon-pilot/extensions/backend/settings must be resolved by the Neon Pilot host runtime.');
}
