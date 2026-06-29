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
    expect(items.filter((item) => item.kind === 'command')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayCmd: '/status', insertText: '/status ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/queue', insertText: '/queue ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/deferred_resume', insertText: '/deferred_resume ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/model', insertText: '/model ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/thinking_level', insertText: '/thinking_level ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/compact', insertText: '/compact ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/copy', insertText: '/copy ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/export', insertText: '/export ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/rename', insertText: '/rename ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/search', insertText: '/search ', kind: 'command' }),
        expect.objectContaining({ displayCmd: '/summarize', insertText: '/summarize ', kind: 'command' }),
      ]),
    );
  });

  it('fuzzy-finds built-in conversation commands', () => {
    const items = buildSlashMenuItems('/comp', SKILLS);
    expect(items[0]).toEqual(expect.objectContaining({ displayCmd: '/compact', kind: 'command' }));

    expect(buildSlashMenuItems('/ren', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/rename', kind: 'command' }));
    expect(buildSlashMenuItems('/sear', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/search', kind: 'command' }));
    expect(buildSlashMenuItems('/summ', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/summarize', kind: 'command' }));
    expect(buildSlashMenuItems('/thi', SKILLS)[0]).toEqual(expect.objectContaining({ displayCmd: '/thinking_level', kind: 'command' }));
  });

  it('suggests subcommands and enum values at nested slash command positions', () => {
    expect(buildSlashMenuItems('/queue ', SKILLS).map((item) => item.displayCmd)).toEqual(['/queue clear', '/queue restore']);
    expect(buildSlashMenuItems('/background_command ', SKILLS).map((item) => item.displayCmd)).toEqual([
      '/background_command cancel',
      '/background_command list',
      '/background_command logs',
      '/background_command rerun',
      '/background_command start',
    ]);
    expect(buildSlashMenuItems('/deferred_resume c', SKILLS)[0]).toEqual(
      expect.objectContaining({ displayCmd: '/deferred_resume cancel', insertText: '/deferred_resume cancel ' }),
    );
    expect(buildSlashMenuItems('/thinking_level set h', SKILLS).map((item) => item.displayCmd)).toEqual(['high', 'xhigh']);
  });

  it('suggests dynamic ids for nested slash command arguments', () => {
    expect(
      buildSlashMenuItems('/background_command logs run', SKILLS, [], {
        backgroundCommandIds: ['run-1', 'run-2'],
      }).map((item) => item.displayCmd),
    ).toEqual(['run-1', 'run-2']);
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
    expect(items.map((item) => item.displayCmd)).toEqual(
      expect.arrayContaining(['/skill', '/skill_search', '/skill use frontend-design', '/skill use react']),
    );
  });

  it('shows skill entries for the literal /skill command query', () => {
    const items = buildSlashMenuItems('/skill', SKILLS);
    expect(items.map((item) => item.displayCmd)).toEqual(
      expect.arrayContaining(['/skill', '/skill use frontend-design', '/skill use react']),
    );
  });

  it('fuzzy-filters skills by name after /skill:', () => {
    const items = buildSlashMenuItems('/skill:rea', SKILLS);
    expect(items[0]?.displayCmd).toBe('/skill use react');
  });

  it('fuzzy-finds skills without requiring the /skill: prefix', () => {
    const items = buildSlashMenuItems('/reac', SKILLS);
    expect(items[0]?.displayCmd).toBe('/skill use react');
  });

  it('does not flood the default slash menu with every skill when only / is typed', () => {
    const items = buildSlashMenuItems('/', SKILLS);
    expect(items.some((item) => item.kind === 'skill')).toBe(false);
  });

  it('shows the full skill list when the slash query targets skills directly', () => {
    const items = buildSlashMenuItems('/skills', SKILLS);
    expect(items.map((item) => item.displayCmd)).toEqual(expect.arrayContaining(['/skill use frontend-design', '/skill use react']));
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

    expect(items.some((item) => item.displayCmd === '/skill use project-planning')).toBe(true);
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

    expect(items).toContainEqual(expect.objectContaining({ displayCmd: '/visualize', kind: 'command' }));
  });
});
