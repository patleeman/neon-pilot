export function buildDesktopMutationOkResponse(): { ok: true } {
  return { ok: true };
}

export function buildSavedModelPreferencePatch(input: {
  model?: string | null;
  visionModel?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}): {
  model?: string | null;
  visionModel?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
} {
  return {
    model: input.model,
    visionModel: input.visionModel,
    thinkingLevel: input.thinkingLevel,
    serviceTier: input.serviceTier,
  };
}
