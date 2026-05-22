import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { skills } from './skills.js';

describe('alleycat protocol skills', () => {
  const root = join(tmpdir(), `alleycat-skills-${process.pid}`);

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists Neon Pilot and Pi project skills with short descriptions', async () => {
    const neonSkill = join(root, '.neon-pilot', 'skills', 'review');
    const piSkill = join(root, '.pi', 'skills', 'ship');
    mkdirSync(neonSkill, { recursive: true });
    mkdirSync(piSkill, { recursive: true });
    writeFileSync(join(neonSkill, 'SKILL.md'), '# Review\nInspect diffs carefully.\nMore text');
    writeFileSync(join(piSkill, 'SKILL.md'), '# Ship\n\nShip release candidates.');
    mkdirSync(join(root, '.pi', 'skills', 'missing-file'), { recursive: true });

    await expect(skills.list({ cwd: root }, undefined as never, undefined as never, undefined as never)).resolves.toEqual({
      data: [
        { name: 'review', path: join(neonSkill, 'SKILL.md'), description: 'Inspect diffs carefully.' },
        { name: 'ship', path: join(piSkill, 'SKILL.md'), description: 'Ship release candidates.' },
      ],
    });
  });

  it('returns an empty list when no project skill directories exist', async () => {
    mkdirSync(root, { recursive: true });
    await expect(skills.list({ cwd: root }, undefined as never, undefined as never, undefined as never)).resolves.toEqual({ data: [] });
  });
});
