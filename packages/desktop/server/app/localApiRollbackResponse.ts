export function buildRollbackConversationResponse(input: { id: string; sessionFile: string }): { id: string; sessionFile: string } {
  return { id: input.id, sessionFile: input.sessionFile };
}

export function assertRollbackLiveSessionNotStreaming(isStreaming: boolean): void {
  if (isStreaming) {
    throw new Error('Cannot roll back a running conversation. Interrupt it first.');
  }
}
