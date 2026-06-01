import { AuthStorage, type ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir, getRuntimeConfigRoot, getStateRoot, resolveRuntimeResources } from '@neon-pilot/core';

import { readSavedModelPreferences, readSavedModelRef } from '../models/modelPreferences.js';
import { buildPromptAssemblyPlan } from '../prompt-assembly/promptAssembly.js';
import type { LiveSessionResourceOptions } from '../routes/context.js';
import { DEFAULT_RUNTIME_SETTINGS_FILE } from '../ui/settingsPersistence.js';
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
  const resolved = resolveRuntimeResources(runtimeScope, {
    ...(process.env.NEON_PILOT_REPO_ROOT ? { repoRoot: process.env.NEON_PILOT_REPO_ROOT } : {}),
  });

  const repoRoot = process.env.NEON_PILOT_REPO_ROOT || process.cwd();
  const assembly = buildPromptAssemblyPlan({ runtimeScope, repoRoot, modelRef: readSavedModelRef(DEFAULT_RUNTIME_SETTINGS_FILE) });

  return {
    additionalExtensionPaths: resolved.extensionEntries,
    additionalSkillPaths: [],
    additionalPromptTemplatePaths: assembly.promptTemplates.templatePaths,
    additionalThemePaths: resolved.themeEntries,
  };
}

export function buildLiveSessionResourceOptionsForRuntime(): LiveSessionResourceOptions {
  return buildResourceOptions ? buildResourceOptions() : buildFallbackLiveSessionResourceOptions();
}

function buildFallbackLiveSessionExtensionFactories(): ExtensionFactory[] {
  const agentDir = getPiAgentRuntimeDir();
  const agentExtensions = createManifestAgentExtensions({
    onError: (message, fields) => console.warn(`[runtime-agent] ${message}`, fields ?? ''),
  });

  return [
    ...createManifestToolAgentExtensions({
      getRuntimeScope: () => 'shared',
      getPreferredVisionModel: () => readSavedModelPreferences(DEFAULT_RUNTIME_SETTINGS_FILE).currentVisionModel,
      getCurrentModelRef: () => readSavedModelRef(DEFAULT_RUNTIME_SETTINGS_FILE),
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
      stateRoot: getStateRoot(),
    }),
    ...agentExtensions.factories,
  ];
}

export function buildLiveSessionExtensionFactoriesForRuntime(): ExtensionFactory[] {
  return buildExtensionFactories ? buildExtensionFactories() : buildFallbackLiveSessionExtensionFactories();
}
