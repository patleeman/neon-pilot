export function buildUnchangedSessionDetailResponse(input: { sessionId: string; signature: string }): {
  unchanged: true;
  sessionId: string;
  signature: string;
} {
  return { unchanged: true, sessionId: input.sessionId, signature: input.signature };
}

export function shouldReturnUnchangedSessionDetail(input: {
  knownSessionSignature?: string;
  currentSessionSignature?: string | null;
}): input is { knownSessionSignature: string; currentSessionSignature: string } {
  return Boolean(
    input.knownSessionSignature && input.currentSessionSignature && input.knownSessionSignature === input.currentSessionSignature,
  );
}

export function shouldBuildAppendOnlySessionDetail(input: { knownSessionSignature?: string; nextSessionSignature?: string }): boolean {
  return Boolean(input.knownSessionSignature && input.nextSessionSignature && input.knownSessionSignature !== input.nextSessionSignature);
}
