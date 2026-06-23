import { describe, expect, it } from 'vitest';

import { hasConversationComposerShelfContent, splitComposerShelvesByPlacement } from './conversationComposerShelves';

const emptyInput = {
  composerShelvesTopCount: 0,
  composerShelvesBottomCount: 0,
  attachedContextDocsCount: 0,
  draftMentionItemsCount: 0,
  pendingQueueCount: 0,
  draft: false,
  orderedDeferredResumesCount: 0,
  pendingBrowserCommentsCount: 0,
  hasActiveQuestion: false,
};

describe('conversationComposerShelves', () => {
  it('splits composer shelves by placement', () => {
    const shelves = [{ id: 'top', placement: 'top' }, { id: 'bottom', placement: 'bottom' }, { id: 'other' }];
    expect(splitComposerShelvesByPlacement(shelves)).toEqual({ top: [shelves[0]], bottom: [shelves[1]] });
  });

  it('detects composer shelf content sources', () => {
    expect(hasConversationComposerShelfContent(emptyInput)).toBe(false);
    expect(hasConversationComposerShelfContent({ ...emptyInput, composerShelvesTopCount: 1 })).toBe(true);
    expect(hasConversationComposerShelfContent({ ...emptyInput, attachedContextDocsCount: 1 })).toBe(true);
    expect(hasConversationComposerShelfContent({ ...emptyInput, draftMentionItemsCount: 1 })).toBe(true);
    expect(hasConversationComposerShelfContent({ ...emptyInput, pendingQueueCount: 1 })).toBe(true);

    expect(hasConversationComposerShelfContent({ ...emptyInput, orderedDeferredResumesCount: 1 })).toBe(true);
    expect(hasConversationComposerShelfContent({ ...emptyInput, draft: true, orderedDeferredResumesCount: 1 })).toBe(false);
    expect(hasConversationComposerShelfContent({ ...emptyInput, scheduledTasksCount: 1 })).toBe(true);
    expect(hasConversationComposerShelfContent({ ...emptyInput, draft: true, scheduledTasksCount: 1 })).toBe(false);
    expect(hasConversationComposerShelfContent({ ...emptyInput, backgroundExecutionsCount: 1 })).toBe(true);
    expect(hasConversationComposerShelfContent({ ...emptyInput, pendingBrowserCommentsCount: 1 })).toBe(true);
    expect(hasConversationComposerShelfContent({ ...emptyInput, hasActiveQuestion: true })).toBe(true);
  });
});
