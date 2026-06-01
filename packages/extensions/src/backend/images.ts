function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/images must be resolved by the Neon Pilot host runtime.');
}

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

export interface StoredImageProbeAttachment {
  id: string;
  path: string;
  sizeBytes: number;
  data: string;
  mimeType: string;
  name?: string;
}

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

export const clearImageProbeAttachmentCacheForTests = (..._args: unknown[]): unknown => hostResolved();
export const getImageProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const getImageProbeAttachmentsById = (..._args: unknown[]): unknown => hostResolved();
export const rememberImageProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const getPiAgentRuntimeDir = (..._args: unknown[]): unknown => hostResolved();
