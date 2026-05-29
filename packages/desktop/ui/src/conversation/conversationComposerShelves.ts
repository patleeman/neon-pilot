export function splitComposerShelvesByPlacement<TShelf extends { placement?: string }>(
  shelves: TShelf[],
): {
  top: TShelf[];
  bottom: TShelf[];
} {
  return {
    top: shelves.filter((shelf) => shelf.placement === 'top'),
    bottom: shelves.filter((shelf) => shelf.placement === 'bottom'),
  };
}

export function hasConversationComposerShelfContent(input: {
  composerShelvesTopCount: number;
  composerShelvesBottomCount: number;
  attachedContextDocsCount: number;
  draftMentionItemsCount: number;
  pendingQueueCount: number;
  draft: boolean;
  orderedDeferredResumesCount: number;
  pendingBrowserCommentsCount: number;
  hasActiveQuestion: boolean;
}): boolean {
  return (
    input.composerShelvesTopCount > 0 ||
    input.composerShelvesBottomCount > 0 ||
    input.attachedContextDocsCount > 0 ||
    input.draftMentionItemsCount > 0 ||
    input.pendingQueueCount > 0 ||
    (!input.draft && input.orderedDeferredResumesCount > 0) ||
    input.pendingBrowserCommentsCount > 0 ||
    input.hasActiveQuestion
  );
}
