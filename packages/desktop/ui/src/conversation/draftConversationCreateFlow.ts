export interface ReservedDraftConversation {
  id: string;
  sessionFile: string;
  cwd?: string | null;
}

export function resolveReservedDraftConversationCreateCwd(input: {
  reserved: ReservedDraftConversation;
  draftCwdValue: string;
  isNeutralChatCwdPath: (cwd: string | null | undefined) => boolean;
}): string | undefined {
  const reservedCwd = input.reserved.cwd?.trim() ?? '';
  if (reservedCwd && !input.isNeutralChatCwdPath(reservedCwd)) {
    return reservedCwd;
  }

  const draftCwd = input.draftCwdValue.trim();
  return draftCwd ? draftCwd : undefined;
}

export async function startReservedDraftConversationLiveSessionCreate<TCreated, TInitialPrompt = unknown>(input: {
  reserved: ReservedDraftConversation;
  initialPrompt?: TInitialPrompt;
  createLiveSession: (reservedSessionFile: string, initialPrompt: TInitialPrompt | undefined) => Promise<TCreated>;
  applyReservedConversation: (conversationId: string) => Promise<void>;
}): Promise<{ createdPromise: Promise<TCreated> }> {
  const createdPromise = input.createLiveSession(input.reserved.sessionFile, input.initialPrompt);
  void createdPromise.catch(() => {});
  await input.applyReservedConversation(input.reserved.id);
  return { createdPromise };
}
