import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type { ServerRouteContext } from '../routes/context.js';
import { buildToolInjectionPlanFromRegistrations } from '../tools/toolInventory.js';
import { getExtensionHostClient } from './extensionHostClient.js';
import { createExtensionHostServerContextSnapshot } from './extensionHostServerContext.js';
import { createExtensionHostToolContextSnapshot } from './extensionHostToolContext.js';
import { listExtensionToolRegistrations } from './extensionRegistry.js';

export interface ManifestToolFactoryOptions {
  getRuntimeScope: () => string;
  getPreferredVisionModel?: () => string;
  getCurrentModelRef?: () => string;
  hasOpenAiImageProvider?: () => boolean;
  repoRoot: string;
  runtimeConfigRoot: string;
  stateRoot: string;
  serverContext?: Pick<ServerRouteContext, 'getRuntimeScope'> & Partial<Pick<ServerRouteContext, 'getSettingsFile' | 'getStateRoot'>>;
}

/**
 * Built-in tool names that user extensions are allowed to override via `replaces`.
 * This list prevents accidental or malicious replacement of critical infrastructure
 * while still allowing well-intentioned overrides of the primary coding tools.
 */
const OVERRIDABLE_TOOLS = new Set(['bash', 'read', 'write', 'edit', 'grep', 'find', 'ls', 'notify', 'web_fetch', 'web_search']);

function isOverridableTool(toolName: string): boolean {
  return OVERRIDABLE_TOOLS.has(toolName);
}

function parseModelRef(modelRef: string): { provider: string; model: string; full: string } {
  const full = modelRef.trim();
  const slashIndex = full.indexOf('/');
  if (slashIndex > 0 && slashIndex < full.length - 1) {
    return { provider: full.slice(0, slashIndex), model: full.slice(slashIndex + 1), full };
  }
  return { provider: '', model: full, full };
}

function modelConditionMatches(tool: { when?: { providers?: string[]; models?: string[] } }, modelRef: string): boolean {
  if (!tool.when) return true;
  const providerAllowList = new Set((tool.when.providers ?? []).map((value) => value.trim()).filter(Boolean));
  const modelAllowList = new Set((tool.when.models ?? []).map((value) => value.trim()).filter(Boolean));
  if (providerAllowList.size === 0 && modelAllowList.size === 0) return true;

  const current = parseModelRef(modelRef);
  const providerMatches = providerAllowList.size > 0 && current.provider.length > 0 && providerAllowList.has(current.provider);
  const modelMatches = modelAllowList.size > 0 && (modelAllowList.has(current.full) || modelAllowList.has(current.model));
  return providerMatches || modelMatches;
}

type ManifestToolResult = AgentToolResult<unknown> & { isError?: boolean };

export function listManifestToolAgentExtensionCacheEntries(): Array<{
  extensionId: string;
  id: string;
  name: string;
  action: string;
  nativeRegistration?: boolean;
  replaces?: string;
  when?: { providers?: string[]; models?: string[] };
}> {
  return listExtensionToolRegistrations().map((tool) => ({
    extensionId: tool.extensionId,
    id: tool.id,
    name: tool.name,
    action: tool.action,
    nativeRegistration: tool.nativeRegistration,
    replaces: tool.replaces,
    when: tool.when,
  }));
}

function normalizeUpdateContent(content: Array<{ type: string; text: string }> | undefined): AgentToolResult<unknown>['content'] {
  return (content ?? []).map((item) => ({ type: 'text' as const, text: item.text }));
}

