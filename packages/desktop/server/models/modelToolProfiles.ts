export const MODEL_TOOL_PROFILE_IDS = ['structured-default', 'codex-compatible', 'no-tools'] as const;

export type ModelToolProfileId = (typeof MODEL_TOOL_PROFILE_IDS)[number];

const TOOL_PROFILE_TOOL_NAMES: Record<ModelToolProfileId, string[] | undefined> = {
  'structured-default': undefined,
  'codex-compatible': ['bash', 'apply_patch'],
  'no-tools': [],
};

export function readModelToolProfileId(value: unknown): ModelToolProfileId | undefined {
  return typeof value === 'string' && MODEL_TOOL_PROFILE_IDS.includes(value as ModelToolProfileId)
    ? (value as ModelToolProfileId)
    : undefined;
}

export function defaultToolProfileForProvider(provider: string | undefined): ModelToolProfileId | undefined {
  return provider === 'openai-codex' ? 'codex-compatible' : undefined;
}

export function toolNamesForModelToolProfile(profileId: ModelToolProfileId | undefined): string[] | undefined {
  if (!profileId) return undefined;
  const tools = TOOL_PROFILE_TOOL_NAMES[profileId];
  return tools ? [...tools] : undefined;
}
