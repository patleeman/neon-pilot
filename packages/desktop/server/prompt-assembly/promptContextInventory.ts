import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { listExtensionPromptContextProviderRegistrations } from '../extensions/extensionRegistry.js';
import type { AssemblyDiagnostic } from './types.js';

const PROMPT_CONTEXT_PROVIDER_BUDGET_MS = 200;
const PROMPT_CONTEXT_PROVIDER_TIMEOUT = Symbol('prompt-context-provider-timeout');

async function withPromptContextProviderBudget<T>(run: Promise<T>): Promise<T | typeof PROMPT_CONTEXT_PROVIDER_TIMEOUT> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run,
      new Promise<typeof PROMPT_CONTEXT_PROVIDER_TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(PROMPT_CONTEXT_PROVIDER_TIMEOUT), PROMPT_CONTEXT_PROVIDER_BUDGET_MS);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export interface PromptContextBlock {
  id: string;
  providerId: string;
  title: string;
  content: string;
  visibility?: 'hidden' | 'debug' | 'visible';
}

export interface PromptContextPlan {
  blocks: PromptContextBlock[];
  contextMessages: Array<{ customType: string; content: string }>;
  diagnostics: AssemblyDiagnostic[];
}

export async function buildPromptContextPlan(input: {
  prompt: string;
  conversationId: string;
  currentCwd?: string;
  selectedSessionIds?: unknown;
  contextMessages?: Array<{ customType: string; content: string }>;
}): Promise<PromptContextPlan> {
  const contextMessages = [...(input.contextMessages ?? [])];
  const blocks: PromptContextBlock[] = [];
  const diagnostics: AssemblyDiagnostic[] = [];
  const selectedSessionIds = Array.isArray(input.selectedSessionIds) ? input.selectedSessionIds.filter((id) => typeof id === 'string') : [];
  if (contextMessages.length === 0 && selectedSessionIds.length === 0) {
    return { blocks, contextMessages, diagnostics };
  }

  const providers = listExtensionPromptContextProviderRegistrations();

  await Promise.allSettled(
    providers.map(async (provider) => {
      const providerId = `${provider.extensionId}/${provider.id}`;
      try {
        const invokeResult = await withPromptContextProviderBudget(
          getExtensionHostClient().invokeAction({
            extensionId: provider.extensionId,
            actionId: provider.handler,
            input: {
              prompt: input.prompt,
              conversationId: input.conversationId,
              currentCwd: input.currentCwd,
              relatedConversationIds: selectedSessionIds,
            },
          }),
        );
        if (invokeResult === PROMPT_CONTEXT_PROVIDER_TIMEOUT) {
          diagnostics.push({
            severity: 'warning',
            code: 'prompt-context-provider-timeout',
            message: `${provider.title ?? provider.id} context timed out; sent without it.`,
            sourceId: providerId,
          });
          return;
        }
        if (!invokeResult.ok) {
          diagnostics.push({
            severity: 'warning',
            code: 'prompt-context-provider-failed',
            message: `${provider.title ?? provider.id} context failed; sent without it.`,
            sourceId: providerId,
          });
          return;
        }
        const result = invokeResult.result as {
          contextMessages?: Array<{ customType: string; content: string }>;
          blocks?: Array<{ id?: string; title?: string; content: string; visibility?: 'hidden' | 'debug' | 'visible' }>;
          warnings?: string[];
        };
        if (Array.isArray(result.contextMessages)) contextMessages.push(...result.contextMessages);
        if (Array.isArray(result.blocks)) {
          for (const block of result.blocks) {
            if (!block || typeof block.content !== 'string' || !block.content.trim()) continue;
            const title = typeof block.title === 'string' && block.title.trim() ? block.title.trim() : (provider.title ?? provider.id);
            const normalized = {
              id: typeof block.id === 'string' && block.id.trim() ? block.id.trim() : `${providerId}:${blocks.length}`,
              providerId,
              title,
              content: block.content.trim(),
              visibility: block.visibility,
            };
            blocks.push(normalized);
            contextMessages.push({ customType: 'extension_turn_context', content: [`${title}:`, normalized.content].join('\n') });
          }
        }
        if (Array.isArray(result.warnings)) {
          diagnostics.push(
            ...result.warnings.map((warning) => ({
              severity: 'warning' as const,
              code: 'prompt-context-provider-warning',
              message: warning,
              sourceId: providerId,
            })),
          );
        }
      } catch (error) {
        diagnostics.push({
          severity: 'warning',
          code: 'prompt-context-provider-error',
          message: error instanceof Error ? error.message : String(error),
          sourceId: providerId,
        });
      }
    }),
  );

  return { blocks, contextMessages, diagnostics };
}
