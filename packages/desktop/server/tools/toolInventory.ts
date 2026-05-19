import { type ExtensionToolRegistration, listExtensionToolRegistrations } from '../extensions/extensionRegistry.js';
import type { AssemblyDiagnostic, AssemblyRuntimeContext, AssemblySource } from '../prompt-assembly/types.js';

export interface ToolDefinition {
  id: string;
  providerId: string;
  name: string;
  title?: string;
  label?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  source: AssemblySource;
  action?: string;
  replaces?: string;
  priority: number;
  when?: { providers?: string[]; models?: string[] };
  promptSnippet?: string;
  promptGuidelines?: string[];
  raw?: ExtensionToolRegistration;
}

export interface RuntimeTool extends ToolDefinition {
  enabled: boolean;
  active: boolean;
  reason: string;
  diagnostics: AssemblyDiagnostic[];
}

export interface ToolInjectionPlan {
  tools: RuntimeTool[];
  activeToolNames: string[];
  registrations: ExtensionToolRegistration[];
  promptGuidelines: string[];
  diagnostics: AssemblyDiagnostic[];
}

export interface ToolRuntimeHook {
  id: string;
  priority?: number;
  afterToolDiscovery?(tools: ToolDefinition[], ctx: AssemblyRuntimeContext): ToolDefinition[];
  beforeToolInjection?(tools: RuntimeTool[], ctx: AssemblyRuntimeContext): RuntimeTool[];
  afterToolInjection?(plan: ToolInjectionPlan, ctx: AssemblyRuntimeContext): void;
}

const runtimeHooks: ToolRuntimeHook[] = [];
const OVERRIDABLE_TOOLS = new Set(['bash', 'read', 'write', 'edit', 'grep', 'find', 'ls', 'notify']);

export function registerToolRuntimeHook(hook: ToolRuntimeHook): () => void {
  runtimeHooks.push(hook);
  runtimeHooks.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id));
  return () => {
    const index = runtimeHooks.indexOf(hook);
    if (index >= 0) runtimeHooks.splice(index, 1);
  };
}

export function listToolDefinitions(ctx: AssemblyRuntimeContext): ToolDefinition[] {
  let tools = listExtensionToolRegistrations().map(extensionToolToDefinition);
  for (const hook of runtimeHooks) {
    if (hook.afterToolDiscovery) tools = hook.afterToolDiscovery(tools, ctx);
  }
  return tools.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function buildToolInjectionPlan(ctx: AssemblyRuntimeContext): ToolInjectionPlan {
  let tools = listToolDefinitions(ctx).map((tool): RuntimeTool => {
    const diagnostics = validateTool(tool);
    const condition = toolConditionMatches(tool, ctx);
    const replacementValid = !tool.replaces || OVERRIDABLE_TOOLS.has(tool.replaces);
    const enabled = diagnostics.every((diagnostic) => diagnostic.severity !== 'error') && condition && replacementValid;
    return {
      ...tool,
      diagnostics: replacementValid
        ? diagnostics
        : [
            ...diagnostics,
            {
              severity: 'warning',
              code: 'non-overridable-replacement',
              message: `${tool.id} tried to replace non-overridable tool ${tool.replaces}. It will register as ${tool.name}.`,
              sourceId: tool.id,
            },
          ],
      enabled,
      active: enabled,
      reason: enabled ? 'enabled' : condition ? 'disabled by diagnostics or replacement policy' : 'model/provider condition did not match',
    };
  });
  for (const hook of runtimeHooks) {
    if (hook.beforeToolInjection) tools = hook.beforeToolInjection(tools, ctx);
  }
  const active = tools.filter((tool) => tool.active && tool.raw);
  const plan: ToolInjectionPlan = {
    tools,
    activeToolNames: active.map((tool) => (tool.replaces && OVERRIDABLE_TOOLS.has(tool.replaces) ? tool.replaces : tool.name)),
    registrations: active.map((tool) => tool.raw!),
    promptGuidelines: active.flatMap((tool) => tool.promptGuidelines ?? []),
    diagnostics: tools.flatMap((tool) => tool.diagnostics),
  };
  for (const hook of runtimeHooks) hook.afterToolInjection?.(plan, ctx);
  return plan;
}

function extensionToolToDefinition(tool: ExtensionToolRegistration): ToolDefinition {
  return {
    id: `${tool.extensionId}/${tool.id}`,
    providerId: `extension:${tool.extensionId}`,
    name: tool.name,
    title: tool.title,
    label: tool.label,
    description: tool.description,
    inputSchema: tool.inputSchema,
    source: { kind: 'extension', label: tool.extensionId, extensionId: tool.extensionId },
    action: tool.action,
    replaces: tool.replaces,
    priority: tool.priority ?? 0,
    when: tool.when,
    promptSnippet: tool.promptSnippet,
    promptGuidelines: tool.promptGuidelines,
    raw: tool,
  };
}

function toolConditionMatches(tool: ToolDefinition, ctx: AssemblyRuntimeContext): boolean {
  if (!tool.when) return true;
  const providers = new Set((tool.when.providers ?? []).map((value) => value.trim()).filter(Boolean));
  const models = new Set((tool.when.models ?? []).map((value) => value.trim()).filter(Boolean));
  if (providers.size === 0 && models.size === 0) return true;
  const modelRef = ctx.modelRef ?? '';
  const [providerFromModel, modelFromRef] = modelRef.includes('/') ? modelRef.split('/', 2) : ['', modelRef];
  const provider = ctx.provider || providerFromModel;
  return (provider.length > 0 && providers.has(provider)) || models.has(modelRef) || models.has(modelFromRef);
}

function validateTool(tool: ToolDefinition): AssemblyDiagnostic[] {
  const diagnostics: AssemblyDiagnostic[] = [];
  if (!tool.name.trim())
    diagnostics.push({ severity: 'error', code: 'missing-tool-name', message: `${tool.id} has no tool name.`, sourceId: tool.id });
  if (!tool.description.trim()) {
    diagnostics.push({ severity: 'error', code: 'missing-tool-description', message: `${tool.id} has no description.`, sourceId: tool.id });
  }
  if (!tool.action && tool.source.kind === 'extension') {
    diagnostics.push({ severity: 'error', code: 'missing-tool-action', message: `${tool.id} has no backend action.`, sourceId: tool.id });
  }
  return diagnostics;
}
