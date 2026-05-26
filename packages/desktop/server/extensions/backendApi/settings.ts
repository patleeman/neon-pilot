import { callServerModuleExport } from './serverModuleResolver.js';

type SettingsStore = {
  read(): Record<string, unknown>;
  readSchema(): unknown[];
  update(overrides: Record<string, unknown>): Record<string, unknown>;
};

async function createHostSettingsStore(): Promise<SettingsStore> {
  return callServerModuleExport<SettingsStore>('../../settings/settingsStore.js', 'createSettingsStore');
}

export async function readExtensionSettings(): Promise<Record<string, unknown>> {
  const store = await createHostSettingsStore();
  return store.read();
}

export async function readExtensionSettingsSchema(): Promise<unknown[]> {
  const store = await createHostSettingsStore();
  return store.readSchema();
}

export async function updateExtensionSettings(overrides: Record<string, unknown>): Promise<Record<string, unknown>> {
  const store = await createHostSettingsStore();
  return store.update(overrides);
}
