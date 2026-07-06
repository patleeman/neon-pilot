import { callServerModuleExport } from './serverModuleResolver.js';

export async function readDesktopState(): Promise<unknown> {
  return callServerModuleExport('../../desktop/desktopState.js', 'readDesktopStateSnapshot');
}
