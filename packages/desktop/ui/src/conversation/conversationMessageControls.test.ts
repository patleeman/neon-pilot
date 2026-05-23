import { describe, expect, it } from 'vitest';

import { shouldEnableMessageForkControls } from './conversationMessageControls';

describe('conversationMessageControls', () => {
  it('enables message fork controls only for fresh loaded conversations', () => {
    expect(shouldEnableMessageForkControls({ renderingStaleTranscript: false, conversationId: 'conv-123' })).toBe(true);
    expect(shouldEnableMessageForkControls({ renderingStaleTranscript: true, conversationId: 'conv-123' })).toBe(false);
    expect(shouldEnableMessageForkControls({ renderingStaleTranscript: false, conversationId: undefined })).toBe(false);
  });
});
