import { dirname } from 'node:path';

import { type DesktopRootLayout, resolveDesktopRootLayout } from '@neon-pilot/core';

import { createRuntimeState, type RuntimeState } from '../app/runtimeState.js';
import { getRuntimeSettingsFilePath, getRuntimeSettingsFilePathFromLayout } from '../ui/settingsPersistence.js';
import type { ExtensionHostBackendServerContext } from './extensionHostProtocol.js';

export interface ExtensionHostServerContextSnapshot {
  runtimeScope: string;
  repoRoot?: string;
  agentDir?: string;
  settingsFile?: string;
  authFile?: string;
  stateRoot?: string;
  desktopRootLayout?: DesktopRootLayout;
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
    ...(context.getDesktopRootLayout ? { desktopRootLayout: context.getDesktopRootLayout() } : {}),
  };
}

export function createExtensionBackendServerContextFromSnapshot(
  snapshot?: ExtensionHostServerContextSnapshot,
): ExtensionHostBackendServerContext | undefined {
  if (!snapshot) return undefined;
  let runtimeState: RuntimeState | undefined;
  const hasSettingsFileSource = Boolean(snapshot.settingsFile ?? snapshot.desktopRootLayout ?? snapshot.stateRoot);
  const resolveSettingsFile = () =>
    snapshot.settingsFile ??
    (snapshot.desktopRootLayout
      ? getRuntimeSettingsFilePathFromLayout(snapshot.desktopRootLayout)
      : getRuntimeSettingsFilePath(snapshot.stateRoot));
  const getRuntimeState = () => {
    const settingsFile = resolveSettingsFile();
    const agentDir = snapshot.agentDir ?? dirname(settingsFile);
    const stateRoot = snapshot.stateRoot ?? dirname(agentDir);
    runtimeState ??= createRuntimeState({
      repoRoot: snapshot.repoRoot ?? process.cwd(),
      agentDir,
      settingsFile,
      stateRoot,
      desktopRootLayout: snapshot.desktopRootLayout ?? resolveDesktopRootLayout(),
      logger: { warn: () => undefined },
    });
    return runtimeState;
  };
  return {
    getRuntimeScope: () => snapshot.runtimeScope,
    ...(snapshot.repoRoot ? { getRepoRoot: () => snapshot.repoRoot as string } : {}),
    ...(hasSettingsFileSource ? { getSettingsFile: resolveSettingsFile } : {}),
    ...(snapshot.authFile ? { getAuthFile: () => snapshot.authFile as string } : {}),
    ...(snapshot.stateRoot ? { getStateRoot: () => snapshot.stateRoot as string } : {}),
    ...(snapshot.desktopRootLayout ? { getDesktopRootLayout: () => snapshot.desktopRootLayout as DesktopRootLayout } : {}),
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
