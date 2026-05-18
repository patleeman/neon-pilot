import type { MessageBlock } from '../shared/types';

export interface ToolExecutionWrapperPresentation {
  id: string;
  label?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
}

function readExecutionWrappersFromRecord(value: Record<string, unknown> | null): ToolExecutionWrapperPresentation[] {
  const candidate = value?.executionWrappers;
  if (!Array.isArray(candidate)) return [];

  return candidate.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = readTrimmedString(item, 'id');
    if (!id) return [];
    const label = readTrimmedString(item, 'label');
    return [{ id, ...(label ? { label } : {}) }];
  });
}

export function readToolExecutionWrappers(
  block: Pick<Extract<MessageBlock, { type: 'tool_use' }>, 'input' | 'details'>,
): ToolExecutionWrapperPresentation[] {
  const details = isRecord(block.details) ? block.details : null;
  const input = isRecord(block.input) ? block.input : null;
  const wrappers = readExecutionWrappersFromRecord(details);

  for (const wrapper of readExecutionWrappersFromRecord(input)) {
    if (!wrappers.some((item) => item.id === wrapper.id)) {
      wrappers.push(wrapper);
    }
  }

  return wrappers;
}

export function formatToolExecutionWrapperChain(wrappers: readonly ToolExecutionWrapperPresentation[]): string | null {
  if (wrappers.length === 0) return null;
  return wrappers.map((wrapper) => wrapper.label ?? wrapper.id).join(' → ');
}
