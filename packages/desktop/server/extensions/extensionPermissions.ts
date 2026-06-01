import type { ExtensionPermission } from './extensionManifest.js';
import { findExtensionEntry } from './extensionRegistry.js';

export class ExtensionPermissionError extends Error {
  readonly extensionId: string;
  readonly permission: ExtensionPermission;

  constructor(extensionId: string, permission: ExtensionPermission, capability: string) {
    super(`Extension "${extensionId}" requires permission ${permission} to use ${capability}.`);
    this.name = 'ExtensionPermissionError';
    this.extensionId = extensionId;
    this.permission = permission;
  }
}

export function extensionHasPermission(extensionId: string, permission: ExtensionPermission): boolean {
  const entry = findExtensionEntry(extensionId);
  return Boolean(entry?.manifest.permissions?.includes(permission));
}

export function assertExtensionPermission(extensionId: string, permission: ExtensionPermission, capability: string): void {
  if (!extensionHasPermission(extensionId, permission)) {
    throw new ExtensionPermissionError(extensionId, permission, capability);
  }
}
