import { describe, expect, it } from 'vitest';

import { buildExtensionMentionRegistrations, buildExtensionModelProfileRegistrations } from './extensionSimpleContributions';

describe('extensionSimpleContributions', () => {
  it('builds mention registrations and skips incomplete mentions', () => {
    expect(
      buildExtensionMentionRegistrations({
        extensionId: 'mention-board',
        packageType: 'system',
        mentions: [
          { id: ' docs ', title: 'Docs', description: 'Search docs', kinds: ['file'], provider: ' docs.search ' },
          { id: '', title: 'No id', kinds: ['file'], provider: 'provider' },
          { id: 'no-title', title: ' ', kinds: ['file'], provider: 'provider' },
          { id: 'no-provider', title: 'No provider', kinds: ['file'], provider: ' ' },
          null as unknown as { id: string; title: string; kinds: string[]; provider: string },
          { id: 'kind-non-string', title: 'Kinds invalid', kinds: [1, 'valid', null] as unknown as string[], provider: 'provider' },
          { id: 'valid-2', title: 'Second valid', kinds: ['message', 'file'], provider: 'provider2' },
        ],
      }),
    ).toEqual([
      {
        extensionId: 'mention-board',
        packageType: 'system',
        id: 'docs',
        title: 'Docs',
        description: 'Search docs',
        kinds: ['file'],
        provider: 'docs.search',
      },
      {
        extensionId: 'mention-board',
        packageType: 'system',
        id: 'kind-non-string',
        title: 'Kinds invalid',
        kinds: ['valid'],
        provider: 'provider',
      },
      {
        extensionId: 'mention-board',
        packageType: 'system',
        id: 'valid-2',
        title: 'Second valid',
        kinds: ['message', 'file'],
        provider: 'provider2',
      },
    ]);
  });

  it('builds model profile registrations with trimmed match patterns and default priority', () => {
    expect(
      buildExtensionModelProfileRegistrations({
        extensionId: 'models-board',
        profiles: [
          { id: ' fast ', title: 'Fast', description: 'Fast models', match: [' gpt-* ', '', 'claude-*'], priority: 7 },
          { id: 'empty-match', match: [' '] },
          { id: ' ', match: ['gpt-*'] },
          { id: 'default-priority', match: ['gemini-*'], priority: Number.NaN },
        ],
      }),
    ).toEqual([
      {
        extensionId: 'models-board',
        packageType: 'user',
        id: 'fast',
        title: 'Fast',
        description: 'Fast models',
        match: ['gpt-*', 'claude-*'],
        priority: 7,
      },
      {
        extensionId: 'models-board',
        packageType: 'user',
        id: 'default-priority',
        match: ['gemini-*'],
        priority: 0,
      },
    ]);
  });
});
