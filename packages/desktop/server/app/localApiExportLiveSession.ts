export function normalizeExportLiveSessionConversationId(conversationId: string): string {
  const normalized = conversationId.trim();
  if (!normalized) {
    throw new Error('conversationId required');
  }
  return normalized;
}

export function normalizeOptionalExportOutputPath(outputPath: string | undefined): string | undefined {
  return outputPath?.trim() || undefined;
}

export function buildExportLiveSessionResponse(input: { path: string }): { ok: true; path: string } {
  return { ok: true, path: input.path };
}
