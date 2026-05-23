export function shouldEnableMessageForkControls({
  renderingStaleTranscript,
  conversationId,
}: {
  renderingStaleTranscript: boolean;
  conversationId: string | undefined;
}): boolean {
  return !renderingStaleTranscript && Boolean(conversationId);
}
