export interface ReservedDraftConversation {
  id: string;
  sessionFile: string;
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
