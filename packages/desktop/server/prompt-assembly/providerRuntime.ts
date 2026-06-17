import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import type { AssemblyDiagnostic } from './types.js';

const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;

export interface PromptAssemblyProviderRef {
  extensionId: string;
  id: string;
  handler: string;
  title?: string;
}

export interface PromptAssemblyProviderCall<T> {
  items: T[];
  diagnostics: AssemblyDiagnostic[];
}

export async function invokePromptAssemblyProvider<T>(input: {
  provider: PromptAssemblyProviderRef;
  payload: unknown;
  resultKey: string;
  validateItem: (item: unknown) => item is T;
  timeoutMs?: number;
}): Promise<PromptAssemblyProviderCall<T>> {
  const providerId = `${input.provider.extensionId}/${input.provider.id}`;
  const diagnostics: AssemblyDiagnostic[] = [];
  let timeout: NodeJS.Timeout | undefined;
  const abortController = new AbortController();
  try {
    const timeoutMs = input.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        abortController.abort();
        reject(new Error(`Timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const result = await Promise.race([
      getExtensionHostClient().invokeAction({
        extensionId: input.provider.extensionId,
        actionId: input.provider.handler,
        input: input.payload,
        signal: abortController.signal,
      }),
      timeoutPromise,
    ]);
    if (!result.ok) {
      return {
        items: [],
        diagnostics: [
          {
            severity: 'warning',
            code: 'prompt-assembly-provider-failed',
            message: `${input.provider.title ?? input.provider.id} provider failed; prompt assembly continued without it.`,
            sourceId: providerId,
          },
        ],
      };
    }
    const raw = result.result as Record<string, unknown> | unknown[] | null | undefined;
    const values = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray(raw[input.resultKey])
        ? raw[input.resultKey]
        : [];
    if (!Array.isArray(values)) {
      return {
        items: [],
        diagnostics: [
          {
            severity: 'warning',
            code: 'prompt-assembly-provider-malformed-result',
            message: `${input.provider.title ?? input.provider.id} provider returned no ${input.resultKey} array.`,
            sourceId: providerId,
          },
        ],
      };
    }
    const items: T[] = [];
    values.forEach((value, index) => {
      if (input.validateItem(value)) items.push(value);
      else {
        diagnostics.push({
          severity: 'warning',
          code: 'prompt-assembly-provider-invalid-item',
          message: `${input.provider.title ?? input.provider.id} provider returned invalid ${input.resultKey}[${index}].`,
          sourceId: providerId,
        });
      }
    });
    return { items, diagnostics };
  } catch (error) {
    return {
      items: [],
      diagnostics: [
        {
          severity: 'warning',
          code: 'prompt-assembly-provider-error',
          message: `${input.provider.title ?? input.provider.id} provider error: ${error instanceof Error ? error.message : String(error)}`,
          sourceId: providerId,
        },
      ],
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
