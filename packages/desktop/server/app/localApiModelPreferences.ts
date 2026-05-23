export interface DesktopModelPreferenceUpdateInput {
  model?: string | null;
  visionModel?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}

export function validateDesktopModelPreferenceUpdate(input: DesktopModelPreferenceUpdateInput): void {
  if (
    typeof input.model !== 'string' &&
    typeof input.visionModel !== 'string' &&
    typeof input.thinkingLevel !== 'string' &&
    typeof input.serviceTier !== 'string'
  ) {
    throw new Error('model, visionModel, thinkingLevel, or serviceTier required');
  }
}
