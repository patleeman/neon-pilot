import {
  appendChildConversationTopologyEntry as appendSessionChildConversationTopologyEntry,
  appendConversationOffshootMetadata as appendSessionConversationOffshootMetadata,
  appendConversationWorkspaceMetadata as appendSessionConversationWorkspaceMetadata,
  appendParentConversationBacklinkEntry as appendSessionParentConversationBacklinkEntry,
  readSessionMetaByFile,
} from './sessions.js';

export function readConversationSessionMetaByFilePath(filePath: string) {
  return readSessionMetaByFile(filePath);
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
