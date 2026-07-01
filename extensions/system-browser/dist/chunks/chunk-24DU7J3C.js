// packages/desktop/ui/src/conversation/conversationArtifacts.ts
var CONVERSATION_ARTIFACT_QUERY_PARAM = "artifact";
function getConversationArtifactIdFromSearch(search) {
  const value = new URLSearchParams(search).get(CONVERSATION_ARTIFACT_QUERY_PARAM)?.trim();
  return value ? value : null;
}
function setConversationArtifactIdInSearch(search, artifactId) {
  const params = new URLSearchParams(search);
  if (artifactId?.trim()) {
    params.set(CONVERSATION_ARTIFACT_QUERY_PARAM, artifactId.trim());
  } else {
    params.delete(CONVERSATION_ARTIFACT_QUERY_PARAM);
  }
  const next = params.toString();
  return next.length > 0 ? `?${next}` : "";
}

export {
  getConversationArtifactIdFromSearch,
  setConversationArtifactIdInSearch
};
