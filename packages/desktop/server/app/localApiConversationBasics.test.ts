import { describe, expect, it } from 'vitest';

import {
  DesktopConversationTitleValidationError,
  readRequiredConversationId,
  readRequiredConversationName,
} from './localApiConversationBasics';

describe('localApiConversationBasics', () => {
  it('trims required conversation ids and names', () => {
    expect(readRequiredConversationId(' conversation-1 ')).toBe('conversation-1');
    expect(readRequiredConversationName(' New title ')).toBe('New title');
  });

  it('rejects missing conversation ids and names', () => {
    expect(() => readRequiredConversationId('   ')).toThrow('conversationId required');
    expect(() => readRequiredConversationName('   ')).toThrow(DesktopConversationTitleValidationError);
    expect(() => readRequiredConversationName('   ')).toThrow('Conversation title is required.');
  });
});
