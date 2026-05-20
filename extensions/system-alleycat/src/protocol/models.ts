import type { MethodHandler } from '../codexJsonRpcServer.js';

const DEFAULT_MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5' },
  { id: 'gpt-5.4', name: 'GPT-5.4' },
  { id: 'gpt-5.3', name: 'GPT-5.3' },
];

const VALID_REASONING = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function normalizeReasoning(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace('-', '');
  if (normalized === 'x-high' || normalized === 'x_high') return 'xhigh';
  return VALID_REASONING.has(normalized) ? normalized : null;
}

function reasoningOptions(values: string[]) {
  const normalized = values.map(normalizeReasoning).filter((item): item is string => Boolean(item));
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique.map((reasoningEffort) => ({ reasoningEffort, description: reasoningEffort })) : [];
}

function toCodexModel(model: Record<string, unknown>, index: number) {
  const id = String(model.id ?? model.model ?? 'neon-pilot');
  const displayName = String(model.name ?? model.displayName ?? id);
  const reasoningEfforts = reasoningOptions(stringArray(model.supportedReasoningEfforts ?? model.reasoningEfforts ?? model.thinkingLevels));
  const explicitDefault = typeof model.defaultReasoningEffort === 'string' ? normalizeReasoning(model.defaultReasoningEffort) : null;
  const defaultReasoning = explicitDefault ?? reasoningEfforts[0]?.reasoningEffort ?? 'none';

  return {
    id,
    model: id,
    upgrade: null,
    upgradeInfo: null,
    availabilityNux: null,
    displayName,
    description: String(model.description ?? displayName),
    hidden: false,
    // Kitty/Codex expects objects here, not raw strings.
    supportedReasoningEfforts: reasoningEfforts,
    defaultReasoningEffort: defaultReasoning,
    inputModalities: Array.isArray(model.input) ? model.input : ['text'],
    supportsPersonality: false,
    additionalSpeedTiers: [],
    serviceTiers: [],
    isDefault: index === 0,
  };
}

export const models = {
  /**
   * `model/list` — list available models.
   */
  list: (async (_params, ctx) => {
    try {
      const allModels = await ctx.models.list();
      const source = Array.isArray(allModels) && allModels.length > 0 ? allModels : DEFAULT_MODELS;
      const data = source.map((model, index) => toCodexModel(model as Record<string, unknown>, index));
      return { data, nextCursor: null };
    } catch {
      return { data: [], nextCursor: null };
    }
  }) as MethodHandler,
};
