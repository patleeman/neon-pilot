import { existsSync } from 'node:fs';
import { basename } from 'node:path';

import { resolveRuntimeResources } from '@personal-agent/core';

import type { AssemblyDiagnostic, AssemblyRuntimeContext, AssemblySource } from '../prompt-assembly/types.js';

export interface PromptTemplateDefinition {
  id: string;
  providerId: string;
  title: string;
  description?: string;
  source: AssemblySource;
  location: { kind: 'file'; path: string };
  priority: number;
}

export interface RuntimePromptTemplate extends PromptTemplateDefinition {
  enabled: boolean;
  diagnostics: AssemblyDiagnostic[];
}

export interface PromptTemplatePlan {
  templates: RuntimePromptTemplate[];
  templatePaths: string[];
  diagnostics: AssemblyDiagnostic[];
}

export interface PromptTemplateRuntimeHook {
  id: string;
  priority?: number;
  afterPromptTemplateDiscovery?(templates: PromptTemplateDefinition[], ctx: AssemblyRuntimeContext): PromptTemplateDefinition[];
  beforePromptTemplateInjection?(templates: RuntimePromptTemplate[], ctx: AssemblyRuntimeContext): RuntimePromptTemplate[];
  afterPromptTemplateInjection?(plan: PromptTemplatePlan, ctx: AssemblyRuntimeContext): void;
}

const runtimeHooks: PromptTemplateRuntimeHook[] = [];

export function registerPromptTemplateRuntimeHook(hook: PromptTemplateRuntimeHook): () => void {
  runtimeHooks.push(hook);
  runtimeHooks.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id));
  return () => {
    const index = runtimeHooks.indexOf(hook);
    if (index >= 0) runtimeHooks.splice(index, 1);
  };
}

export function listPromptTemplateDefinitions(ctx: AssemblyRuntimeContext): PromptTemplateDefinition[] {
  const resolved = resolveRuntimeResources(ctx.profile, { repoRoot: ctx.repoRoot });
  let templates = resolved.promptEntries.map((path, index): PromptTemplateDefinition => {
    const title = basename(path).replace(/\.[^.]+$/, '');
    return {
      id: title,
      providerId: 'runtime-resources',
      title,
      source: { kind: 'configured-folder', label: 'Prompt templates', root: path },
      location: { kind: 'file', path },
      priority: index,
    };
  });
  for (const hook of runtimeHooks) {
    if (hook.afterPromptTemplateDiscovery) templates = hook.afterPromptTemplateDiscovery(templates, ctx);
  }
  return templates;
}

export function buildPromptTemplatePlan(ctx: AssemblyRuntimeContext): PromptTemplatePlan {
  let templates = listPromptTemplateDefinitions(ctx).map((template): RuntimePromptTemplate => {
    const diagnostics = validateTemplate(template);
    return { ...template, enabled: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'), diagnostics };
  });
  for (const hook of runtimeHooks) {
    if (hook.beforePromptTemplateInjection) templates = hook.beforePromptTemplateInjection(templates, ctx);
  }
  const plan: PromptTemplatePlan = {
    templates,
    templatePaths: [...new Set(templates.filter((template) => template.enabled).map((template) => template.location.path))],
    diagnostics: templates.flatMap((template) => template.diagnostics),
  };
  for (const hook of runtimeHooks) hook.afterPromptTemplateInjection?.(plan, ctx);
  return plan;
}

function validateTemplate(template: PromptTemplateDefinition): AssemblyDiagnostic[] {
  if (!existsSync(template.location.path)) {
    return [
      {
        severity: 'error',
        code: 'missing-prompt-template',
        message: `${template.id} prompt template is missing: ${template.location.path}`,
        sourceId: template.id,
      },
    ];
  }
  return [];
}
