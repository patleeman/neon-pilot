import { listConversationMetadataNamespaces } from '../extensions/extensionConversationMetadata.js';
import {
  buildAppendOnlyConversationDetailResponse,
  readConversationSessionSignatureWithTelemetry,
  readLiveSession,
  readSessionDetailForRoute,
  toPublicLiveSessionMeta,
} from './conversationService.js';

type ConversationBootstrapRemoteMirrorTelemetry = Awaited<ReturnType<typeof readSessionDetailForRoute>>['remoteMirror'];
type ConversationBootstrapSessionReadTelemetry = Awaited<ReturnType<typeof readSessionDetailForRoute>>['sessionRead']['telemetry'];
type ConversationBootstrapSessionSignatureTelemetry = ReturnType<typeof readConversationSessionSignatureWithTelemetry>['telemetry'];

export interface ReadConversationBootstrapStateInput {
  conversationId: string;
  profile: string;
  tailBlocks?: number;
  knownSessionSignature?: string;
  knownBlockOffset?: number;
  knownTotalBlocks?: number;
  knownLastBlockId?: string;
}

export interface ReadConversationBootstrapStateResult {
  state: {
    conversationId: string;
    sessionDetail: Awaited<ReturnType<typeof readSessionDetailForRoute>>['sessionRead']['detail'];
    sessionDetailSignature?: string | null;
    sessionDetailUnchanged?: boolean;
    sessionDetailAppendOnly?: ReturnType<typeof buildAppendOnlyConversationDetailResponse>;
    liveSession: ({ live: true } & ReturnType<typeof toPublicLiveSessionMeta>) | { live: false };
    extensionMetadataNamespaces?: string[];
    integrityWarning?: boolean;
  };
  telemetry: {
    sessionRead: ConversationBootstrapSessionReadTelemetry;
    sessionDetailReused: boolean;
    remoteMirror: ConversationBootstrapRemoteMirrorTelemetry;
    sessionSignature: ConversationBootstrapSessionSignatureTelemetry | null;
    sessionSignatureMs: number;
    liveSessionLookupMs: number;
  };
}

export function isMissingConversationBootstrapState(state: ReadConversationBootstrapStateResult['state']): boolean {
  return !state.sessionDetail && !state.sessionDetailUnchanged && !state.sessionDetailAppendOnly && !state.liveSession.live;
}

export async function readConversationBootstrapState(
  input: ReadConversationBootstrapStateInput,
): Promise<ReadConversationBootstrapStateResult> {
  const shouldCheckKnownSessionSignature = Boolean(input.knownSessionSignature);
  const sessionSignatureStartedAtMs = performance.now();
  const sessionSignatureResult = shouldCheckKnownSessionSignature
    ? readConversationSessionSignatureWithTelemetry(input.conversationId)
    : null;
  const sessionSignatureMs = performance.now() - sessionSignatureStartedAtMs;
  const earlySessionSignature = sessionSignatureResult?.signature ?? null;
  const sessionDetailReused = Boolean(
    earlySessionSignature && input.knownSessionSignature && input.knownSessionSignature === earlySessionSignature,
  );
  const sessionResult = sessionDetailReused
    ? {
        sessionRead: {
          detail: null,
          telemetry: null,
        },
        remoteMirror: { status: 'deferred' as const, durationMs: 0 },
      }
    : await readSessionDetailForRoute({
        conversationId: input.conversationId,
        profile: input.profile,
        tailBlocks: input.tailBlocks,
      });
  const sessionDetailAppendOnly =
    !sessionDetailReused &&
    input.knownSessionSignature &&
    sessionResult.sessionRead.detail?.signature &&
    input.knownSessionSignature !== sessionResult.sessionRead.detail.signature
      ? buildAppendOnlyConversationDetailResponse({
          detail: sessionResult.sessionRead.detail,
          knownBlockOffset: input.knownBlockOffset,
          knownTotalBlocks: input.knownTotalBlocks,
          knownLastBlockId: input.knownLastBlockId,
        })
      : null;

  const liveSessionLookupStartedAt = performance.now();
  const liveSession = readLiveSession(input.conversationId);
  const liveSessionLookupMs = performance.now() - liveSessionLookupStartedAt;
  const extensionMetadataNamespaces = listConversationMetadataNamespaces({
    conversationId: input.conversationId,
    profile: input.profile,
  });

  return {
    state: {
      conversationId: input.conversationId,
      sessionDetail: sessionDetailAppendOnly ? null : sessionResult.sessionRead.detail,
      sessionDetailSignature: sessionDetailAppendOnly?.signature ?? sessionResult.sessionRead.detail?.signature ?? earlySessionSignature,
      ...(sessionDetailReused ? { sessionDetailUnchanged: true } : {}),
      ...(sessionDetailAppendOnly ? { sessionDetailAppendOnly } : {}),
      ...(sessionResult.sessionRead.telemetry?.modificationDetected ? { integrityWarning: true } : {}),
      ...(extensionMetadataNamespaces.length > 0 ? { extensionMetadataNamespaces } : {}),
      liveSession: liveSession ? { live: true as const, ...toPublicLiveSessionMeta(liveSession) } : { live: false as const },
    },
    telemetry: {
      sessionRead: sessionResult.sessionRead.telemetry,
      sessionDetailReused,
      remoteMirror: sessionResult.remoteMirror,
      sessionSignature: sessionSignatureResult?.telemetry ?? null,
      sessionSignatureMs,
      liveSessionLookupMs,
    },
  };
}
