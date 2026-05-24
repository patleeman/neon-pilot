import type { SessionDetail, SessionMeta } from './conversationTypes.js';
import {
  appendChildConversationTopologyEntry as appendSessionChildConversationTopologyEntry,
  appendConversationOffshootMetadata as appendSessionConversationOffshootMetadata,
  appendConversationWorkspaceMetadata as appendSessionConversationWorkspaceMetadata,
  appendParentConversationBacklinkEntry as appendSessionParentConversationBacklinkEntry,
  clearSessionCaches,
  listSessions,
  readSessionBlocksByFile,
  readSessionMetaByFile,
  readSessionSearchText,
} from './sessions.js';

export function readConversationSessionMetaByFilePath(filePath: string) {
  return readSessionMetaByFile(filePath);
}

export function readTranscriptBackedConversationDetailByFile(filePath: string, options?: { tailBlocks?: number }): SessionDetail | null {
  return readSessionBlocksByFile(filePath, options);
}

export function listTranscriptBackedConversationSessions(): SessionMeta[] {
  return listSessions();
}

export function readTranscriptBackedConversationSearchText(conversationId: string, maxCharacters?: number): string | null {
  return typeof maxCharacters === 'number' ? readSessionSearchText(conversationId, maxCharacters) : readSessionSearchText(conversationId);
}

export function clearTranscriptBackedConversationCaches(): void {
  clearSessionCaches();
}

export function appendConversationWorkspaceMetadata(input: Parameters<typeof appendSessionConversationWorkspaceMetadata>[0]): void {
  appendSessionConversationWorkspaceMetadata(input);
}

export function appendConversationOffshootMetadata(input: Parameters<typeof appendSessionConversationOffshootMetadata>[0]): void {
  appendSessionConversationOffshootMetadata(input);
}

export function appendParentConversationBacklinkEntry(input: Parameters<typeof appendSessionParentConversationBacklinkEntry>[0]): void {
  appendSessionParentConversationBacklinkEntry(input);
}

export function appendChildConversationTopologyEntry(input: Parameters<typeof appendSessionChildConversationTopologyEntry>[0]): void {
  appendSessionChildConversationTopologyEntry(input);
}
