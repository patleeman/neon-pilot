import { describe, expect, it } from 'vitest';

import { formatModelTriggerLabel } from './frontend';

describe('formatModelTriggerLabel', () => {
  it('shows the saved current model while model metadata is still loading', () => {
    expect(formatModelTriggerLabel({ models: [], currentModel: 'gpt-5.4' })).toBe('gpt-5.4');
  });

  it('prefers the model display name once metadata is loaded', () => {
    expect(
      formatModelTriggerLabel({
        currentModel: 'gpt-5.4',
        models: [{ id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4', context: 272000, input: ['text'] }],
      }),
    ).toBe('GPT-5.4');
  });
});
