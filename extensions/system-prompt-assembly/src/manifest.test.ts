import { describe, expect, it } from 'vitest';

import manifest from '../extension.json';

describe('system-prompt-assembly manifest', () => {
  it('keeps Settings focused on non-skill prompt diagnostics', () => {
    expect(manifest.contributes.settingsComponent).toMatchObject({
      id: 'prompt-assembly',
      sectionId: 'settings-prompt-assembly',
    });
    expect(manifest.contributes.settingsComponent?.description.toLowerCase()).not.toContain('skill');
  });
});
