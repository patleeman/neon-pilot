export interface ReservedDraftConversation {
  id: string;
  sessionFile: string;
}

export async function startReservedDraftConversationLiveSessionCreate<TCreated>(input: {
  reserved: ReservedDraftConversation;
  createLiveSession: (reservedSessionFile: string) => Promise<TCreated>;
  applyReservedConversation: (conversationId: string) => Promise<void>;
}): Promise<{ createdPromise: Promise<TCreated> }> {
  const createdPromise = input.createLiveSession(input.reserved.sessionFile);
  void createdPromise.catch(() => {});
  await input.applyReservedConversation(input.reserved.id);
  return { createdPromise };
}
