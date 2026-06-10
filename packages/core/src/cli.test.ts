import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  buildCliInvocation,
  commandMatches,
  findCliHelpTarget,
  formatCliError,
  formatCliResult,
  parseCliFlags,
  renderCliCommandHelp,
  renderCliCommandList,
  renderCliUsage,
  selectCliCommandMatch,
  type NeonPilotCliCommandDefinition,
} from './cli.js';

const commands: NeonPilotCliCommandDefinition[] = [
  {
    id: 'settings-list',
    command: 'settings list',
    description: 'List runtime settings.',
    usage: 'settings list [prefix] [--json]',
    examples: ['neon-pilot settings list conversation'],
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['text', 'json'],
    source: 'core',
  },
  {
    id: 'extensions-list',
    command: 'extensions list',
    aliases: ['ext list'],
    description: 'List installed extensions.',
    source: 'extension',
    extensionId: 'system-extension-manager',
    jsonDefault: true,
  },
  {
    id: 'extensions-list-enabled',
    command: 'extensions list enabled',
    description: 'List enabled extensions.',
    source: 'extension',
    extensionId: 'system-extension-manager',
  },
];

describe('core CLI shell helpers', () => {
  it('parses flags, booleans, and positional arguments', () => {
    expect(parseCliFlags(['conversation.pinnedToolCalls', 'false', '--profile=shared', '--dry-run', '--name', 'Pilot'])).toEqual({
      positional: ['conversation.pinnedToolCalls', 'false'],
      flags: { profile: 'shared', 'dry-run': true, name: 'Pilot' },
    });
  });

  it('matches command aliases and prefers the longest command', () => {
    expect(commandMatches(commands[1]!, ['ext', 'list'])).toEqual({ matched: true, length: 2 });
    expect(selectCliCommandMatch(commands, ['extensions', 'list', 'enabled'])).toEqual({
      status: 'matched',
      match: { definition: commands[2], length: 3 },
    });
  });

  it('reports ambiguous commands with the shared prefix', () => {
    const duplicateCommands = [
      { id: 'one', command: 'settings list' },
      { id: 'two', command: 'settings list', extensionId: 'ext', source: 'extension' as const },
    ];

    expect(selectCliCommandMatch(duplicateCommands, ['settings', 'list'])).toEqual({ status: 'ambiguous', command: 'settings list' });
  });

  it('builds invocations with explicit json requests and requested stdin', async () => {
    const stdin = new PassThrough();
    stdin.end('secret\n');

    await expect(buildCliInvocation(commands[1]!, ['--json', '--stdin', '--target', 'dev'], { cwd: '/repo', stdin })).resolves.toEqual({
      definition: commands[1],
      rawArgv: ['--stdin', '--target', 'dev'],
      args: [],
      flags: { stdin: true, target: 'dev' },
      json: true,
      cwd: '/repo',
      stdinText: 'secret\n',
    });
    await expect(buildCliInvocation(commands[1]!, [], { cwd: '/repo' })).resolves.toMatchObject({ json: false });
  });

  it('renders human-oriented usage, command lists, and command help', () => {
    expect(renderCliUsage({ commandName: 'neon-pilot' })).toContain('Usage: neon-pilot <command> [args]');
    expect(renderCliCommandList(commands, false)).toContain('extensions list [system-extension-manager]  List installed extensions.');
    expect(renderCliCommandHelp(commands[0]!, 'neon-pilot')).toContain('Usage: neon-pilot settings list [prefix] [--json]');
    expect(renderCliCommandHelp(commands[0]!, 'neon-pilot')).toContain('Contract: mode=read, offline-ok, output=text|json');
    expect(findCliHelpTarget(commands, 'ext list')).toBe(commands[1]);
  });

  it('formats human output without forcing JSON when text is available', () => {
    expect(formatCliResult({ text: 'Done.', ok: true }, false)).toBe('Done.\n');
    expect(formatCliResult({ ok: true }, false)).toBe('{\n  "ok": true\n}\n');
    expect(formatCliResult({ text: 'Done.', ok: true }, true)).toContain('"ok": true');
  });

  it('formats structured errors for JSON callers', () => {
    expect(
      formatCliError(
        { code: 'unknown_command', category: 'not_found', message: 'Unknown command', command: 'wat', hint: 'Run neon-pilot commands.' },
        true,
      ),
    ).toContain('"recoverable": true');
    expect(formatCliError({ code: 'runtime_error', category: 'runtime_failure', message: 'Boom' }, false)).toBe('Boom\n');
  });
});
