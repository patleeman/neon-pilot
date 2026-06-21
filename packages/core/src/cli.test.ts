import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  buildCliInvocation,
  commandMatches,
  findCliCommandGroup,
  findCliHelpTarget,
  formatCliError,
  formatCliResult,
  type NeonPilotCliCommandDefinition,
  parseCliFlags,
  renderCliCommandGroupHelp,
  renderCliCommandHelp,
  renderCliCommandList,
  renderCliUsage,
  selectCliCommandMatch,
  validateCliInvocation,
  withDefaultCliCommandContract,
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
      quiet: false,
      verbose: false,
      color: true,
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

  it('renders command family help for group-level help targets', () => {
    expect(findCliCommandGroup(commands, 'extensions')).toEqual([commands[1], commands[2]]);
    const help = renderCliCommandGroupHelp(commands.slice(1), 'extensions', 'neon-pilot');
    expect(help).toContain('extensions commands');
    expect(help).toContain('Usage: neon-pilot extensions <subcommand> [args]');
    expect(help).toContain('extensions list [system-extension-manager]  List installed extensions.');
    expect(help).toContain('Run `neon-pilot help extensions <subcommand>`');
  });

  it('hides advanced commands by default and shows them in verbose or JSON modes', () => {
    const commandDefinitions = [
      withDefaultCliCommandContract({ id: 'ask', command: 'ask', description: 'Ask Neon Pilot.' }),
      withDefaultCliCommandContract({ id: 'schema', command: 'schema', description: 'Export contracts.' }),
      withDefaultCliCommandContract({ id: 'protocol', command: 'protocol', description: 'Raw protocol.' }),
      withDefaultCliCommandContract({
        id: 'transcript-update',
        command: 'conversations transcript update',
        description: 'Advanced transcript mutation.',
      }),
    ];

    const human = renderCliCommandList(commandDefinitions, false);
    expect(human).toContain('ask  Ask Neon Pilot.');
    expect(human).not.toContain('protocol  Raw protocol.');
    expect(human).not.toContain('schema  Export contracts.');
    expect(human).not.toContain('conversations transcript update');
    expect(human).toContain('Advanced Commands: hidden from the default human list.');

    const verbose = renderCliCommandList(commandDefinitions, false, { verbose: true });
    expect(verbose).toContain('protocol  Raw protocol.');
    expect(verbose).toContain('schema  Export contracts.');
    expect(verbose).toContain('conversations transcript update  Advanced transcript mutation.');

    const json = renderCliCommandList(commandDefinitions, true);
    expect(json).toContain('"command": "protocol"');
    expect(json).toContain('"stability": "advanced"');
  });

  it('renders compact brief command output for agent reading without exposing advanced commands by default', () => {
    const commandDefinitions = [
      withDefaultCliCommandContract({ id: 'ask', command: 'ask', description: 'Ask Neon Pilot.' }),
      withDefaultCliCommandContract({ id: 'protocol', command: 'protocol', description: 'Raw protocol.' }),
    ];

    const brief = renderCliCommandList(commandDefinitions, false, { brief: true });
    expect(brief).toContain('Neon Pilot commands (brief):');
    expect(brief).toContain('ask | agent.new_conversation_turn | public | use: asking Neon Pilot to do a one-off task from the CLI');
    expect(brief).not.toContain('protocol | host.raw_protocol_escape_hatch');
    expect(brief).toContain('advanced commands hidden');

    expect(renderCliCommandList(commandDefinitions, false, { brief: true, verbose: true })).toContain(
      'protocol | host.raw_protocol_escape_hatch | advanced',
    );
  });

  it('labels dry-run support explicitly and does not infer it for executable turns', () => {
    const turnHelp = renderCliCommandHelp(withDefaultCliCommandContract({ id: 'ask', command: 'ask' }), 'neon-pilot');
    expect(turnHelp).not.toContain('supports-dry-run');
    expect(turnHelp).not.toContain('dry-run');

    const pruneHelp = renderCliCommandHelp(
      withDefaultCliCommandContract({
        id: 'prune',
        command: 'conversations retention prune',
        usage: 'conversations retention prune [olderThan] [--dry-run] [--json]',
      }),
      'neon-pilot',
    );
    expect(pruneHelp).toContain('supports-dry-run');
  });

  it('keeps JSON examples out of normal help when a human example exists', () => {
    const help = renderCliCommandHelp(
      {
        id: 'settings-list',
        command: 'settings list',
        description: 'List settings.',
        examples: ['neon-pilot settings list', 'neon-pilot settings list --json'],
      },
      'neon-pilot',
    );

    expect(help).toContain('neon-pilot settings list');
    expect(help).not.toContain('neon-pilot settings list --json');
    expect(help).toContain('Add --json when scripting or parsing output.');
  });

  it('formats human output without forcing JSON when text is available', () => {
    expect(formatCliResult({ text: 'Done.', ok: true }, false)).toBe('Done.\n');
    expect(formatCliResult({ content: [{ type: 'text', text: 'Tool text.' }], details: { ok: true } }, false)).toBe('Tool text.\n');
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

  it('validates positional and flag schemas before dispatch', () => {
    const definition: NeonPilotCliCommandDefinition = {
      id: 'delete',
      command: 'items delete',
      argsSchema: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'string', minLength: 1 } },
      flagsSchema: {
        type: 'object',
        properties: {
          yes: { type: 'boolean' },
          format: { enum: ['text', 'json'] },
          tail: { type: 'number', minimum: 1, maximum: 1000 },
        },
        required: ['yes'],
        additionalProperties: false,
      },
    };

    expect(
      validateCliInvocation({
        definition,
        rawArgv: [],
        args: [],
        flags: { format: 'jsonl', tail: 'many', extra: true },
        json: false,
        quiet: false,
        verbose: false,
        color: true,
        cwd: '/repo',
      }).errors,
    ).toEqual([
      'Expected at least 1 positional argument.',
      'Unknown flag --extra.',
      'Missing required flag --yes.',
      '--format must be one of: text, json.',
      '--tail must be a number.',
    ]);
  });

  it('validates numeric flag ranges', () => {
    const definition: NeonPilotCliCommandDefinition = {
      id: 'logs',
      command: 'runs logs',
      argsSchema: { type: 'array' },
      flagsSchema: {
        type: 'object',
        properties: {
          tail: { type: 'number', minimum: 1, maximum: 1000 },
        },
        additionalProperties: true,
      },
    };

    expect(
      validateCliInvocation({
        definition,
        rawArgv: [],
        args: [],
        flags: { tail: '0' },
        json: false,
        quiet: false,
        verbose: false,
        color: true,
        cwd: '/repo',
      }).errors,
    ).toEqual(['--tail must be at least 1.']);

    expect(
      validateCliInvocation({
        definition,
        rawArgv: [],
        args: [],
        flags: { tail: '1001' },
        json: false,
        quiet: false,
        verbose: false,
        color: true,
        cwd: '/repo',
      }).errors,
    ).toEqual(['--tail must be at most 1000.']);
  });
});
