import { AuthStorage, type ExtensionFactory } from '@earendil-works/pi-coding-agent';
import {
  getPiAgentRuntimeDir,
  getRuntimeConfigRoot,
  getStateRoot,
  resolveDesktopRootLayout,
  resolveRuntimeResources,
} from '@neon-pilot/core';

import { readSavedModelPreferences, readSavedModelRef } from '../models/modelPreferences.js';
import { buildPromptAssemblyPlan } from '../prompt-assembly/promptAssembly.js';
import type { LiveSessionResourceOptions } from '../routes/context.js';
import { getRuntimeSettingsFilePath } from '../ui/settingsPersistence.js';
import { createManifestAgentExtensions } from './extensionAgentExtensions.js';
import { createManifestToolAgentExtensions } from './manifestToolAgentExtension.js';

let buildResourceOptions: (() => LiveSessionResourceOptions) | null = null;
let buildExtensionFactories: (() => ExtensionFactory[]) | null = null;

export function setRuntimeAgentHookBuilders(builders: {
  buildLiveSessionResourceOptions: () => LiveSessionResourceOptions;
  buildLiveSessionExtensionFactories: () => ExtensionFactory[];
}): void {
  buildResourceOptions = builders.buildLiveSessionResourceOptions;
  buildExtensionFactories = builders.buildLiveSessionExtensionFactories;
}

function buildFallbackLiveSessionResourceOptions(): LiveSessionResourceOptions {
  const runtimeScope = 'shared';
  const stateRoot = getStateRoot();
  const settingsFile = getRuntimeSettingsFilePath(stateRoot);
  const desktopRootLayout = resolveDesktopRootLayout();
  const resolved = resolveRuntimeResources(runtimeScope, {
    ...(process.env.NEON_PILOT_REPO_ROOT ? { repoRoot: process.env.NEON_PILOT_REPO_ROOT } : {}),
    desktopRootLayout,
  });

  const repoRoot = process.env.NEON_PILOT_REPO_ROOT || process.cwd();
  const assembly = buildPromptAssemblyPlan({ runtimeScope, repoRoot, modelRef: readSavedModelRef(settingsFile), desktopRootLayout });

  return {
    additionalExtensionPaths: resolved.extensionEntries,
    additionalSkillPaths: assembly.skills.skillPaths,
    additionalPromptTemplatePaths: assembly.promptTemplates.templatePaths,
    additionalThemePaths: resolved.themeEntries,
  };
}

export function buildLiveSessionResourceOptionsForRuntime(): LiveSessionResourceOptions {
  return buildResourceOptions ? buildResourceOptions() : buildFallbackLiveSessionResourceOptions();
}

function buildFallbackLiveSessionExtensionFactories(): ExtensionFactory[] {
  const stateRoot = getStateRoot();
  const agentDir = getPiAgentRuntimeDir(stateRoot);
  const settingsFile = getRuntimeSettingsFilePath(stateRoot);
  const agentExtensions = createManifestAgentExtensions({
    onError: (message, fields) => console.warn(`[runtime-agent] ${message}`, fields ?? ''),
  });

  return [
    ...createManifestToolAgentExtensions({
      getRuntimeScope: () => 'shared',
      getPreferredVisionModel: () => readSavedModelPreferences(settingsFile).currentVisionModel,
      getCurrentModelRef: () => readSavedModelRef(settingsFile),
      hasOpenAiImageProvider: () => {
        try {
          const auth = AuthStorage.create(`${agentDir}/auth.json`);
          return auth.hasAuth('openai') || auth.hasAuth('openai-codex');
        } catch {
          return false;
        }
      },
      repoRoot: process.env.NEON_PILOT_REPO_ROOT || process.cwd(),
      runtimeConfigRoot: getRuntimeConfigRoot(),
      stateRoot,
      serverContext: { getRuntimeScope: () => 'shared', getSettingsFile: () => settingsFile, getStateRoot: () => stateRoot },
    }),
    ...agentExtensions.factories,
  ];
}

export function buildLiveSessionExtensionFactoriesForRuntime(): ExtensionFactory[] {
  return buildExtensionFactories ? buildExtensionFactories() : buildFallbackLiveSessionExtensionFactories();
}
