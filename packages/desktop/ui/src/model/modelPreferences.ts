import type { ModelInfo } from '../shared/types';

function normalizeModelId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const THINKING_LEVEL_OPTIONS = [
  { value: '', label: 'Unset' },
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
] as const;

const SERVICE_TIER_OPTIONS = [
  { value: '', label: 'Unset' },
  { value: 'auto', label: 'Auto' },
  { value: 'default', label: 'Default' },
  { value: 'flex', label: 'Flex' },
  { value: 'priority', label: 'Priority' },
  { value: 'scale', label: 'Scale' },
] as const;

function getModelSupportedServiceTierOptions(model: Pick<ModelInfo, 'supportedServiceTiers'> | null | undefined) {
  const supportedTiers = Array.isArray(model?.supportedServiceTiers) ? model.supportedServiceTiers : [];
  if (supportedTiers.length === 0) {
    return [];
  }

  return SERVICE_TIER_OPTIONS.filter((option) => option.value.length > 0 && supportedTiers.includes(option.value));
}

export function getModelSelectableServiceTierOptions(
  model: Pick<ModelInfo, 'supportedServiceTiers'> | null | undefined,
  options?: {
    includeDefaultOption?: boolean;
    defaultLabel?: string;
  },
) {
  const supportedOptions = getModelSupportedServiceTierOptions(model);
  if (supportedOptions.length === 0) {
    return [];
  }

  return [{ value: '', label: options?.includeDefaultOption ? (options.defaultLabel ?? 'Default') : 'Unset' }, ...supportedOptions];
}

export function hasSelectableModelId<T extends Pick<ModelInfo, 'id'>>(models: readonly T[], modelId: string | null | undefined): boolean {
  return resolveSelectableModel(models, modelId) !== null;
}

export function resolveSelectableModelId<T extends Pick<ModelInfo, 'id'>>(input: {
  requestedModel?: string | null;
  defaultModel?: string | null;
  models: readonly T[];
}): string {
  const requestedModel = resolveSelectableModel(input.models, input.requestedModel);
  if (requestedModel) {
    return getModelSelectionValue(requestedModel, input.models);
  }

  const defaultModel = resolveSelectableModel(input.models, input.defaultModel);
  if (defaultModel) {
    return getModelSelectionValue(defaultModel, input.models);
  }

  return input.models[0] ? getModelSelectionValue(input.models[0], input.models) : '';
}

export function groupModelsByProvider<T extends Pick<ModelInfo, 'provider'>>(models: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();

  for (const model of models) {
    const current = groups.get(model.provider) ?? [];
    current.push(model);
    groups.set(model.provider, current);
  }

  return [...groups.entries()];
}

export function modelIdHasMultipleProviders<T extends Pick<ModelInfo, 'id'>>(models: readonly T[], modelId: string): boolean {
  return models.filter((model) => model.id === modelId).length > 1;
}

export function getModelSelectionValue<T extends Pick<ModelInfo, 'id'> & Partial<Pick<ModelInfo, 'provider'>>>(
  model: T,
  models: readonly T[],
): string {
  if (model.provider && modelIdHasMultipleProviders(models, model.id)) {
    return `${model.provider}/${model.id}`;
  }
  return model.id;
}

export function resolveSelectableModel<T extends Pick<ModelInfo, 'id'> & Partial<Pick<ModelInfo, 'provider'>>>(
  models: readonly T[],
  modelId: string | null | undefined,
): T | null {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) {
    return null;
  }

  const exactMatch = models.find((model) => model.id === normalizedModelId);
  if (exactMatch) {
    return exactMatch;
  }

  const slashIndex = normalizedModelId.indexOf('/');
  if (slashIndex > 0 && slashIndex < normalizedModelId.length - 1) {
    const provider = normalizedModelId.slice(0, slashIndex);
    const id = normalizedModelId.slice(slashIndex + 1);
    return models.find((model) => model.provider === provider && model.id === id) ?? null;
  }

  return null;
}
