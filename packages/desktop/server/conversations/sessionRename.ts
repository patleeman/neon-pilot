import { buildSessionInfoRecord, normalizeSessionName } from './sessionNaming.js';

export function resolveStoredSessionRename(name: string): { normalizedName: string; sessionInfoLine: string } {
  const normalizedName = normalizeSessionName(name);
  if (!normalizedName) {
    throw new Error('Conversation title must not be empty.');
  }

  return { normalizedName, sessionInfoLine: `${buildSessionInfoRecord(normalizedName)}\n` };
}

export function buildMissingSessionRenameError(sessionId: string): Error {
  return new Error(`Conversation ${sessionId} not found.`);
}

export function buildReloadSessionAfterRenameError(sessionId: string): Error {
  return new Error(`Conversation ${sessionId} could not be reloaded after renaming.`);
}
