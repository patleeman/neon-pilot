import { describe, expect, it } from 'vitest';

import manifest from '../extension.json';

describe('system-skill-search manifest', () => {
  it('registers browseSkills for UI marketplace browsing and CLI use', () => {
    expect(manifest.backend.actions).toContainEqual(
      expect.objectContaining({
        id: 'browseSkills',
        handler: 'browseSkills',
      }),
    );
    expect(manifest.contributes.tools).toContainEqual(
      expect.objectContaining({
        id: 'skill-browse',
        name: 'skill_browse',
        action: 'browseSkills',
      }),
    );
    expect(manifest.contributes.cliCommands).toContainEqual(
      expect.objectContaining({
        id: 'skills-browse-upstream',
        command: 'skills browse',
        action: 'skillSearchCli',
        inputAction: 'browse',
      }),
    );
  });
});
