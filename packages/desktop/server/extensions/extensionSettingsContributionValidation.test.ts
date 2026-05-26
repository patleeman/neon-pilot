import { describe, expect, it } from 'vitest';

import {
  validateSecretContributions,
  validateSettingsComponentContribution,
  validateSettingsContributions,
} from './extensionSettingsContributionValidation';

describe('extensionSettingsContributionValidation', () => {
  it('validates settings contribution groups', () => {
    expect(
      validateSettingsComponentContribution({ id: 'settings', component: 'Settings', sectionId: 'general', label: 'Settings', order: 1 }),
    ).toBeUndefined();
    expect(validateSettingsContributions({ enabled: { type: 'boolean', enum: ['yes'], control: 'toggle' } })).toBeUndefined();
    expect(validateSecretContributions({ token: { label: 'Token', order: 1 } })).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateSettingsComponentContribution(null)).toThrow(
      'Extension manifest contributes.settingsComponent must be an object.',
    );
    expect(() =>
      validateSettingsComponentContribution({ id: 'settings', component: 'Settings', sectionId: 'general', label: 'Settings', order: 1.5 }),
    ).toThrow('Extension manifest contributes.settingsComponent.order must be an integer.');
    expect(() => validateSettingsContributions({ mode: { type: 'bad' } })).toThrow(
      'Extension manifest contributes.settings.mode.type must be one of: string, boolean, number, select.',
    );
    expect(() => validateSettingsContributions({ mode: { enum: 'bad' } })).toThrow(
      'Extension manifest contributes.settings.mode.enum must be an array.',
    );
    expect(() => validateSettingsContributions({ mode: { control: 12 } })).toThrow(
      'Extension manifest contributes.settings.mode.control must be a string.',
    );
    expect(() => validateSecretContributions({ token: { label: 'Token', order: 1.5 } })).toThrow(
      'Extension manifest contributes.secrets.token.order must be an integer.',
    );
  });
});
