import { type AgentToolResult, createCodingTools, type ExtensionContext, type ToolDefinition } from '@earendil-works/pi-coding-agent';

import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import type { ExtensionHostBackendServerContext, ExtensionHostToolContext } from '../extensions/extensionHostProtocol.js';
import { createExtensionHostServerContextSnapshot } from '../extensions/extensionHostServerContext.js';
import { createExtensionHostToolContextSnapshot } from '../extensions/extensionHostToolContext.js';
import { listExtensionToolRegistrations } from '../extensions/extensionRegistry.js';
import { buildToolInjectionPlan } from './toolInventory.js';

export interface ToolGatewayRuntimeContext {
  profile?: string;
  runtimeScope?: string;
  repoRoot?: string;
  modelRef?: string;
}

export interface ToolGatewaySummary {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  source: {
    extensionId: string;
    toolId: string;
    action: string;
  };
}

export interface ToolGatewayInvokeInput {
  name: string;
  input?: unknown;
  runtime?: ToolGatewayRuntimeContext;
  toolContext?: ExtensionHostToolContext;
  agentContext?: ExtensionContext;
  signal?: AbortSignal;
}

function runtimeContext(input?: ToolGatewayRuntimeContext) {
  return {
    profile: input?.runtimeScope ?? input?.profile ?? 'shared',
    repoRoot: input?.repoRoot ?? process.cwd(),
    modelRef: input?.modelRef,
  };
}

function activeRegistrations(input?: ToolGatewayRuntimeContext) {
  const plan = buildToolInjectionPlan(runtimeContext(input));
  const active = new Set(plan.registrations.map((tool) => `${tool.extensionId}/${tool.id}`));
  return listExtensionToolRegistrations().filter((tool) => active.has(`${tool.extensionId}/${tool.id}`));
}

export function listInvocableExtensionTools(input?: ToolGatewayRuntimeContext): ToolGatewaySummary[] {
  return activeRegistrations(input).map((tool) => ({
    name: tool.replaces?.trim() || tool.name,
    ...(tool.title ? { title: tool.title } : {}),
    description: tool.description,
    inputSchema: tool.inputSchema,
    source: {
      extensionId: tool.extensionId,
      toolId: tool.id,
      action: tool.action,
    },
  }));
}

export async function invokeExtensionToolByName(
  input: ToolGatewayInvokeInput,
  serverContext?: ExtensionHostBackendServerContext,
): Promise<AgentToolResult<unknown> & { isError?: boolean; terminate?: boolean }> {
  const name = input.name.trim();
  if (!name) throw new Error('Tool name is required.');
  const tool = activeRegistrations(input.runtime).find((candidate) => (candidate.replaces?.trim() || candidate.name) === name);
  if (!tool) throw new Error(`Tool is not available: ${name}`);

  const result = await getExtensionHostClient().invokeAction({
    extensionId: tool.extensionId,
    actionId: tool.action,
    input: input.input ?? {},
    ...(input.toolContext?.onUpdate
      ? { serverContext, toolContext: input.toolContext }
      : {
          serverContextSnapshot: createExtensionHostServerContextSnapshot(serverContext),
          toolContextSnapshot: createExtensionHostToolContextSnapshot(input.toolContext),
        }),
  });
  if (!result.ok) {
    return {
      content: [{ type: 'text', text: result.error }],
      details: { extensionId: tool.extensionId, toolId: tool.id, action: tool.action, error: result.error },
      isError: true,
    };
  }

  const value = result.result as
    | { content?: unknown; text?: unknown; details?: unknown; isError?: unknown; terminate?: unknown }
    | null
    | undefined;
  const content =
    value && typeof value === 'object' && Array.isArray(value.content)
      ? (value.content as AgentToolResult<unknown>['content'])
      : [
          {
            type: 'text' as const,
            text:
              value && typeof value === 'object' && typeof value.text === 'string' ? value.text : JSON.stringify(result.result, null, 2),
          },
        ];

  return {
    content,
    details: value && typeof value === 'object' && 'details' in value ? value.details : result.result,
    ...(value?.isError === true ? { isError: true } : {}),
    ...(value?.terminate === true ? { terminate: true } : {}),
  };
}

const BUILT_IN_TOOL_NAMES = new Set(['bash', 'read', 'write', 'edit', 'grep', 'find', 'ls']);

function builtinToolsFor(input: ToolGatewayInvokeInput): Record<string, ToolDefinition> {
  const cwd = input.toolContext?.cwd ?? input.agentContext?.sessionManager?.getCwd?.() ?? input.agentContext?.cwd ?? process.cwd();
  return createCodingTools(cwd) as unknown as Record<string, ToolDefinition>;
}

export async function invokeToolByName(
  input: ToolGatewayInvokeInput,
  serverContext?: ExtensionHostBackendServerContext,
): Promise<AgentToolResult<unknown> & { isError?: boolean; terminate?: boolean }> {
  const name = input.name.trim();
  if (BUILT_IN_TOOL_NAMES.has(name)) {
    const tool = builtinToolsFor(input)[name];
    if (!tool) throw new Error(`Built-in tool is unavailable: ${name}`);
    return tool.execute(
      `tool-gateway-${Date.now()}`,
      input.input as never,
      input.signal,
      undefined,
      input.agentContext as ExtensionContext,
    );
  }
  return invokeExtensionToolByName(input, serverContext);
}