export function createManifestToolAgentExtensions(options: ManifestToolFactoryOptions): Array<(pi: ExtensionAPI) => void> {
  const currentModelRef = options.getCurrentModelRef?.() ?? '';
  const registrations = listExtensionToolRegistrations();
  const registerableToolIds = new Set(
    buildToolInjectionPlanFromRegistrations(registrations, {
      profile: options.getRuntimeScope(),
      repoRoot: options.repoRoot,
      modelRef: currentModelRef,
    })
      .tools.filter((tool) => tool.enabled && tool.raw)
      .map((tool) => `${tool.raw!.extensionId}/${tool.raw!.id}`),
  );
  return registrations
    .filter((tool) => registerableToolIds.has(`${tool.extensionId}/${tool.id}`))
    .filter((tool) => !tool.nativeRegistration)
    .filter((tool) => modelConditionMatches(tool, currentModelRef))
    .map((tool) => {
      // When `replaces` is set and the target tool is overridable, use that name
      // so pi.registerTool() replaces the built-in tool.
      const registerName = tool.replaces && isOverridableTool(tool.replaces) ? tool.replaces : tool.name;
      const isOverride = registerName !== tool.name;

      return (pi: ExtensionAPI) => {
        pi.registerTool({
          name: registerName,
          label: tool.label ?? tool.title ?? tool.id,
          description: tool.description,
          promptSnippet: tool.promptSnippet ?? tool.description,
          ...(tool.promptGuidelines
            ? { promptGuidelines: tool.promptGuidelines }
            : isOverride
              ? { promptGuidelines: [`This tool replaces the built-in "${registerName}" tool.`] }
              : {}),
          parameters: tool.inputSchema,
          async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<ManifestToolResult> {
            const toolContext = {
              conversationId: ctx.sessionManager.getSessionId(),
              sessionId: ctx.sessionManager.getSessionId(),
              cwd: ctx.sessionManager.getCwd?.(),
              sessionFile: ctx.sessionManager.getSessionFile?.(),
              preferredVisionModel: options.getPreferredVisionModel?.(),
              // Forward the streaming update callback so backend handlers can
              // send progress updates during long-running tool execution.
              onUpdate: (update: { content?: Array<{ type: string; text: string }>; isError?: boolean }) => {
                onUpdate?.({
                  content: normalizeUpdateContent(update.content),
                  details: undefined,
                });
              },
            };
            const invokeResult = await getExtensionHostClient().invokeAction({
              extensionId: tool.extensionId,
              actionId: tool.action,
              input: params,
              serverContextSnapshot: createExtensionHostServerContextSnapshot(options.serverContext),
              toolContextSnapshot: createExtensionHostToolContextSnapshot(toolContext),
              toolContext: { onUpdate: toolContext.onUpdate },
              signal,
              agentToolContext: {
                conversationId: toolContext.conversationId,
                sessionId: toolContext.sessionId,
                cwd: toolContext.cwd,
                sessionFile: toolContext.sessionFile,
                toolContext: createExtensionHostToolContextSnapshot(toolContext),
              },
            });
            // Handle backend invocation error (build failure, not found, etc.)
            if (!invokeResult.ok) {
              return {
                content: [{ type: 'text' as const, text: invokeResult.error }],
                details: {
                  extensionId: tool.extensionId,
                  toolId: tool.id,
                  action: tool.action,
                  error: invokeResult.error,
                },
                isError: true,
              };
            }

            const extensionResult = invokeResult.result as
              | { content?: unknown; text?: unknown; details?: unknown; isError?: unknown; terminate?: unknown }
              | null
              | undefined;
            const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> =
              extensionResult &&
              typeof extensionResult === 'object' &&
              Array.isArray(extensionResult.content) &&
              extensionResult.content.every((item) => item && typeof item === 'object' && 'type' in item)
                ? (extensionResult.content as Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>)
                : [
                    {
                      type: 'text' as const,
                      text:
                        extensionResult && typeof extensionResult === 'object' && typeof extensionResult.text === 'string'
                          ? extensionResult.text
                          : JSON.stringify(invokeResult.result, null, 2),
                    },
                  ];
            return {
              content,
              details: {
                extensionId: tool.extensionId,
                toolId: tool.id,
                action: tool.action,
                result: extensionResult?.details ?? invokeResult.result,
              },
              ...(extensionResult?.isError === true ? ({ isError: true } as const) : {}),
              ...(extensionResult?.terminate === true ? ({ terminate: true } as const) : {}),
            };
          },
        });
      };
    });
}
