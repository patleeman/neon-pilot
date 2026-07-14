import { describe, expect, it } from 'vitest';

import {
  validateApplicationContributions,
  validateCliCommandContributions,
  validateCommandContributions,
  validateKeybindingContributions,
  validateMentionContributions,
  validateNavigationContributions,
  validateSlashCommandContributions,
} from './extensionBasicContributionValidation';

describe('extensionBasicContributionValidation', () => {
  it('validates basic contribution groups', () => {
    expect(
      validateApplicationContributions([
        {
          id: 'agent',
          title: 'Agent',
          startRoute: '/conversations/new',
          sidebarView: 'sidebar',
          instancePolicy: 'singleton',
          defaultPinned: true,
          order: 10,
          navigationSlots: [{ id: 'work', label: 'Work', order: 10 }],
        },
      ]),
    ).toBeUndefined();
    expect(
      validateNavigationContributions([{ id: 'home', label: 'Home', route: '/home', section: 'primary', pageType: 'table' }]),
    ).toBeUndefined();
    expect(validateNavigationContributions([{ id: 'custom', label: 'Custom', route: '/custom' }])).toBeUndefined();
    expect(validateCommandContributions([{ id: 'cmd', title: 'Run', action: 'run', category: 'Tools' }])).toBeUndefined();
    expect(
      validateCliCommandContributions([
        {
          id: 'tasks-list',
          command: 'tasks list',
          description: 'List tasks.',
          usage: 'tasks list [--json]',
          examples: ['neon-pilot tasks list'],
          action: 'manageTasks',
        },
      ]),
    ).toBeUndefined();
    expect(
      validateKeybindingContributions([{ id: 'kb', title: 'Run', keys: ['Meta+K'], command: 'cmd', scope: 'global' }]),
    ).toBeUndefined();
    expect(validateSlashCommandContributions([{ name: 'run', description: 'Run', action: 'run' }])).toBeUndefined();
    expect(validateMentionContributions([{ id: 'docs', title: 'Docs', kinds: ['doc'], provider: 'docs' }])).toBeUndefined();
  });

  it('preserves validation error paths', () => {
    expect(() =>
      validateApplicationContributions([
        { id: 'agent', title: 'Agent', startRoute: '/agent' },
        { id: 'agent', title: 'Duplicate', startRoute: '/duplicate' },
      ]),
    ).toThrow('duplicate id "agent"');
    expect(() =>
      validateApplicationContributions([
        { id: 'agent', title: 'Agent', startRoute: '/agent', navigationSlots: [{ id: 'work' }, { id: 'work' }] },
      ]),
    ).toThrow('navigationSlots contains duplicate id "work"');
    expect(() => validateApplicationContributions([{ id: 'agent', title: 'Agent', startRoute: '/agent', order: 1.5 }])).toThrow(
      'order must be an integer',
    );
    expect(() => validateNavigationContributions([{ id: 'home', label: 'Home' }])).toThrow(
      'Extension manifest contributes.nav[0].route must be a non-empty string.',
    );
    expect(() => validateNavigationContributions([{ id: 'home', label: 'Home', route: '/home', pageType: 'spreadsheet' }])).toThrow(
      'Extension manifest contributes.nav[0].pageType must be one of:',
    );
    expect(() => validateCommandContributions([{ id: 'cmd', title: 'Run', action: 'run', icon: 'bad-icon' }])).toThrow(
      'Extension manifest contributes.commands[0].icon must be one of:',
    );
    expect(() =>
      validateCliCommandContributions([{ id: 'tasks-list', command: 'tasks list', action: 'manageTasks', examples: [''] }]),
    ).toThrow('Extension manifest contributes.cliCommands[0].examples must be an array of non-empty strings.');
    expect(() => validateKeybindingContributions([{ id: 'kb', title: 'Run', keys: [''], command: 'cmd' }])).toThrow(
      'Extension manifest contributes.keybindings[0].keys must be an array of non-empty strings.',
    );
    expect(() => validateSlashCommandContributions([{ name: 'run', description: 'Run' }])).toThrow(
      'Extension manifest contributes.slashCommands[0].action must be a non-empty string.',
    );
    expect(() => validateMentionContributions([{ id: 'docs', title: 'Docs', kinds: ['doc'] }])).toThrow(
      'Extension manifest contributes.mentions[0].provider must be a non-empty string.',
    );
  });
});
