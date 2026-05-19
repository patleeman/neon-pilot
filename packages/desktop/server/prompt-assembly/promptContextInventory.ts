import { invokeExtensionAction } from '../extensions/extensionBackend.js';
import { listExtensionPromptContextProviderRegistrations } from '../extensions/extensionRegistry.js';
import type { AssemblyDiagnostic } from './types.js';

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
  const providers = listExtensionPromptContextProviderRegistrations();

  await Promise.allSettled(
    providers.map(async (provider) => {
      const providerId = `${provider.extensionId}/${provider.id}`;
      try {
        const invokeResult = await invokeExtensionAction(provider.extensionId, provider.handler, {
          prompt: input.prompt,
          conversationId: input.conversationId,
          currentCwd: input.currentCwd,
          relatedConversationIds: input.selectedSessionIds,
        });
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
