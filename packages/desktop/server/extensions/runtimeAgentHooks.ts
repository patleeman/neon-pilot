import { AuthStorage, type ExtensionFactory } from '@earendil-works/pi-coding-agent';
import {
  getPiAgentRuntimeDir,
  getRuntimeConfigRoot,
  getStateRoot,
  resolveDesktopRootLayout,
  resolveRuntimeResources,
} from '@neon-pilot/core';

import {
  appendToPersonaMemoryDoc,
  deletePersonaMemoryDoc,
  listPersonaMemoryDocs,
  writePersonaMemoryDoc,
} from '../knowledge/personaMemoryDocs.js';
import { readSavedModelPreferences, readSavedModelRef } from '../models/modelPreferences.js';
import { buildPromptAssemblyPlan } from '../prompt-assembly/promptAssembly.js';
import type { LiveSessionResourceOptions } from '../routes/context.js';
import { getRuntimeSettingsFilePath, getRuntimeSettingsFilePathFromLayout } from '../ui/settingsPersistence.js';
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
  const desktopRootLayout = resolveDesktopRootLayout();
  const settingsFile = getRuntimeSettingsFilePathFromLayout(desktopRootLayout);
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

function personaMemoryToolText(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    details: undefined,
  };
}

function personaMemoryToolError(error: unknown) {
  return {
    content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
    details: undefined,
    isError: true,
  };
}

/**
 * Create an extension factory that registers persona memory tools.
 *
 * These tools let the persona write, append, delete, and list memory docs
 * under the agents directory while keeping soul.md read-only.
 */
export function createPersonaMemoryAgentExtension(): ExtensionFactory {
  return (pi) => {
    pi.registerTool({
      name: 'persona_remember',
      label: 'Persona Remember',
      description:
        'Write or overwrite a persona memory doc. Use this to create a new memory or update an existing one. ' +
        'The doc id must be lowercase alphanumeric with hyphens. Cannot target the soul doc.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Optional alias for key.',
          },
          key: {
            type: 'string',
            description: 'Memory doc id, lowercase alphanumeric with hyphens, such as "preferences" or "coding-style".',
          },
          title: {
            type: 'string',
            description: 'Optional display title for the memory doc.',
          },
          body: {
            type: 'string',
            description: 'Optional alias for content.',
          },
          content: {
            type: 'string',
            description: 'Markdown body content.',
          },
        },
        required: ['key', 'content'],
      } as const,
      async execute(_toolCallId, params) {
        try {
          const input = params as { id?: string; key?: string; title?: string; body?: string; content?: string };
          const id = input.key ?? input.id ?? '';
          const body = input.content ?? input.body ?? '';
          const title = input.title ?? id;
          const agentsDir = resolveDesktopRootLayout().agents;
          const doc = writePersonaMemoryDoc(agentsDir, id, title, body);
          return personaMemoryToolText(`Created memory doc "${doc.title}" (${doc.id}).`);
        } catch (error) {
          return personaMemoryToolError(error);
        }
      },
    });

    pi.registerTool({
      name: 'persona_append_to_memory',
      label: 'Persona Append to Memory',
      description:
        'Append a dated section to an existing persona memory doc. Creates the doc if it does not exist. ' +
        'Use this to record observations, journal entries, or progress notes over time.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Optional alias for key.',
          },
          key: {
            type: 'string',
            description: 'Memory doc id, lowercase alphanumeric with hyphens.',
          },
          sectionTitle: {
            type: 'string',
            description: 'Optional title for the new section entry.',
          },
          body: {
            type: 'string',
            description: 'Optional alias for content.',
          },
          content: {
            type: 'string',
            description: 'Markdown body content for the section.',
          },
        },
        required: ['key', 'content'],
      } as const,
      async execute(_toolCallId, params) {
        try {
          const input = params as { id?: string; key?: string; sectionTitle?: string; body?: string; content?: string };
          const id = input.key ?? input.id ?? '';
          const body = input.content ?? input.body ?? '';
          const sectionTitle = input.sectionTitle ?? 'Memory update';
          const agentsDir = resolveDesktopRootLayout().agents;
          const doc = appendToPersonaMemoryDoc(agentsDir, id, sectionTitle, body);
          return personaMemoryToolText(`Appended to memory doc "${doc.title}" (${doc.id}).`);
        } catch (error) {
          return personaMemoryToolError(error);
        }
      },
    });

    pi.registerTool({
      name: 'persona_forget',
      label: 'Persona Forget',
      description:
        'Delete a persona memory doc. Returns an error if the doc does not exist. ' +
        'Cannot delete the soul doc or reserved system files.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Optional alias for key.',
          },
          key: {
            type: 'string',
            description: 'Memory doc id to delete, lowercase alphanumeric with hyphens.',
          },
        },
        required: ['key'],
      } as const,
      async execute(_toolCallId, params) {
        try {
          const input = params as { id?: string; key?: string };
          const id = input.key ?? input.id ?? '';
          const agentsDir = resolveDesktopRootLayout().agents;
          const deleted = deletePersonaMemoryDoc(agentsDir, id);
          if (!deleted) {
            return personaMemoryToolError(`Memory doc "${id}" not found.`);
          }
          return personaMemoryToolText(`Deleted memory doc "${id}".`);
        } catch (error) {
          return personaMemoryToolError(error);
        }
      },
    });

    pi.registerTool({
      name: 'persona_list_memories',
      label: 'Persona List Memories',
      description: 'List all persona memory docs in the agents directory, excluding the soul doc.',
      parameters: {
        type: 'object',
        properties: {},
      } as const,
      async execute() {
        try {
          const agentsDir = resolveDesktopRootLayout().agents;
          const docs = listPersonaMemoryDocs(agentsDir);
          if (docs.length === 0) {
            return personaMemoryToolText('No persona memory docs found.');
          }
          const lines = docs.map(
            (doc) => `- **${doc.title}** (\`${doc.id}\`) - ${doc.content.length} chars${doc.updatedAt ? `, updated ${doc.updatedAt}` : ''}`,
          );
          return personaMemoryToolText(`Persona memory docs:\n${lines.join('\n')}`);
        } catch (error) {
          return personaMemoryToolError(error);
        }
      },
    });
  };
}

export function buildLiveSessionExtensionFactoriesForRuntime(): ExtensionFactory[] {
  return buildExtensionFactories
    ? buildExtensionFactories()
    : [...buildFallbackLiveSessionExtensionFactories(), createPersonaMemoryAgentExtension()];
}
