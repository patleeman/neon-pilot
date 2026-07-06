import { callServerModuleExport } from './serverModuleResolver.js';

export async function controlDesktop(input: unknown): Promise<unknown> {
  return callServerModuleExport('../../desktop/desktopControl.js', 'issueDesktopControlCommand', input);
}

export async function readDesktopState(): Promise<unknown> {
  return callServerModuleExport('../../desktop/desktopState.js', 'readDesktopStateSnapshot');
}
