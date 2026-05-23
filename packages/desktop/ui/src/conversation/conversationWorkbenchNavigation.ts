import { setConversationArtifactIdInSearch } from './conversationArtifacts';
import { setConversationCheckpointIdInSearch } from './conversationCheckpoints';

export function buildOpenArtifactSearch(currentSearch: string, artifactId: string): string {
  return setConversationCheckpointIdInSearch(setConversationArtifactIdInSearch(currentSearch, artifactId), null);
}

export function buildOpenKnowledgeFileSearch(currentSearch: string, fileId: string): string | null {
  const normalizedFileId = fileId.trim();
  if (!normalizedFileId) {
    return null;
  }

  const nextSearch = new URLSearchParams(currentSearch);
  nextSearch.delete('artifact');
  nextSearch.delete('checkpoint');
  nextSearch.delete('run');
  nextSearch.set('file', normalizedFileId);
  return nextSearch.toString();
}
