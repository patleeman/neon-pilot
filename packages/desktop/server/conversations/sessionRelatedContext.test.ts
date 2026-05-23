import { describe, expect, it } from 'vitest';

import {
  formatRelatedConversationPointersText,
  formatRelatedThreadsSummaryText,
  resolveRelatedConversationPointersDetail,
  resolveRelatedThreadsSummaryDetail,
} from './sessionRelatedContext';

describe('sessionRelatedContext', () => {
  it('formats related thread summaries for display', () => {
    expect(formatRelatedThreadsSummaryText('Header\r\nConversation 1 — Title\r\nWorkspace: /repo\r\nCreated: today')).toBe(
      '### Conversation 1 — Title\n- Workspace: `/repo`\n- Created: today',
    );
    expect(formatRelatedThreadsSummaryText('   ')).toBe('');
  });

  it('describes related thread summary counts', () => {
    expect(resolveRelatedThreadsSummaryDetail('no conversations')).toBe(
      'Selected conversations were summarized and injected before this prompt so this thread could start with reused context.',
    );
    expect(resolveRelatedThreadsSummaryDetail('### Conversation 1 — A\nConversation 2 — B')).toBe(
      '2 selected conversations were summarized and injected before this prompt so this thread could start with reused context.',
    );
  });

  it('formats and describes related conversation pointers', () => {
    expect(formatRelatedConversationPointersText('  1. One\r\n2. Two  ')).toBe('1. One\n2. Two');
    expect(resolveRelatedConversationPointersDetail('none')).toBe(
      'Related conversation pointers were offered before this prompt. Inspect a conversation before relying on its details.',
    );
    expect(resolveRelatedConversationPointersDetail('1. One\n2. Two')).toBe(
      '2 related conversation pointers were offered before this prompt. Inspect a conversation before relying on its details.',
    );
  });
});
