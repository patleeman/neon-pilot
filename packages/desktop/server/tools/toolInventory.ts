import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import {
  type ExtensionToolRegistration,
  listExtensionToolRegistrations,
} from '../extensions/extensionRegistry.js';
import { invokePromptAssemblyProvider, isRecord } from '../prompt-assembly/providerRuntime.js';
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
const OVERRIDABLE_TOOLS = new Set(['bash', 'read', 'write', 'edit', 'grep', 'find', 'ls', 'notify', 'web_fetch', 'web_search']);

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

export async function listToolDefinitionsAsync(ctx: AssemblyRuntimeContext): Promise<ToolDefinition[]> {
  return (await listToolDefinitionsWithDiagnosticsAsync(ctx)).definitions;
}

async function listToolDefinitionsWithDiagnosticsAsync(
  ctx: AssemblyRuntimeContext,
): Promise<{ definitions: ToolDefinition[]; diagnostics: AssemblyDiagnostic[] }> {
  const { tools: staticTools } = await getExtensionHostClient().listStaticContributions();
  let tools = staticTools.map(extensionToolToDefinition);
  for (const hook of runtimeHooks) {
    if (hook.afterToolDiscovery) tools = hook.afterToolDiscovery(tools, ctx);
  }
  tools = tools.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const diagnostics: AssemblyDiagnostic[] = [];
  const { assemblyProviders } = await getExtensionHostClient().listPromptAssemblyContributions();
  const providers = assemblyProviders.filter((provider) => provider.kind === 'tools');
  await Promise.allSettled(
    providers.map(async (provider) => {
      const { items: provided, diagnostics: providerDiagnostics } = await invokePromptAssemblyProvider<ToolDefinition>({
        provider,
        payload: ctx,
        resultKey: 'tools',
        validateItem: isToolDefinitionLike,
      });
      diagnostics.push(...providerDiagnostics);
      tools.push(
        ...provided.map((tool) => ({
          ...tool,
          providerId: tool.providerId || `extension-provider:${provider.extensionId}/${provider.id}`,
          source: tool.source || { kind: 'extension', label: provider.title ?? provider.id, extensionId: provider.extensionId },
          raw:
            tool.raw || typeof tool.action !== 'string'
              ? tool.raw
              : {
                  extensionId: provider.extensionId,
                  packageType: provider.packageType,
                  id: tool.id,
                  name: tool.name,
                  action: tool.action,
                  title: tool.title,
                  label: tool.label,
                  description: tool.description,
                  inputSchema: tool.inputSchema,
                  promptSnippet: tool.promptSnippet,
                  promptGuidelines: tool.promptGuidelines,
                  priority: tool.priority,
                  when: tool.when,
                  replaces: tool.replaces,
                },
        })),
      );
    }),
  );
  return { definitions: tools.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)), diagnostics };
}

function isToolDefinitionLike(value: unknown): value is ToolDefinition {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    isRecord(value.inputSchema)
  );
}

export function buildToolInjectionPlan(ctx: AssemblyRuntimeContext): ToolInjectionPlan {
  return buildToolInjectionPlanFromDefinitions(listToolDefinitions(ctx), ctx);
}

export async function buildToolInjectionPlanAsync(ctx: AssemblyRuntimeContext): Promise<ToolInjectionPlan> {
  const { definitions, diagnostics } = await listToolDefinitionsWithDiagnosticsAsync(ctx);
  const plan = buildToolInjectionPlanFromDefinitions(definitions, ctx);
  plan.diagnostics.push(...diagnostics);
  return plan;
}

function buildToolInjectionPlanFromDefinitions(definitions: ToolDefinition[], ctx: AssemblyRuntimeContext): ToolInjectionPlan {
  let tools = definitions.map((tool): RuntimeTool => {
    const diagnostics = validateTool(tool);
    const condition = toolConditionMatches(tool, ctx);
    const availability = toolAvailabilityMatches(tool);
    const replacementValid = !tool.replaces || OVERRIDABLE_TOOLS.has(tool.replaces);
    const enabled = diagnostics.every((diagnostic) => diagnostic.severity !== 'error') && condition && availability.ok && replacementValid;
    return {
      ...tool,
      diagnostics: replacementValid
        ? [...diagnostics, ...availability.diagnostics]
        : [
            ...diagnostics,
            ...availability.diagnostics,
            {
              severity: 'warning',
              code: 'non-overridable-replacement',
              message: `${tool.id} tried to replace non-overridable tool ${tool.replaces}. It will register as ${tool.name}.`,
              sourceId: tool.id,
            },
          ],
      enabled,
      active: enabled,
      reason: enabled
        ? 'enabled'
        : condition
          ? availability.ok
            ? 'disabled by diagnostics or replacement policy'
            : 'required configuration is missing'
          : 'model/provider condition did not match',
    };
  });
  for (const hook of runtimeHooks) {
    if (hook.beforeToolInjection) tools = hook.beforeToolInjection(tools, ctx);
  }
  tools = markDuplicateToolNamesInactive(tools);
  const active = tools.filter((tool) => tool.active && tool.raw).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const plan: ToolInjectionPlan = {
    tools,
    activeToolNames: active.map(effectiveToolName),
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

function effectiveToolName(tool: ToolDefinition): string {
  return tool.replaces && OVERRIDABLE_TOOLS.has(tool.replaces) ? tool.replaces : tool.name;
}

function markDuplicateToolNamesInactive(tools: RuntimeTool[]): RuntimeTool[] {
  const byName = new Map<string, RuntimeTool>();
  for (const tool of tools) {
    if (!tool.active || !tool.raw) continue;
    const name = effectiveToolName(tool);
    const existing = byName.get(name);
    if (!existing || tool.priority > existing.priority || (tool.priority === existing.priority && tool.id.localeCompare(existing.id) < 0)) {
      byName.set(name, tool);
    }
  }
  return tools.map((tool) => {
    if (!tool.active || !tool.raw) return tool;
    if (byName.get(effectiveToolName(tool)) === tool) return tool;
    return {
      ...tool,
      active: false,
      reason: `shadowed by higher-priority ${effectiveToolName(tool)} provider`,
    };
  });
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

function toolAvailabilityMatches(tool: ToolDefinition): { ok: boolean; diagnostics: AssemblyDiagnostic[] } {
  void tool;
  return { ok: true, diagnostics: [] };
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
