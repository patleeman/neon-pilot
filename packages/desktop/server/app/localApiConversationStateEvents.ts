export function shouldEmitConversationState(input: { closed: boolean; serializedState: string; lastSerializedState: string }): boolean {
  return !input.closed && input.serializedState !== input.lastSerializedState;
}

export function buildConversationStateBridgeEvent<TState>(state: TState): { type: 'state'; state: TState } {
  return { type: 'state', state };
}

export function shouldRecoverConversationState(input: { closed: boolean; live: boolean; hasSessionDetail: boolean }): boolean {
  return !input.closed && !input.live && input.hasSessionDetail;
}
