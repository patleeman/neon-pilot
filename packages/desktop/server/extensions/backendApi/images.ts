import type { StoredImageProbeAttachment } from '@neon-pilot/extensions/backend/images';

import { callServerModuleExport } from './serverModuleResolver.js';

export type { StoredImageProbeAttachment };

const IMAGE_PROBE_STORE = '../../extensions/imageProbeAttachmentStore.js';
const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

function getHostCapabilityBridge(): ((capability: string, operation: string, input?: unknown) => Promise<unknown>) | undefined {
  return (globalThis as ExtensionBackendGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

export function hasImageHostCapability(): boolean {
  return typeof getHostCapabilityBridge() === 'function';
}

export async function generateImageInHost(input: unknown): Promise<unknown> {
  const bridge = getHostCapabilityBridge();
  if (!bridge) {
    throw new Error('Image host capability is unavailable outside an extension backend worker request.');
  }
  return bridge('image', 'generate', input);
}

export async function clearImageProbeAttachmentCacheForTests(...args: unknown[]) {
  return callServerModuleExport<void>(IMAGE_PROBE_STORE, 'clearImageProbeAttachmentCacheForTests', ...args);
}

export async function getImageProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredImageProbeAttachment[]>(IMAGE_PROBE_STORE, 'getImageProbeAttachments', ...args);
}

export async function getImageProbeAttachmentsById(...args: unknown[]) {
  return callServerModuleExport<StoredImageProbeAttachment[]>(IMAGE_PROBE_STORE, 'getImageProbeAttachmentsById', ...args);
}

export async function getImageProbeAttachmentsByIdFromAnySession(...args: unknown[]) {
  return callServerModuleExport<StoredImageProbeAttachment[]>(
    IMAGE_PROBE_STORE,
    'getImageProbeAttachmentsByIdFromAnySession',
    ...args,
  );
}

export async function rememberImageProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredImageProbeAttachment[]>(IMAGE_PROBE_STORE, 'rememberImageProbeAttachments', ...args);
}
