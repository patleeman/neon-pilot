function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readExecutionWrappers(details: unknown): Array<{ id: string; label?: string }> {
  if (!isRecord(details) || !Array.isArray(details.executionWrappers)) {
    return [];
  }

  return details.executionWrappers.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : '';
    if (!id) return [];
    const label = typeof item.label === 'string' && item.label.trim().length > 0 ? item.label.trim() : undefined;
    return [{ id, ...(label ? { label } : {}) }];
  });
}

export function resolveProviderCompactionLabel(details: unknown): string | undefined {
  if (!isRecord(details)) {
    return undefined;
  }

  const nativeDetails = isRecord(details.nativeCompaction) ? details.nativeCompaction : details;
  if (!isRecord(nativeDetails) || nativeDetails.provider !== 'openai-responses-compact') {
    return undefined;
  }

  const modelKey = typeof nativeDetails.modelKey === 'string' ? nativeDetails.modelKey.trim() : '';
  if (modelKey.startsWith('openai-codex:')) {
    return 'Codex compaction';
  }
  if (modelKey.startsWith('openai:')) {
    return 'OpenAI compaction';
  }

  return 'Provider compaction';
}

export function resolveCompactionSummarySupplement(details: unknown): string | undefined {
  const label = resolveProviderCompactionLabel(details);
  return label ? `This used ${label} under the hood. Pi kept the text summary for display and portability.` : undefined;
}
