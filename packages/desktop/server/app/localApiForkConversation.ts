export function resolveForkConversationCwd(input: { requestedCwd?: string | null; sourceCwd: string }): string {
  return input.requestedCwd?.trim() || input.sourceCwd;
}

export function buildForkConversationInitialOptions(input: {
  model?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}): { initialModel?: string | null; initialThinkingLevel?: string | null; initialServiceTier?: string | null } {
  return {
    ...(input.model !== undefined ? { initialModel: input.model } : {}),
    ...(input.thinkingLevel !== undefined ? { initialThinkingLevel: input.thinkingLevel } : {}),
    ...(input.serviceTier !== undefined ? { initialServiceTier: input.serviceTier } : {}),
  };
}
