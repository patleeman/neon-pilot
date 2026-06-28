import { readSessionConversationId } from '@neon-pilot/core';

import type { ScannedDurableRun } from './store.js';

export interface BackgroundRunCallbackOwner {
  conversationId?: string;
  sessionFile?: string;
  profile?: string;
  repoRoot?: string;
}

export interface BackgroundRunCallbackSource {
  type?: string;
  id?: string;
  filePath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readMetadata(run: ScannedDurableRun): Record<string, unknown> | undefined {
  const spec = isRecord(run.manifest?.spec) ? run.manifest.spec : undefined;
  const manifestMetadata = isRecord(spec?.metadata) ? spec.metadata : undefined;
  if (manifestMetadata) {
    return manifestMetadata;
  }

  const payload = isRecord(run.checkpoint?.payload) ? run.checkpoint.payload : undefined;
  return isRecord(payload?.metadata) ? payload.metadata : undefined;
}

export function readBackgroundRunCallbackOwner(run: ScannedDurableRun): BackgroundRunCallbackOwner | undefined {
  const metadata = readMetadata(run);
  const raw = isRecord(metadata?.callbackConversation) ? metadata.callbackConversation : undefined;
  if (!raw) {
    return undefined;
  }

  return {
    ...(readOptionalString(raw.conversationId) ? { conversationId: readOptionalString(raw.conversationId) } : {}),
    ...(readOptionalString(raw.sessionFile) ? { sessionFile: readOptionalString(raw.sessionFile) } : {}),
    ...(readOptionalString(raw.profile) ? { profile: readOptionalString(raw.profile) } : {}),
    ...(readOptionalString(raw.repoRoot) ? { repoRoot: readOptionalString(raw.repoRoot) } : {}),
  };
}

export function findBackgroundRunCallbackOwnerMismatch(input: {
  source?: BackgroundRunCallbackSource;
  owner?: BackgroundRunCallbackOwner;
}): string | undefined {
  const owner = input.owner;
  if (!owner) {
    return undefined;
  }

  const sourceFile = readOptionalString(input.source?.filePath);
  if (sourceFile && owner.sessionFile && sourceFile !== owner.sessionFile) {
    return 'source file does not match callback session file';
  }

  const sourceId = readOptionalString(input.source?.id);
  if (input.source?.type === 'tool' && sourceId && owner.conversationId && sourceId !== owner.conversationId) {
    return 'tool source id does not match callback conversation id';
  }

  if (owner.sessionFile && owner.conversationId) {
    const sessionConversationId = readSessionConversationId(owner.sessionFile);
    if (sessionConversationId && sessionConversationId !== owner.conversationId) {
      return 'session file owner does not match callback conversation id';
    }
  }

  return undefined;
}

export function isBackgroundRunCallbackOwnerConsistent(run: ScannedDurableRun): boolean {
  const owner = readBackgroundRunCallbackOwner(run);
  return !findBackgroundRunCallbackOwnerMismatch({ source: run.manifest?.source, owner });
}
