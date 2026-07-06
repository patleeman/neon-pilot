import { callServerModuleExport } from './serverModuleResolver.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendApiGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

function requireDesktopCapabilityBridge(): NonNullable<ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE]> {
  const bridge = (globalThis as ExtensionBackendApiGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  if (!bridge) throw new Error('Desktop control requires an active extension host capability bridge.');
  return bridge;
}

export async function controlDesktop(input: unknown): Promise<unknown> {
  return requireDesktopCapabilityBridge()('desktop', 'control', input);
}

export async function captureDesktopScreenshot(input: unknown): Promise<unknown> {
  return requireDesktopCapabilityBridge()('desktop', 'screenshot', input);
}

export async function readDesktopState(): Promise<unknown> {
  return callServerModuleExport('../../desktop/desktopState.js', 'readDesktopStateSnapshot');
}
