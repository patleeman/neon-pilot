import { describe, expect, it } from 'vitest';

import {
  getModelSelectableServiceTierOptions,
  getModelSelectionValue,
  groupModelsByProvider,
  hasSelectableModelId,
  resolveSelectableModel,
  resolveSelectableModelId,
  THINKING_LEVEL_OPTIONS,
} from './modelPreferences';

describe('model preferences helpers', () => {
  it('exports the supported thinking levels in UI order', () => {
    expect(THINKING_LEVEL_OPTIONS.map((option) => option.value)).toEqual(['', 'off', 'low', 'medium', 'high', 'xhigh']);
  });

  it('builds service tier options in UI order from the tiers supported by the selected model', () => {
    expect(
      getModelSelectableServiceTierOptions(
        { supportedServiceTiers: ['scale', 'priority', 'auto', 'default', 'flex'] },
        { includeDefaultOption: true },
      ),
    ).toEqual([
      { value: '', label: 'Default' },
      { value: 'auto', label: 'Auto' },
      { value: 'default', label: 'Default' },
      { value: 'flex', label: 'Flex' },
      { value: 'priority', label: 'Priority' },
      { value: 'scale', label: 'Scale' },
    ]);
    expect(getModelSelectableServiceTierOptions({ supportedServiceTiers: [] })).toEqual([]);
    expect(getModelSelectableServiceTierOptions(null)).toEqual([]);
  });

  it('builds selectable service tier options with an unset or default choice', () => {
    expect(getModelSelectableServiceTierOptions({ supportedServiceTiers: ['priority', 'auto'] })).toEqual([
      { value: '', label: 'Unset' },
      { value: 'auto', label: 'Auto' },
      { value: 'priority', label: 'Priority' },
    ]);
    expect(getModelSelectableServiceTierOptions({ supportedServiceTiers: ['priority', 'auto'] }, { includeDefaultOption: true })).toEqual([
      { value: '', label: 'Default' },
      { value: 'auto', label: 'Auto' },
      { value: 'priority', label: 'Priority' },
    ]);
  });

  it('detects whether a model id is currently selectable', () => {
    const models = [
      { id: 'gpt-5.2', provider: 'openai', name: 'GPT-5.2', context: 272_000 },
      { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', context: 200_000 },
    ];

    expect(hasSelectableModelId(models, 'gpt-5.2')).toBe(true);
    expect(hasSelectableModelId(models, ' gpt-5.2 ')).toBe(true);
    expect(hasSelectableModelId(models, 'gpt-5.4')).toBe(false);
    expect(hasSelectableModelId(models, '')).toBe(false);
  });

  it('resolves stale requested model ids to the best available fallback', () => {
    const models = [
      { id: 'gpt-5.2', provider: 'openai', name: 'GPT-5.2', context: 272_000 },
      { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', context: 200_000 },
    ];

    expect(resolveSelectableModelId({ requestedModel: 'gpt-5.2', defaultModel: 'claude-sonnet-4-6', models })).toBe('gpt-5.2');
    expect(resolveSelectableModelId({ requestedModel: 'gpt-5.4', defaultModel: 'claude-sonnet-4-6', models })).toBe('claude-sonnet-4-6');
    expect(resolveSelectableModelId({ requestedModel: 'gpt-5.4', defaultModel: 'missing', models })).toBe('gpt-5.2');
    expect(resolveSelectableModelId({ requestedModel: 'gpt-5.4', defaultModel: 'missing', models: [] })).toBe('');
  });

  it('groups models by provider while preserving original order', () => {
    expect(
      groupModelsByProvider([
        { id: 'gpt-5.4', provider: 'openai', name: 'GPT-5.4', context: 272_000 },
        { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', context: 200_000 },
        { id: 'gpt-5.5-mini', provider: 'openai', name: 'GPT-5.5 Mini', context: 128_000 },
      ]),
    ).toEqual([
      [
        'openai',
        [
          { id: 'gpt-5.4', provider: 'openai', name: 'GPT-5.4', context: 272_000 },
          { id: 'gpt-5.5-mini', provider: 'openai', name: 'GPT-5.5 Mini', context: 128_000 },
        ],
      ],
      ['anthropic', [{ id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', context: 200_000 }]],
    ]);
  });

  it('uses provider-qualified values only for duplicate model ids', () => {
    const models = [
      { id: 'deepseek-v4-flash', provider: 'opencode-go', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-flash', provider: 'ds4', name: 'DeepSeek V4 Flash (ds4.c local)' },
      { id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4' },
    ];

    expect(getModelSelectionValue(models[0]!, models)).toBe('opencode-go/deepseek-v4-flash');
    expect(getModelSelectionValue(models[1]!, models)).toBe('ds4/deepseek-v4-flash');
    expect(getModelSelectionValue(models[2]!, models)).toBe('gpt-5.4');
  });

  it('resolves raw ids and provider-qualified model refs', () => {
    const models = [
      { id: 'deepseek-v4-flash', provider: 'opencode-go', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-flash', provider: 'ds4', name: 'DeepSeek V4 Flash (ds4.c local)' },
      { id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4' },
    ];

    expect(resolveSelectableModel(models, 'ds4/deepseek-v4-flash')).toBe(models[1]);
    expect(resolveSelectableModel(models, 'gpt-5.4')).toBe(models[2]);
    expect(hasSelectableModelId(models, 'opencode-go/deepseek-v4-flash')).toBe(true);
    expect(hasSelectableModelId(models, 'missing')).toBe(false);
    expect(resolveSelectableModelId({ requestedModel: 'ds4/deepseek-v4-flash', defaultModel: 'gpt-5.4', models })).toBe(
      'ds4/deepseek-v4-flash',
    );
    expect(resolveSelectableModelId({ requestedModel: 'missing', defaultModel: 'gpt-5.4', models })).toBe('gpt-5.4');
  });
});
