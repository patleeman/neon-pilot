import { describe, expect, it } from 'vitest';

import manifest from '../extension.json';

describe('system-skill-search manifest', () => {
  it('registers browseSkills for agent-internal inventory browsing and CLI use', () => {
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

  it('does not expose a duplicate Settings UI for skill browsing or management', () => {
    expect(manifest.contributes.settingsComponent).toBeUndefined();
    expect(manifest.contributes.commands ?? []).not.toContainEqual(
      expect.objectContaining({
        args: expect.objectContaining({ to: expect.stringContaining('/settings#settings-skill') }),
      }),
    );
  });
});
