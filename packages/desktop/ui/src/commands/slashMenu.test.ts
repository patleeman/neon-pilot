import { describe, expect, it } from 'vitest';

import type { MemorySkillItem } from '../shared/types';
import { buildSlashMenuItems, parseSlashInput } from './slashMenu';

const SKILLS: MemorySkillItem[] = [
  {
    source: 'shared',
    name: 'react',
    description: 'React and Next.js performance optimization guidelines.',
    path: '/tmp/react/INDEX.md',
  },
  {
    source: 'shared',
    name: 'frontend-design',
    description: 'Create distinctive, production-grade frontend interfaces.',
    path: '/tmp/frontend/INDEX.md',
  },
];

describe('parseSlashInput', () => {
  it('splits slash commands from their argument text', () => {
    expect(parseSlashInput('/model gpt-5.4')).toEqual({ command: '/model', argument: 'gpt-5.4' });
    expect(parseSlashInput('/model ')).toEqual({ command: '/model', argument: '' });
  });
});

describe('buildSlashMenuItems', () => {
  it('shows every built-in conversation command in the default slash menu', () => {
    const items = buildSlashMenuItems('/', SKILLS);
    expect(items.filter((item) => item.kind === 'command').map((item) => item.displayCmd)).toEqual([
      '/compact',
      '/copy',
      '/export',
      '/name',
      '/run',
      '/search',
      '/summarize',
      '/think',
    ]);
    expect(items.filter((item) => item.kind === 'command')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayCmd: '/compact', insertText: '/compact ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/copy', insertText: '/copy ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/export', insertText: '/export ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/name', insertText: '/name ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/run', insertText: '/run ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/search', insertText: '/search ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/summarize', insertText: '/summarize ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/think', insertText: '/think ', kind: 'command' }),
      ]),
    );
  });

  it('fuzzy-finds built-in conversation commands', () => {
    const items = buildSlashMenuItems('/comp', SKILLS);
    expect(items[0]).toEqual(expect.objectContaining({ displayCmd: '/compact', kind: 'command' }));

    expect(buildSlashMenuItems('/nam', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/name', kind: 'command' }));
    expect(buildSlashMenuItems('/run', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/run', kind: 'command' }));
    expect(buildSlashMenuItems('/sear', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/search', kind: 'command' }));
    expect(buildSlashMenuItems('/summ', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/summarize', kind: 'command' }));
    expect(buildSlashMenuItems('/thi', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/think', kind: 'command' }));
  });

  it('fuzzy-finds extension slash commands for a matching query', () => {
    const items = buildSlashMenuItems('/tas', SKILLS, [
      {
        extensionId: 'agent-board',
        surfaceId: 'task',
        packageType: 'user',
        name: 'task',
        description: 'Create a board task',
        action: 'createTask',
      },
    ]);

    expect(items).toContainEqual(
      expect.objectContaining({
        key: 'extension:agent-board:task',
        displayCmd: '/task',
        kind: 'extensionSlashCommand',
      }),
    );
  });

  it('returns skill entries when the query targets skills', () => {
    const items = buildSlashMenuItems('/ski', SKILLS);
    expect(items.map((item) => item.displayCmd)).toEqual(['/skill:frontend-design', '/skill:react']);
    expect(items.every((item) => item.kind === 'skill')).toBe(true);
  });

  it('fuzzy-filters skills by name after /skill:', () => {
    const items = buildSlashMenuItems('/skill:rea', SKILLS);
    expect(items[0]?.displayCmd).toBe('/skill:react');
  });

  it('fuzzy-finds skills without requiring the /skill: prefix', () => {
    const items = buildSlashMenuItems('/reac', SKILLS);
    expect(items[0]?.displayCmd).toBe('/skill:react');
  });

  it('does not flood the default slash menu with every skill when only / is typed', () => {
    const items = buildSlashMenuItems('/', SKILLS);
    expect(items.some((item) => item.kind === 'skill')).toBe(false);
  });

  it('shows the full skill list when the slash query targets skills directly', () => {
    const items = buildSlashMenuItems('/skills', SKILLS);
    expect(items.map((item) => item.displayCmd)).toEqual(['/skill:frontend-design', '/skill:react']);
    expect(items.every((item) => item.kind === 'skill')).toBe(true);
  });

  it('includes matching extension slash commands alongside skills', () => {
    const items = buildSlashMenuItems('/pag', [
      ...SKILLS,
      {
        source: 'shared',
        name: 'project-planning',
        description: 'Structure milestones, scope, and delivery plans for a project.',
        path: '/tmp/project/INDEX.md',
      },
    ]);

    expect(items.some((item) => item.displayCmd === '/skill:project-planning')).toBe(true);
  });

  it('includes matching extension slash commands', () => {
    const items = buildSlashMenuItems('/tas', SKILLS, [
      {
        extensionId: 'system-agent-board',
        surfaceId: 'task',
        packageType: 'user',
        name: 'task',
        description: 'Create a board task',
        action: 'createTask',
      },
    ]);

    expect(items).toContainEqual(
      expect.objectContaining({
        key: 'extension:system-agent-board:task',
        displayCmd: '/task',
        insertText: '/task ',
        desc: 'Create a board task',
        source: 'Agent Board extension',
        kind: 'extensionSlashCommand',
        action: 'createTask',
      }),
    );
  });

  it('keeps raw extension ids out of visible extension slash command metadata', () => {
    const items = buildSlashMenuItems('/vis', SKILLS, [
      {
        extensionId: 'system-artifacts',
        surfaceId: 'visualize',
        packageType: 'system',
        name: 'visualize',
        description: 'Create a typed visual explainer artifact.',
        action: 'handleArtifactSlashCommand',
      },
    ]);

    expect(items).toContainEqual(
      expect.objectContaining({
        displayCmd: '/visualize',
        source: 'Artifacts extension',
      }),
    );
    expect(items.find((item) => item.displayCmd === '/visualize')?.source).not.toContain('system-artifacts');
  });
});
