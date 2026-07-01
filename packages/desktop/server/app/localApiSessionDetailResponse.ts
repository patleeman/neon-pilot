import {
  buildAppendOnlyConversationDetailResponse,
  readConversationSessionSignature,
  readSessionDetailForRoute,
} from '../conversations/conversationService.js';
import {
  inlineConversationSessionDetailAppendOnlyAssetsCapability,
  inlineConversationSessionDetailAssetsCapability,
} from '../conversations/conversationSessionAssetCapability.js';

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

function createAbortError(): Error {
  const error = new Error('Transcript load cancelled');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function abortPromise(signal?: AbortSignal): Promise<never> {
  if (!signal) {
    return new Promise(() => undefined);
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(createAbortError()), { once: true });
  });
}

export async function readSessionDetailRouteResponse(input: {
  sessionId: string;
  profile: string;
  tailBlocks?: number;
  knownSessionSignature?: string;
  knownBlockOffset?: number;
  knownTotalBlocks?: number;
  knownLastBlockId?: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  const sessionId = input.sessionId.trim();
  throwIfAborted(input.signal);

  const currentSessionSignature = input.knownSessionSignature ? readConversationSessionSignature(sessionId) : null;
  throwIfAborted(input.signal);

  const unchangedSessionCheck = { knownSessionSignature: input.knownSessionSignature, currentSessionSignature };
  if (shouldReturnUnchangedSessionDetail(unchangedSessionCheck)) {
    return buildUnchangedSessionDetailResponse({ sessionId, signature: unchangedSessionCheck.currentSessionSignature });
  }

  const { sessionRead } = await Promise.race([
    readSessionDetailForRoute({
      conversationId: sessionId,
      profile: input.profile,
      tailBlocks: input.tailBlocks,
      signal: input.signal,
    }),
    abortPromise(input.signal),
  ]);
  throwIfAborted(input.signal);

  if (!sessionRead.detail) {
    throw new Error('Session not found');
  }

  const appendOnly = shouldBuildAppendOnlySessionDetail({
    knownSessionSignature: input.knownSessionSignature,
    nextSessionSignature: sessionRead.detail.signature,
  })
    ? buildAppendOnlyConversationDetailResponse({
        detail: sessionRead.detail,
        knownBlockOffset: input.knownBlockOffset,
        knownTotalBlocks: input.knownTotalBlocks,
        knownLastBlockId: input.knownLastBlockId,
      })
    : null;

  throwIfAborted(input.signal);

  if (appendOnly) {
    return inlineConversationSessionDetailAppendOnlyAssetsCapability(sessionId, appendOnly);
  }

  return inlineConversationSessionDetailAssetsCapability(sessionId, sessionRead.detail);
}
