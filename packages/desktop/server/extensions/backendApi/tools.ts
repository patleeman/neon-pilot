import { callServerModuleExport } from './serverModuleResolver.js';

export async function listInvocableExtensionTools(...args: unknown[]) {
  return callServerModuleExport<Record<string, unknown>[]>('../../tools/toolGateway.js', 'listInvocableExtensionTools', ...args);
}

export async function invokeExtensionToolByName(...args: unknown[]) {
  return callServerModuleExport<Record<string, unknown>>('../../tools/toolGateway.js', 'invokeExtensionToolByName', ...args);
}

export async function invokeToolByName(...args: unknown[]) {
  return callServerModuleExport<Record<string, unknown>>('../../tools/toolGateway.js', 'invokeToolByName', ...args);
}
