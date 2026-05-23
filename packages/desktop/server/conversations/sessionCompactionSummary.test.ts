import { describe, expect, it } from 'vitest';

import { readExecutionWrappers, resolveCompactionSummarySupplement, resolveProviderCompactionLabel } from './sessionCompactionSummary';

describe('sessionCompactionSummary', () => {
  it('reads valid execution wrappers only and trims values', () => {
    expect(
      readExecutionWrappers({ executionWrappers: [{ id: ' codex:compact ', label: ' Codex ' }, { id: 1 }, null, { id: '  ' }] }),
    ).toEqual([{ id: 'codex:compact', label: 'Codex' }]);
    expect(readExecutionWrappers({})).toEqual([]);
  });

  it('resolves compaction provider labels from native compaction details', () => {
    expect(
      resolveProviderCompactionLabel({ nativeCompaction: { provider: 'openai-responses-compact', modelKey: 'openai-codex:gpt-5' } }),
    ).toBe('Codex compaction');
    expect(resolveProviderCompactionLabel({ provider: 'openai-responses-compact', modelKey: 'openai:gpt-5' })).toBe('OpenAI compaction');
    expect(resolveProviderCompactionLabel({ provider: 'openai-responses-compact', modelKey: 'other:model' })).toBe('Provider compaction');
    expect(resolveProviderCompactionLabel({ provider: 'other' })).toBeUndefined();
  });

  it('formats the supplement text when a provider label exists', () => {
    expect(resolveCompactionSummarySupplement({ provider: 'openai-responses-compact', modelKey: 'openai:gpt-5' })).toBe(
      'This used OpenAI compaction under the hood. Pi kept the text summary for display and portability.',
    );
    expect(resolveCompactionSummarySupplement({})).toBeUndefined();
  });
});
