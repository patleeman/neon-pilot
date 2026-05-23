import { describe, expect, it } from 'vitest';

import {
  validateModelProfileContributions,
  validateSkillContributions,
  validateToolContributions,
} from './extensionCoreContributionValidation';

describe('extensionCoreContributionValidation', () => {
  it('validates skill, tool, and model profile contributions', () => {
    expect(validateSkillContributions(['skills/example/SKILL.md', { id: 'skill', path: 'skill/SKILL.md' }])).toBeUndefined();
    expect(
      validateToolContributions([
        { id: 'tool', description: 'Tool', when: { providers: ['openai'], models: ['gpt'] }, promptGuidelines: ['Use it'] },
      ]),
    ).toBeUndefined();
    expect(validateModelProfileContributions([{ id: 'profile', match: ['gpt-*'], priority: 1 }])).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateSkillContributions([{}])).toThrow('Extension manifest contributes.skills[0].id must be a non-empty string.');
    expect(() => validateSkillContributions([1])).toThrow('Extension manifest contributes.skills[0] must be a string or object.');
    expect(() => validateToolContributions([{ id: 'tool', description: 'Tool', when: 'bad' }])).toThrow(
      'Extension manifest contributes.tools[0].when must be an object.',
    );
    expect(() => validateToolContributions([{ id: 'tool', description: 'Tool', promptGuidelines: [1] }])).toThrow(
      'Extension manifest contributes.tools[0].promptGuidelines must be an array of non-empty strings.',
    );
    expect(() => validateModelProfileContributions([{ id: 'profile', match: ['gpt-*'], priority: 'high' }])).toThrow(
      'Extension manifest contributes.modelProfiles[0].priority must be a number.',
    );
  });
});
