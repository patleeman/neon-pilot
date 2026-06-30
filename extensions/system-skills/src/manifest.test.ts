import { describe, expect, it } from 'vitest';

import manifest from '../extension.json';

describe('system-skills manifest', () => {
  it('contributes the Skills page, nav item, and open command', () => {
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({
        id: 'skills-page',
        route: '/skills',
        component: 'SkillsPage',
        placement: 'primary',
      }),
    );
    expect(manifest.contributes.nav).toContainEqual(
      expect.objectContaining({
        id: 'skills-nav',
        label: 'Skills',
        route: '/skills',
        section: 'settings',
      }),
    );
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({
        id: 'skills.open',
        action: 'app.navigate',
        args: { to: '/skills' },
      }),
    );
  });

  it('is the only user-facing Skills management surface for this extension', () => {
    expect(manifest.contributes.settingsComponent).toBeUndefined();
    expect(manifest.contributes.views).toHaveLength(1);
    expect(manifest.contributes.views?.[0]?.route).toBe('/skills');
  });
});
