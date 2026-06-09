import { callServerModuleExport } from './serverModuleResolver.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionHostCapabilityBridge = (capability: string, operation: string, input?: unknown) => Promise<unknown>;

type ExtensionBackendSettingsGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: ExtensionHostCapabilityBridge;
};

type SettingsStore = {
  read(): Record<string, unknown>;
  readSchema(): unknown[];
  update(overrides: Record<string, unknown>): Record<string, unknown>;
  reset(keys: string[]): Record<string, unknown>;
};

async function createHostSettingsStore(): Promise<SettingsStore> {
  return callServerModuleExport<SettingsStore>('../../settings/settingsStore.js', 'createSettingsStore');
}

function getWorkerCapabilityBridge(): ExtensionHostCapabilityBridge | undefined {
  return (globalThis as ExtensionBackendSettingsGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

export async function readExtensionSettings(): Promise<Record<string, unknown>> {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) {
    return bridge('settings', 'read') as Promise<Record<string, unknown>>;
  }
  const store = await createHostSettingsStore();
  return store.read();
}

export async function readExtensionSettingsSchema(): Promise<unknown[]> {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) {
    return bridge('settings', 'readSchema') as Promise<unknown[]>;
  }
  const store = await createHostSettingsStore();
  return store.readSchema();
}

export async function updateExtensionSettings(overrides: Record<string, unknown>): Promise<Record<string, unknown>> {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) {
    return bridge('settings', 'update', { overrides }) as Promise<Record<string, unknown>>;
  }
  const store = await createHostSettingsStore();
  return store.update(overrides);
}

export async function resetExtensionSettings(keys: string[]): Promise<Record<string, unknown>> {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) {
    return bridge('settings', 'reset', { keys }) as Promise<Record<string, unknown>>;
  }
  const store = await createHostSettingsStore();
  return store.reset(keys);
}
