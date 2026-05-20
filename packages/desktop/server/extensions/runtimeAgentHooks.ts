import { AuthStorage, type ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir, getProfilesRoot, getStateRoot, resolveRuntimeResources } from '@neon-pilot/core';

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
  const resolved = resolveRuntimeResources(process.env.NEON_PILOT_ACTIVE_PROFILE || process.env.NEON_PILOT_PROFILE || 'shared', {
    ...(process.env.NEON_PILOT_REPO_ROOT ? { repoRoot: process.env.NEON_PILOT_REPO_ROOT } : {}),
  });

  const profile = process.env.NEON_PILOT_ACTIVE_PROFILE || process.env.NEON_PILOT_PROFILE || 'shared';
  const repoRoot = process.env.NEON_PILOT_REPO_ROOT || process.cwd();
  const assembly = buildPromptAssemblyPlan({ profile, repoRoot, modelRef: readSavedModelRef(DEFAULT_RUNTIME_SETTINGS_FILE) });

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
  const agentDir = getPiAgentRuntimeDir();
  const agentExtensions = createManifestAgentExtensions({
    onError: (message, fields) => console.warn(`[runtime-agent] ${message}`, fields ?? ''),
  });

  return [
    ...createManifestToolAgentExtensions({
      getCurrentProfile: () => process.env.NEON_PILOT_ACTIVE_PROFILE || process.env.NEON_PILOT_PROFILE || 'shared',
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
      profilesRoot: getProfilesRoot(),
      stateRoot: getStateRoot(),
    }),
    ...agentExtensions.factories,
  ];
}

export function buildLiveSessionExtensionFactoriesForRuntime(): ExtensionFactory[] {
  return buildExtensionFactories ? buildExtensionFactories() : buildFallbackLiveSessionExtensionFactories();
}
