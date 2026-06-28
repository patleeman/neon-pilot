import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

import {
  getDurableAgentFilePath,
  getDurableSkillsDir,
  getDurableTasksDir,
  getStateRoot,
  getSyncRoot,
  readMachineSystemPromptTemplate,
  renderSystemPromptTemplate,
  resolveRuntimeResources,
  type SystemPromptTemplateVariables,
} from '@neon-pilot/core';

import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { getActiveMemoryInstructionFiles } from '../memory/memoryStore.js';
import { invokePromptAssemblyProvider, isRecord } from './providerRuntime.js';
import { getAssemblyRuntimeScope } from './runtimeScope.js';
import type { AssemblyDiagnostic, AssemblyRuntimeContext, AssemblySource } from './types.js';

export interface InstructionLayer {
  id: string;
  providerId: string;
  title: string;
  content: string;
  source: AssemblySource;
  scope: 'global' | 'workspace' | 'conversation' | 'runtime';
  priority: number;
  mutable: boolean;
  risk: 'normal' | 'sensitive' | 'break-glass';
  diagnostics?: AssemblyDiagnostic[];
}

export interface InstructionPlan {
  layers: InstructionLayer[];
  finalSystemPrompt: string;
  diagnostics: AssemblyDiagnostic[];
}

export interface InstructionProvider {
  id: string;
  title: string;
  provide(ctx: AssemblyRuntimeContext): Promise<InstructionLayer[]> | InstructionLayer[];
}

const instructionProviders: InstructionProvider[] = [
  {
    id: 'runtime-files',
    title: 'Runtime instruction files',
    provide: listFileInstructionLayers,
  },
  {
    id: 'memory-files',
    title: 'Memory instruction files',
    provide: listMemoryInstructionLayers,
  },
  {
    id: 'runtime-template',
    title: 'Generated runtime instructions',
    async provide(ctx) {
      const layer = await generatedRuntimeLayer(ctx);
      return layer ? [layer] : [];
    },
  },
];

export function registerInstructionProvider(provider: InstructionProvider): () => void {
  instructionProviders.push(provider);
  return () => {
    const index = instructionProviders.indexOf(provider);
    if (index >= 0) instructionProviders.splice(index, 1);
  };
}

export async function buildInstructionPlan(ctx: AssemblyRuntimeContext): Promise<InstructionPlan> {
  const diagnostics: AssemblyDiagnostic[] = [];
  const layers: InstructionLayer[] = [];
  for (const provider of instructionProviders) {
    try {
      layers.push(...(await provider.provide(ctx)));
    } catch (err) {
      diagnostics.push({
        severity: 'warning',
        code: 'instruction-provider-failed',
        message: `${provider.title} failed; prompt assembly continued without it: ${err instanceof Error ? err.message : String(err)}`,
        sourceId: provider.id,
      });
    }
  }
  const { assemblyProviders } = await getExtensionHostClient().listPromptAssemblyContributions();
  const providers = assemblyProviders.filter((provider) => provider.kind === 'instructions');
  await Promise.allSettled(
    providers.map(async (provider) => {
      const result = await invokePromptAssemblyProvider<InstructionLayer>({
        provider,
        payload: ctx,
        resultKey: 'layers',
        validateItem: isInstructionLayerLike,
      });
      diagnostics.push(...result.diagnostics);
      layers.push(
        ...result.items.map((layer) => ({
          ...layer,
          providerId: layer.providerId || `extension-provider:${provider.extensionId}/${provider.id}`,
          source: layer.source || { kind: 'extension', label: provider.title ?? provider.id, extensionId: provider.extensionId },
        })),
      );
    }),
  );
  layers.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return {
    layers,
    finalSystemPrompt: layers
      .map((layer) => layer.content.trim())
      .filter(Boolean)
      .join('\n\n'),
    diagnostics: [...diagnostics, ...layers.flatMap((layer) => layer.diagnostics ?? [])],
  };
}

function listFileInstructionLayers(ctx: AssemblyRuntimeContext): InstructionLayer[] {
  const resolved = resolveRuntimeResources(getAssemblyRuntimeScope(ctx), { repoRoot: ctx.repoRoot, cwd: ctx.cwd });
  const layers: InstructionLayer[] = [];
  for (const [index, path] of resolved.agentsFiles.entries()) {
    const content = readText(path);
    if (!content) continue;
    layers.push({
      id: `agents:${path}`,
      providerId: 'runtime-resources',
      title: basename(path),
      content,
      source: { kind: 'configured-folder', label: path, root: path },
      scope: 'global',
      priority: 100 + index,
      mutable: false,
      risk: 'normal',
    });
  }
  if (resolved.systemPromptFile) {
    const content = readText(resolved.systemPromptFile);
    if (content) {
      layers.push({
        id: `system:${resolved.systemPromptFile}`,
        providerId: 'runtime-resources',
        title: basename(resolved.systemPromptFile),
        content,
        source: { kind: 'configured-folder', label: resolved.systemPromptFile, root: resolved.systemPromptFile },
        scope: 'runtime',
        priority: 10,
        mutable: false,
        risk: 'sensitive',
      });
    }
  }
  for (const [index, path] of resolved.appendSystemFiles.entries()) {
    const content = readText(path);
    if (!content) continue;
    layers.push({
      id: `append-system:${path}`,
      providerId: 'runtime-resources',
      title: basename(path),
      content,
      source: { kind: 'configured-folder', label: path, root: path },
      scope: 'runtime',
      priority: 1_000 + index,
      mutable: false,
      risk: 'sensitive',
    });
  }
  return layers;
}

function listMemoryInstructionLayers(ctx: AssemblyRuntimeContext): InstructionLayer[] {
  return getActiveMemoryInstructionFiles({ cwd: ctx.cwd, repoRoot: ctx.repoRoot }).map((file) => ({
    id: file.id,
    providerId: 'memory',
    title: file.title,
    content: file.content,
    source: { kind: 'configured-folder', label: file.path, root: file.path },
    scope: file.id.startsWith('memory-scope:') ? 'workspace' : 'global',
    priority: file.priority,
    mutable: true,
    risk: 'normal',
  }));
}

async function generatedRuntimeLayer(ctx: AssemblyRuntimeContext): Promise<InstructionLayer | null> {
  const resolved = resolveRuntimeResources(getAssemblyRuntimeScope(ctx), { repoRoot: ctx.repoRoot, cwd: ctx.cwd });
  const variables: SystemPromptTemplateVariables = {
    repo_root: resolved.repoRoot,
    knowledge_root: resolved.knowledgeRoot,
    agents_edit_target: getDurableAgentFilePath(resolved.knowledgeRoot),
    skills_dir: getDurableSkillsDir(resolved.knowledgeRoot),
    tasks_dir: getDurableTasksDir(getSyncRoot(getStateRoot())),
    docs_dir: `${resolved.repoRoot}/docs`,
    docs_index: `${resolved.repoRoot}/docs/README.md`,
  };
  const content = renderSystemPromptTemplate(variables, readMachineSystemPromptTemplate());
  return content
    ? {
        id: 'runtime:generated-system-template',
        providerId: 'runtime-template',
        title: 'Generated runtime instructions',
        content,
        source: { kind: 'runtime', label: 'Generated runtime instructions' },
        scope: 'runtime',
        priority: 900,
        mutable: false,
        risk: 'sensitive',
      }
    : null;
}

function readText(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function isInstructionLayerLike(value: unknown): value is InstructionLayer {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.content === 'string';
}
