export interface DesktopConversationModelPreferenceUpdateInput {
  conversationId: string;
  model?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}

export interface NormalizedDesktopConversationModelPreferenceUpdate {
  conversationId: string;
  preferences: {
    model?: string | null;
    thinkingLevel?: string | null;
    serviceTier?: string | null;
  };
}

export function normalizeDesktopConversationModelPreferenceUpdate(
  input: DesktopConversationModelPreferenceUpdateInput,
): NormalizedDesktopConversationModelPreferenceUpdate {
  const conversationId = input.conversationId.trim();
  if (!conversationId) {
    throw new Error('conversationId required');
  }

  const { model, thinkingLevel, serviceTier } = input;
  if (model === undefined && thinkingLevel === undefined && serviceTier === undefined) {
    throw new Error('model, thinkingLevel, or serviceTier required');
  }

  if (
    (model !== undefined && model !== null && typeof model !== 'string') ||
    (thinkingLevel !== undefined && thinkingLevel !== null && typeof thinkingLevel !== 'string') ||
    (serviceTier !== undefined && serviceTier !== null && typeof serviceTier !== 'string')
  ) {
    throw new Error('model, thinkingLevel, and serviceTier must be strings or null');
  }

  return {
    conversationId,
    preferences: {
      ...(model !== undefined ? { model } : {}),
      ...(thinkingLevel !== undefined ? { thinkingLevel } : {}),
      ...(serviceTier !== undefined ? { serviceTier } : {}),
    },
  };
}
