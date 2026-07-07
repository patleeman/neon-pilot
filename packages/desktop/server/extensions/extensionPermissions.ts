import { isLockedExtensionId } from './extensionEnabledConfig.js';
import { recordExtensionHostAuditEvent } from './extensionHostAudit.js';
import { EXTENSION_PERMISSIONS, type ExtensionPermission } from './extensionManifest.js';
import * as extensionRegistry from './extensionRegistry.js';

const KNOWN_EXTENSION_PERMISSIONS = new Set<string>(EXTENSION_PERMISSIONS);

function readPermissionRegistryConfig(stateRoot?: string): { revokedPermissions?: Record<string, string[]> } {
  if (!('readExtensionRegistryConfig' in extensionRegistry)) return {};
  return extensionRegistry.readExtensionRegistryConfig(stateRoot);
}

export class ExtensionPermissionError extends Error {
  readonly extensionId: string;
  readonly permission: ExtensionPermission;
  readonly capabilityContext: string;

  constructor(extensionId: string, permission: ExtensionPermission, capability: string) {
    super(`Extension "${extensionId}" requires permission ${permission} to use ${capability}.`);
    this.name = 'ExtensionPermissionError';
    this.extensionId = extensionId;
    this.permission = permission;
    this.capabilityContext = capability;
  }
}

export function extensionHasPermission(extensionId: string, permission: ExtensionPermission, stateRoot?: string): boolean {
  const entry = extensionRegistry.findExtensionEntry(extensionId, stateRoot);
  if (!entry?.manifest.permissions?.includes(permission)) return false;
  if (isLockedExtensionId(extensionId)) return true;
  const config = readPermissionRegistryConfig(stateRoot);
  const revoked = config.revokedPermissions?.[extensionId];
  return !(revoked && revoked.includes(permission));
}

export function assertExtensionPermission(
  extensionId: string,
  permission: ExtensionPermission,
  capability: string,
  stateRoot?: string,
): void {
  if (!extensionHasPermission(extensionId, permission, stateRoot)) {
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

export function setExtensionPermissionGranted(
  extensionId: string,
  permission: ExtensionPermission,
  granted: boolean,
  stateRoot?: string,
): void {
  if (!KNOWN_EXTENSION_PERMISSIONS.has(permission)) {
    throw new Error(`Unknown extension permission: ${permission}.`);
  }
  const entry = extensionRegistry.findExtensionEntry(extensionId, stateRoot);
  if (!entry) {
    throw new Error(`Cannot update permission ${permission} for ${extensionId}: extension is not installed.`);
  }
  if (!entry.manifest.permissions?.includes(permission)) {
    throw new Error(`Cannot update permission ${permission} for ${extensionId}: permission is not declared by the extension.`);
  }
  if (!granted && isLockedExtensionId(extensionId)) {
    throw new Error(`Cannot revoke permission ${permission} from ${extensionId}: this extension is required by the application.`);
  }

  const config = extensionRegistry.readExtensionRegistryConfig(stateRoot);
  const revoked = { ...(config.revokedPermissions ?? {}) };
  const current = revoked[extensionId] ? [...revoked[extensionId]] : [];

  if (granted) {
    // Remove from revoked list (re-grant)
    const filtered = current.filter((p) => p !== permission);
    if (filtered.length === 0) {
      delete revoked[extensionId];
    } else {
      revoked[extensionId] = filtered;
    }
  } else {
    // Add to revoked list if not already present
    if (!current.includes(permission)) {
      revoked[extensionId] = [...current, permission];
    }
  }

  extensionRegistry.writeExtensionRegistryConfig({ ...config, revokedPermissions: revoked }, stateRoot);
  extensionRegistry.invalidateExtensionRegistryReadCaches(stateRoot);
}
