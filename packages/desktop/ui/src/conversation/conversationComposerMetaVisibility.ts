export function shouldShowConversationComposerMeta(input: {
  draft: boolean;
  draftCwdValue: string;
  sessionTokens: unknown;
  currentCwd: string | null | undefined;
  conversationCwdEditorOpen: boolean;
  conversationCwdError: string | null | undefined;
  branchLabel: string | null | undefined;
  hasGitSummary: boolean;
}): boolean {
  if (input.draft) {
    return Boolean(input.draftCwdValue);
  }

  return (
    Boolean(input.sessionTokens) ||
    Boolean(input.currentCwd || input.conversationCwdEditorOpen || input.conversationCwdError) ||
    Boolean(input.branchLabel) ||
    input.hasGitSummary
  );
}
