import { recordExtensionHostAuditEvent } from './extensionHostAudit.js';
import type { ExtensionManifest, ExtensionPermission } from './extensionManifest.js';
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

export function manifestHasAnyPermission(manifest: ExtensionManifest, permissions: ExtensionPermission[]): boolean {
  return permissions.some((permission) => manifest.permissions?.includes(permission));
}

export function assertExtensionPermission(extensionId: string, permission: ExtensionPermission, capability: string): void {
  if (!extensionHasPermission(extensionId, permission)) {
    recordExtensionHostAuditEvent({
      requestType: 'permission',
      requestName: `permission:${extensionId}:${permission}`,
      ok: false,
      durationMs: 0,
      error: `Extension "${extensionId}" requires permission ${permission} to use ${capability}.`,
    });
    throw new ExtensionPermissionError(extensionId, permission, capability);
  }
}

export function assertExtensionAnyPermission(extensionId: string, permissions: ExtensionPermission[], capability: string): void {
  if (permissions.some((permission) => extensionHasPermission(extensionId, permission))) {
    return;
  }
  assertExtensionPermission(extensionId, permissions[0]!, capability);
}
