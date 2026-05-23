export function buildRenameDesktopConversationResult(input: { title: string }): { ok: true; title: string } {
  return { ok: true, title: input.title };
}

export function resolveRenamedStoredConversationTitle(input: { renamedTitle?: string | null; fallbackTitle: string }): string {
  const renamedTitle = input.renamedTitle?.trim();
  return renamedTitle || input.fallbackTitle;
}
