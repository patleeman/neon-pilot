import { describe, expect, it } from 'vitest';

import manifest from '../extension.json';

describe('system-skills manifest', () => {
  it('contributes the Skills page, nav item, and open command', () => {
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({
        id: 'skills-page',
        route: '/skills',
        component: 'SkillsPage',
        location: 'main',
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

  it('keeps Skills management on the page plus the route context rail', () => {
    expect(manifest.contributes.settingsComponent).toBeUndefined();
    expect(manifest.contributes.views).toContainEqual(expect.objectContaining({ id: 'skills-page', route: '/skills', location: 'main' }));
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({ id: 'skills-context-rail', route: '/skills', location: 'rightRail' }),
    );
  });
});
