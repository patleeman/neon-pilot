export function hasBlockingOverlayOpen(
  hasBlockingConversationOverlay: () => boolean,
  documentAvailable = typeof document !== 'undefined',
): boolean {
  return documentAvailable && hasBlockingConversationOverlay();
}
