import { dirname } from 'node:path';

import { createRuntimeState, type RuntimeState } from '../app/runtimeState.js';
import type { ExtensionHostBackendServerContext } from './extensionHostProtocol.js';

export interface ExtensionHostServerContextSnapshot {
  runtimeScope: string;
  repoRoot?: string;
  agentDir?: string;
  settingsFile?: string;
  authFile?: string;
  stateRoot?: string;
}

export function createExtensionHostServerContextSnapshot(
  context?: ExtensionHostBackendServerContext,
): ExtensionHostServerContextSnapshot | undefined {
  if (!context) return undefined;
  const authFile = context.getAuthFile?.();
  return {
    runtimeScope: context.getRuntimeScope(),
    ...(context.getRepoRoot ? { repoRoot: context.getRepoRoot() } : {}),
    ...(authFile ? { authFile, agentDir: dirname(authFile) } : {}),
    ...(context.getSettingsFile ? { settingsFile: context.getSettingsFile() } : {}),
    ...(context.getStateRoot ? { stateRoot: context.getStateRoot() } : {}),
  };
}

export function createExtensionBackendServerContextFromSnapshot(
  snapshot?: ExtensionHostServerContextSnapshot,
): ExtensionHostBackendServerContext | undefined {
  if (!snapshot) return undefined;
  let runtimeState: RuntimeState | undefined;
  const getRuntimeState = () => {
    runtimeState ??= createRuntimeState({
      repoRoot: snapshot.repoRoot ?? process.cwd(),
      agentDir: snapshot.agentDir ?? process.cwd(),
      logger: { warn: () => undefined },
    });
    return runtimeState;
  };
  return {
    getRuntimeScope: () => snapshot.runtimeScope,
    ...(snapshot.repoRoot ? { getRepoRoot: () => snapshot.repoRoot as string } : {}),
    ...(snapshot.settingsFile ? { getSettingsFile: () => snapshot.settingsFile as string } : {}),
    ...(snapshot.authFile ? { getAuthFile: () => snapshot.authFile as string } : {}),
    ...(snapshot.stateRoot ? { getStateRoot: () => snapshot.stateRoot as string } : {}),
    materializeWebRuntimeConfig: () => getRuntimeState().materializeRuntimeResources(),
    buildLiveSessionResourceOptions: () => getRuntimeState().buildLiveSessionResourceOptions(),
  };
}

export function resolveExtensionBackendServerContext(input: {
  serverContext?: ExtensionHostBackendServerContext;
  serverContextSnapshot?: ExtensionHostServerContextSnapshot;
}): ExtensionHostBackendServerContext | undefined {
  return input.serverContext ?? createExtensionBackendServerContextFromSnapshot(input.serverContextSnapshot);
}
