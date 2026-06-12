export const NEON_PILOT_CLI_EXIT_CODES = {
  usage: 1,
  notFound: 2,
  ambiguous: 3,
  loadFailure: 4,
  runtimeFailure: 5,
} as const;

export type NeonPilotCliExitCode = (typeof NEON_PILOT_CLI_EXIT_CODES)[keyof typeof NEON_PILOT_CLI_EXIT_CODES];

export interface NeonPilotCliCommandDefinition {
  id: string;
  command: string;
  title?: string;
  description?: string;
  intent?: string;
  audience?: Array<'human' | 'external-agent' | 'internal-agent' | 'extension-author'>;
  stability?: 'public' | 'advanced' | 'internal' | 'deprecated';
  recommendedFor?: string[];
  notFor?: string[];
  preferredOver?: string[];
  usage?: string;
  examples?: string[];
  argsSchema?: Record<string, unknown>;
  flagsSchema?: Record<string, unknown>;
  mode?: 'read' | 'write' | 'destructive' | 'background' | 'streaming';
  requiresApp?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  startsBackgroundWork?: boolean;
  supportsDryRun?: boolean;
  outputModes?: Array<'text' | 'json' | 'jsonl'>;
  streaming?: {
    supportsFollow?: boolean;
    supportsJsonl?: boolean;
    cancelOnInterruptDefault?: boolean;
  };
  smoke?: {
    argv?: string[];
    expectHumanIncludes?: string[];
    expectJsonFields?: string[];
  };
  aliases?: string[];
  jsonDefault?: boolean;
  source?: 'core' | 'extension';
  extensionId?: string;
}

export interface NeonPilotCliParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

export interface NeonPilotCliCommandMatch<T extends NeonPilotCliCommandDefinition = NeonPilotCliCommandDefinition> {
  definition: T;
  length: number;
}

export interface NeonPilotCliInvocation<T extends NeonPilotCliCommandDefinition = NeonPilotCliCommandDefinition> {
  definition: T;
  rawArgv: string[];
  args: string[];
  flags: Record<string, string | boolean>;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
  cwd: string;
  stdinText?: string;
}

export interface NeonPilotCliHelpOptions {
  commandName?: string;
  summary?: string;
  builtInCommands?: string[];
  examples?: string[];
}

export interface NeonPilotCliErrorResult {
  ok: false;
  error: {
    code: string;
    category: 'usage' | 'not_found' | 'ambiguous' | 'load_failure' | 'runtime_failure';
    message: string;
    command?: string;
    hint?: string;
    recoverable: boolean;
  };
}

export interface NeonPilotCliValidationResult {
  ok: boolean;
  errors: string[];
}

export interface NeonPilotCliGlobalOptions {
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
}

export function wantsJson(args: string[]): boolean {
  return args.includes('--json');
}

export function stripJsonFlag(args: string[]): string[] {
  return args.filter((arg) => arg !== '--json');
}

export function stripCliGlobalFlags(args: string[]): string[] {
  return args.filter((arg) => !['--json', '--quiet', '--verbose', '--no-color'].includes(arg));
}

export function readCliGlobalOptions(args: string[]): NeonPilotCliGlobalOptions {
  return {
    json: args.includes('--json'),
    quiet: args.includes('--quiet'),
    verbose: args.includes('--verbose'),
    color: !args.includes('--no-color'),
  };
}

export function parseCliFlags(args: string[]): NeonPilotCliParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string;
    if (!arg.startsWith('--') || arg === '--') {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > 2) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { positional, flags };
}

export function commandTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

export function commandMatches(
  definition: Pick<NeonPilotCliCommandDefinition, 'command' | 'aliases'>,
  argv: string[],
): { matched: boolean; length: number } {
  const candidates = [definition.command, ...(definition.aliases ?? [])].map(commandTokens);
  for (const candidate of candidates) {
    if (candidate.length === 0 || candidate.length > argv.length) continue;
    if (candidate.every((token, index) => argv[index] === token)) return { matched: true, length: candidate.length };
  }
  return { matched: false, length: 0 };
}

export function findCliCommandMatches<T extends NeonPilotCliCommandDefinition>(
  definitions: T[],
  argv: string[],
): Array<NeonPilotCliCommandMatch<T>> {
  return definitions
    .map((definition) => ({ definition, ...commandMatches(definition, argv) }))
    .filter((match) => match.matched)
    .map(({ definition, length }) => ({ definition, length }))
    .sort((a, b) => b.length - a.length);
}

export function selectCliCommandMatch<T extends NeonPilotCliCommandDefinition>(
  definitions: T[],
  argv: string[],
): { status: 'matched'; match: NeonPilotCliCommandMatch<T> } | { status: 'notFound' } | { status: 'ambiguous'; command: string } {
  const matches = findCliCommandMatches(definitions, argv);
  if (matches.length === 0) return { status: 'notFound' };
  const bestLength = matches[0]!.length;
  const bestMatches = matches.filter((match) => match.length === bestLength);
  if (bestMatches.length > 1) return { status: 'ambiguous', command: argv.slice(0, bestLength).join(' ') };
  return { status: 'matched', match: bestMatches[0]! };
}

export async function readCliStdinIfRequested(
  flags: Record<string, string | boolean>,
  stdin: AsyncIterable<Buffer | string> = process.stdin,
): Promise<string | undefined> {
  if (flags.stdin !== true && flags['api-key-stdin'] !== true) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export async function buildCliInvocation<T extends NeonPilotCliCommandDefinition>(
  definition: T,
  rawArgs: string[],
  options?: { cwd?: string; stdin?: AsyncIterable<Buffer | string> },
): Promise<NeonPilotCliInvocation<T>> {
  const globals = readCliGlobalOptions(rawArgs);
  const cleanArgs = stripCliGlobalFlags(rawArgs);
  const parsed = parseCliFlags(cleanArgs);
  const stdinText = await readCliStdinIfRequested(parsed.flags, options?.stdin);
  return {
    definition,
    rawArgv: cleanArgs,
    args: parsed.positional,
    flags: parsed.flags,
    json: globals.json,
    quiet: globals.quiet,
    verbose: globals.verbose,
    color: globals.color,
    cwd: options?.cwd ?? process.cwd(),
    ...(stdinText !== undefined ? { stdinText } : {}),
  };
}

export function formatCliResult(result: unknown, json: boolean): string {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const record = result as Record<string, unknown>;
    if (typeof record.text === 'string') return `${record.text}\n`;
    if (typeof record.message === 'string') return `${record.message}\n`;
    if (Array.isArray(record.content)) {
      const text = record.content
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
          const entry = item as Record<string, unknown>;
          return entry.type === 'text' && typeof entry.text === 'string' ? entry.text : '';
        })
        .filter(Boolean)
        .join('\n');
      if (text) return `${text}\n`;
    }
  }
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function formatCliTable(rows: Array<Record<string, unknown>>, columns: string[]): string {
  if (rows.length === 0) return '(none)\n';
  const widths = columns.map((column) =>
    Math.max(
      column.length,
      ...rows.map((row) => {
        const value = row[column];
        return value === undefined || value === null ? 0 : String(value).length;
      }),
    ),
  );
  const renderRow = (row: Record<string, unknown>) =>
    columns
      .map((column, index) => {
        const value = row[column];
        return String(value === undefined || value === null ? '' : value).padEnd(widths[index] ?? column.length);
      })
      .join('  ')
      .trimEnd();
  return (
    [
      `${columns
        .map((column, index) => column.padEnd(widths[index] ?? column.length))
        .join('  ')
        .trimEnd()}`,
      ...rows.map(renderRow),
    ].join('\n') + '\n'
  );
}

export function formatCliError(
  input: {
    code: string;
    category: NeonPilotCliErrorResult['error']['category'];
    message: string;
    command?: string;
    hint?: string;
    recoverable?: boolean;
  },
  json: boolean,
): string {
  if (!json) return `${input.message}\n`;
  const result: NeonPilotCliErrorResult = {
    ok: false,
    error: {
      code: input.code,
      category: input.category,
      message: input.message,
      ...(input.command ? { command: input.command } : {}),
      ...(input.hint ? { hint: input.hint } : {}),
      recoverable: input.recoverable ?? input.category !== 'runtime_failure',
    },
  };
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function renderCliUsage(options: NeonPilotCliHelpOptions = {}): string {
  const commandName = options.commandName ?? 'neon-pilot';
  const builtInCommands = options.builtInCommands ?? [
    'commands [--json]             List available CLI commands',
    'cli status|install|uninstall  Manage the optional user-shell CLI symlink',
    'help [command]                Show help',
  ];
  const examples = options.examples ?? [`${commandName} commands`, `${commandName} help settings list`];
  return [
    `Usage: ${commandName} <command> [args]`,
    '',
    options.summary ?? 'Neon Pilot command line administration.',
    '',
    'Start here:',
    `  ${commandName} ask "..."                         Ask Neon Pilot to do one task`,
    `  ${commandName} conversations run-turn <id> --text "..."`,
    `                                      Continue an existing conversation`,
    `  ${commandName} background-commands start --command "..."`,
    `                                      Run shell work in the background`,
    `  ${commandName} commands                        Browse command families`,
    '',
    'Decision rules:',
    '  Use ask for normal one-off agent work from the CLI.',
    '  Use conversations run-turn when you already have a conversation id.',
    '  Use background-commands for detached shell commands.',
    '  Advanced escape hatches are hidden from the default command list; use commands --verbose when needed.',
    '',
    'Built-in commands:',
    ...builtInCommands.map((command) => `  ${command}`),
    '',
    'Examples:',
    ...examples.map((example) => `  ${example}`),
    '',
    'Global flags:',
    '  --json       Print structured JSON for scripts when supported',
    '  --quiet      Suppress non-essential human output',
    '  --verbose    Include diagnostic detail in human output',
    '  --no-color   Disable ANSI color output',
  ].join('\n');
}

export function renderCliCommandList(
  definitions: NeonPilotCliCommandDefinition[],
  json: boolean,
  options: { verbose?: boolean } = {},
): string {
  const commands = [...definitions].sort((a, b) => a.command.localeCompare(b.command));
  if (json) return `${JSON.stringify({ commands }, null, 2)}\n`;
  const renderedGroups = renderCliCommandGroups(commands, { includeAdvanced: options.verbose === true });
  const commonIntents = renderCliCommonIntents(commands);
  return (
    [
      'Neon Pilot commands:',
      '',
      'Common intents:',
      ...commonIntents,
      '',
      'Decision rules:',
      '  Use ask for normal one-off agent work from the CLI.',
      '  Use conversations run-turn when you already have a conversation id.',
      '  Use background-commands for detached shell commands.',
      '  Use subagent commands to inspect/manage delegated background agents, not ordinary prompting.',
      '  Advanced escape hatches are hidden by default; use commands --verbose when needed.',
      '',
      ...renderedGroups,
      '',
      'Use `neon-pilot help <command>` for details, `commands --verbose` for advanced surfaces, or `commands --json` for scripts.',
    ].join('\n') + '\n'
  );
}

function renderCliCommonIntents(commands: NeonPilotCliCommandDefinition[]): string[] {
  const has = (commandName: string) => commands.some((command) => command.command === commandName);
  return [
    has('ask') ? '  Ask Neon Pilot to do one task       neon-pilot ask "..."' : undefined,
    has('conversations run-turn') ? '  Continue an existing conversation   neon-pilot conversations run-turn <id> --text "..."' : undefined,
    has('background-commands start')
      ? '  Run shell work in the background    neon-pilot background-commands start --command "..."'
      : undefined,
    has('subagents list') || has('subagent list') ? '  Inspect delegated agent work        neon-pilot subagents list' : undefined,
    has('tasks list') ? '  Manage scheduled behavior           neon-pilot tasks list' : undefined,
  ].filter((line): line is string => Boolean(line));
}

function renderCliCommandGroups(commands: NeonPilotCliCommandDefinition[], options: { includeAdvanced: boolean }): string[] {
  const groups = [
    { title: 'Start Here', prefixes: ['ask', 'doctor', 'help'] },
    { title: 'Conversation Work', prefixes: ['ask', 'conversations'] },
    { title: 'Background Work', prefixes: ['background-commands'] },
    { title: 'Delegated Agent Work', prefixes: ['subagent', 'subagents'] },
    { title: 'Scheduled Work', prefixes: ['tasks', 'automations'] },
    { title: 'Runtime Setup', prefixes: ['bootstrap', 'cli', 'paths', 'version'] },
    { title: 'Extensions and Settings', prefixes: ['extensions', 'settings'] },
    { title: 'Discovery and Contracts', prefixes: ['commands', 'schema'] },
    { title: 'Advanced Escape Hatches', prefixes: ['app-commands', 'protocol'] },
  ] as const;
  const used = new Set<string>();
  const lines: string[] = [];
  for (const group of groups) {
    const groupCommands = commands.filter(
      (command) =>
        group.prefixes.some((prefix) => command.command === prefix || command.command.startsWith(`${prefix} `)) &&
        (options.includeAdvanced || command.stability !== 'advanced'),
    );
    if (groupCommands.length === 0) continue;
    lines.push(`${group.title}:`);
    for (const command of groupCommands) {
      used.add(command.id);
      lines.push(renderCliCommandListEntry(command));
    }
    lines.push('');
  }
  const otherCommands = commands.filter(
    (command) => !used.has(command.id) && (options.includeAdvanced || command.stability !== 'advanced'),
  );
  if (otherCommands.length > 0) {
    lines.push('Other Commands:');
    lines.push(...otherCommands.map(renderCliCommandListEntry));
  } else if (lines.at(-1) === '') {
    lines.pop();
  }
  if (!options.includeAdvanced && commands.some((command) => command.stability === 'advanced')) {
    if (lines.at(-1) !== '') lines.push('');
    lines.push('Advanced Commands: hidden from the default human list. Use `neon-pilot commands --verbose`.');
  }
  return lines;
}

function renderCliCommandListEntry(command: NeonPilotCliCommandDefinition): string {
  const owner = command.source === 'extension' && command.extensionId ? ` [${command.extensionId}]` : '';
  const description = command.description ?? command.title;
  return `  ${command.command}${owner}${description ? `  ${description}` : ''}`;
}

export function renderCliCommandHelp(definition: NeonPilotCliCommandDefinition, commandName = 'neon-pilot'): string {
  const lines = [definition.command];
  const description = definition.description ?? definition.title;
  if (description) lines.push('', description);
  if (definition.recommendedFor?.length) {
    lines.push('', 'Use when:');
    lines.push(...definition.recommendedFor.map((item) => `  ${item}`));
  }
  if (definition.notFor?.length) {
    lines.push('', 'Do not use for:');
    lines.push(...definition.notFor.map((item) => `  ${item}`));
  }
  lines.push('', `Usage: ${commandName} ${definition.usage ?? definition.command}`);
  if (definition.aliases?.length) lines.push('', `Aliases: ${definition.aliases.join(', ')}`);
  const details = [
    definition.mode ? `mode=${definition.mode}` : undefined,
    definition.requiresApp === false ? 'offline-ok' : definition.requiresApp === true ? 'requires-app' : undefined,
    definition.destructive ? 'destructive' : undefined,
    definition.supportsDryRun ? 'dry-run' : undefined,
    definition.startsBackgroundWork ? 'starts-background-work' : undefined,
    definition.outputModes?.length ? `output=${definition.outputModes.join('|')}` : undefined,
  ].filter((item): item is string => Boolean(item));
  if (details.length > 0) lines.push('', `Contract: ${details.join(', ')}`);
  if (definition.examples?.length) {
    lines.push('', 'Examples:');
    lines.push(...definition.examples.map((example) => `  ${example}`));
  }
  return `${lines.join('\n')}\n`;
}

export function findCliHelpTarget<T extends NeonPilotCliCommandDefinition>(definitions: T[], target: string): T | undefined {
  const normalized = target.trim();
  if (!normalized) return undefined;
  return definitions.find((definition) => definition.command === normalized || definition.aliases?.includes(normalized));
}

export function actionFromCliCommand(command: string): string | undefined {
  return commandTokens(command).at(-1);
}

export function buildCliCommandSchema(definitions: NeonPilotCliCommandDefinition[]): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Neon Pilot CLI command contracts',
    type: 'object',
    commands: [...definitions]
      .sort((a, b) => a.command.localeCompare(b.command))
      .map((definition) => ({
        id: definition.id,
        command: definition.command,
        aliases: definition.aliases ?? [],
        source: definition.source ?? 'extension',
        extensionId: definition.extensionId,
        description: definition.description ?? definition.title ?? '',
        intent: definition.intent,
        audience: definition.audience ?? ['human', 'external-agent'],
        stability: definition.stability ?? 'public',
        recommendedFor: definition.recommendedFor ?? [],
        notFor: definition.notFor ?? [],
        preferredOver: definition.preferredOver ?? [],
        usage: definition.usage ?? definition.command,
        mode: definition.mode ?? 'write',
        requiresApp: definition.requiresApp !== false,
        destructive: definition.destructive === true,
        idempotent: definition.idempotent === true,
        startsBackgroundWork: definition.startsBackgroundWork === true,
        supportsDryRun: definition.supportsDryRun === true,
        outputModes: definition.outputModes ?? ['text'],
        argsSchema: definition.argsSchema ?? {},
        flagsSchema: definition.flagsSchema ?? {},
        streaming: definition.streaming,
      })),
  };
}

export function validateCliInvocation(invocation: NeonPilotCliInvocation): NeonPilotCliValidationResult {
  const errors: string[] = [];
  const argsSchema = invocation.definition.argsSchema;
  const flagsSchema = invocation.definition.flagsSchema;
  validateArgsSchema(argsSchema, invocation.args, errors);
  validateFlagsSchema(flagsSchema, invocation.flags, errors);
  return { ok: errors.length === 0, errors };
}

function validateArgsSchema(schema: unknown, args: string[], errors: string[]): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
  const record = schema as Record<string, unknown>;
  if (typeof record.minItems === 'number' && args.length < record.minItems) {
    errors.push(`Expected at least ${record.minItems} positional argument${record.minItems === 1 ? '' : 's'}.`);
  }
  if (typeof record.maxItems === 'number' && args.length > record.maxItems) {
    errors.push(`Expected at most ${record.maxItems} positional argument${record.maxItems === 1 ? '' : 's'}.`);
  }
  if (record.items === false && args.length > 0) {
    errors.push('This command does not accept positional arguments.');
  }
  const prefixItems = Array.isArray(record.prefixItems) ? record.prefixItems : [];
  for (let index = 0; index < Math.min(prefixItems.length, args.length); index += 1) {
    validatePrimitiveSchema(prefixItems[index], args[index], `argument ${index + 1}`, errors);
  }
  if (record.items && typeof record.items === 'object' && !Array.isArray(record.items)) {
    for (let index = prefixItems.length; index < args.length; index += 1) {
      validatePrimitiveSchema(record.items, args[index], `argument ${index + 1}`, errors);
    }
  }
}

function validateFlagsSchema(schema: unknown, flags: Record<string, string | boolean>, errors: string[]): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
  const record = schema as Record<string, unknown>;
  const properties =
    record.properties && typeof record.properties === 'object' && !Array.isArray(record.properties)
      ? (record.properties as Record<string, unknown>)
      : {};
  if (record.additionalProperties === false) {
    for (const key of Object.keys(flags)) {
      if (!(key in properties)) errors.push(`Unknown flag --${key}.`);
    }
  }
  const required = Array.isArray(record.required) ? record.required.filter((item): item is string => typeof item === 'string') : [];
  for (const key of required) {
    if (!(key in flags)) errors.push(`Missing required flag --${key}.`);
  }
  for (const [key, value] of Object.entries(flags)) {
    validatePrimitiveSchema(properties[key], value, `--${key}`, errors);
  }
}

function validatePrimitiveSchema(schema: unknown, value: unknown, label: string, errors: string[]): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
  const record = schema as Record<string, unknown>;
  if (Array.isArray(record.enum) && !record.enum.includes(value)) {
    errors.push(`${label} must be one of: ${record.enum.map(String).join(', ')}.`);
  }
  if (record.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${label} must be a boolean flag.`);
  }
  if (record.type === 'string' && typeof value !== 'string') {
    errors.push(`${label} requires a value.`);
  }
  if (record.type === 'number') {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (!Number.isFinite(parsed)) {
      errors.push(`${label} must be a number.`);
      return;
    }
    if (typeof record.minimum === 'number' && parsed < record.minimum) {
      errors.push(`${label} must be at least ${record.minimum}.`);
    }
    if (typeof record.maximum === 'number' && parsed > record.maximum) {
      errors.push(`${label} must be at most ${record.maximum}.`);
    }
  }
  if (record.minLength === 1 && typeof value === 'string' && !value.trim()) {
    errors.push(`${label} must not be empty.`);
  }
}

export function withDefaultCliCommandContract<T extends NeonPilotCliCommandDefinition>(definition: T): T {
  const mode = definition.mode ?? inferCliCommandMode(definition.command);
  const requiresApp = definition.requiresApp ?? inferCliCommandRequiresApp(definition.command);
  const supportsDryRun =
    definition.supportsDryRun ??
    (mode === 'write' || mode === 'destructive' || mode === 'background' || definition.command === 'conversations run-turn');
  const usage = definition.usage ?? inferCliCommandUsage(definition.command);
  const outputModes = definition.outputModes ?? (mode === 'streaming' ? ['text', 'json', 'jsonl'] : ['text', 'json']);
  const destructive = definition.destructive ?? mode === 'destructive';
  const flagsSchema = withCliShellFlags(definition.flagsSchema ?? inferCliFlagsSchema(definition.command, { supportsDryRun, mode }), {
    destructive,
  });
  return {
    ...definition,
    intent: definition.intent ?? inferCliCommandIntent(definition.command),
    audience: definition.audience ?? inferCliCommandAudience(definition.command),
    stability: definition.stability ?? inferCliCommandStability(definition.command),
    recommendedFor: definition.recommendedFor ?? inferCliCommandRecommendedFor(definition.command),
    notFor: definition.notFor ?? inferCliCommandNotFor(definition.command),
    preferredOver: definition.preferredOver ?? inferCliCommandPreferredOver(definition.command),
    usage,
    examples: definition.examples ?? [exampleFromCliUsage(usage), `${exampleFromCliUsage(usage)} --json`],
    argsSchema: definition.argsSchema ?? inferCliArgsSchema(definition.command),
    flagsSchema,
    mode,
    requiresApp,
    destructive,
    idempotent: definition.idempotent ?? mode === 'read',
    startsBackgroundWork: definition.startsBackgroundWork ?? mode === 'background',
    supportsDryRun,
    outputModes,
    ...((definition.streaming ?? mode === 'streaming')
      ? {
          streaming: definition.streaming ?? {
            supportsFollow: true,
            supportsJsonl: outputModes.includes('jsonl'),
            cancelOnInterruptDefault: false,
          },
        }
      : {}),
  };
}

function inferCliCommandIntent(command: string): string | undefined {
  if (command === 'ask') return 'agent.new_conversation_turn';
  if (command.startsWith('conversations run-turn')) return 'agent.existing_conversation_turn';
  if (command.startsWith('conversations')) return 'conversation.manage';
  if (command.startsWith('background-commands start')) return 'execution.start_background_shell_command';
  if (command.startsWith('background-commands')) return 'execution.manage_background_shell_command';
  if (command.startsWith('subagent') || command.startsWith('subagents')) return 'execution.manage_delegated_agent_work';
  if (command.startsWith('tasks')) return 'automation.manage_scheduled_behavior';
  if (command.startsWith('extensions')) return 'extension.manage';
  if (command.startsWith('settings')) return 'settings.manage';
  if (command.startsWith('bootstrap')) return 'runtime.bootstrap';
  if (command === 'commands' || command === 'schema') return 'cli.discover_contracts';
  if (command === 'doctor' || command === 'paths' || command === 'version' || command.startsWith('cli')) return 'runtime.inspect';
  if (command.startsWith('app-commands')) return 'host.app_command_escape_hatch';
  if (command === 'protocol') return 'host.raw_protocol_escape_hatch';
  return undefined;
}

function inferCliCommandAudience(command: string): NonNullable<NeonPilotCliCommandDefinition['audience']> {
  if (command.startsWith('app-commands') || command === 'protocol' || command === 'schema') {
    return ['internal-agent', 'extension-author'];
  }
  if (command === 'commands' || command === 'doctor' || command === 'paths' || command === 'version') {
    return ['human', 'external-agent', 'internal-agent', 'extension-author'];
  }
  return ['human', 'external-agent', 'internal-agent'];
}

function inferCliCommandStability(command: string): NonNullable<NeonPilotCliCommandDefinition['stability']> {
  if (command.startsWith('app-commands') || command === 'protocol') return 'advanced';
  return 'public';
}

function inferCliCommandRecommendedFor(command: string): string[] {
  if (command === 'ask') {
    return ['asking Neon Pilot to do a one-off task from the CLI', 'starting normal agent work from a shell'];
  }
  if (command.startsWith('conversations run-turn')) {
    return ['sending a prompt to an existing conversation when you already know its id'];
  }
  if (command.startsWith('background-commands start')) {
    return ['starting detached shell work with logs, status, cancel, and rerun behavior'];
  }
  if (command.startsWith('background-commands')) {
    return ['inspecting, cancelling, rerunning, or reading logs for detached shell commands'];
  }
  if (command.startsWith('subagent') || command.startsWith('subagents')) {
    return ['inspecting or managing delegated background agent work created by the runtime or a conversation'];
  }
  if (command.startsWith('tasks')) {
    return ['managing scheduled recurring behavior'];
  }
  if (command.startsWith('app-commands')) {
    return ['advanced automation against command-palette/app commands when no first-class CLI command fits'];
  }
  if (command === 'protocol') {
    return ['advanced raw extension protocol integration when no first-class CLI command fits'];
  }
  return [];
}

function inferCliCommandNotFor(command: string): string[] {
  if (command.startsWith('subagent') || command.startsWith('subagents')) {
    return ['ordinary one-off CLI prompting; use `ask` instead', 'detached shell commands; use `background-commands start` instead'];
  }
  if (command.startsWith('background-commands')) {
    return ['agent prompting; use `ask` or `conversations run-turn` instead'];
  }
  if (command.startsWith('app-commands') || command === 'protocol') {
    return ['normal user-facing automation when a first-class CLI command exists'];
  }
  if (command === 'ask') {
    return [
      'continuing an existing conversation; use `conversations run-turn` instead',
      'running detached shell commands; use `background-commands start` instead',
    ];
  }
  return [];
}

function inferCliCommandPreferredOver(command: string): string[] {
  if (command === 'ask') return ['subagents start', 'app-commands run', 'protocol'];
  return [];
}

function withCliShellFlags(schema: Record<string, unknown>, options: { destructive: boolean }): Record<string, unknown> {
  const properties =
    schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? { ...(schema.properties as Record<string, unknown>) }
      : {};
  if (options.destructive) {
    properties.yes = { type: 'boolean', description: 'Confirm a destructive command without an interactive prompt.' };
  }
  return { ...schema, properties };
}

function inferCliCommandMode(command: string): NonNullable<NeonPilotCliCommandDefinition['mode']> {
  if (command === 'conversations run-turn' || command === 'protocol') return 'streaming';
  if (command.startsWith('background-commands start') || command.startsWith('tasks run') || command.startsWith('heartbeats start')) {
    return 'background';
  }
  if (command.includes(' delete') || command.includes(' uninstall') || command.includes('retention prune')) return 'destructive';
  const readVerbs = new Set([
    'list',
    'get',
    'search',
    'inspect',
    'schema',
    'doctor',
    'catalog',
    'paths',
    'sources',
    'logs',
    'workspace',
    'validate',
  ]);
  if (readVerbs.has(commandTokens(command).at(-1) ?? '') || command.endsWith('open list') || command.endsWith('scratchpad get'))
    return 'read';
  return 'write';
}

function inferCliCommandRequiresApp(command: string): boolean {
  if (command.startsWith('app-commands')) return true;
  return ['conversations send', 'conversations run-turn', 'conversations ensure-live', 'conversations abort', 'protocol'].includes(command);
}

function inferCliCommandUsage(command: string): string {
  const args = inferRequiredCliArgs(command).map((arg) => `<${arg}>`);
  if (command === 'settings set') args.push('<value>');
  if (command === 'conversations run-turn') args.push('--text <message> [--follow] [--format text|json|jsonl]');
  if (command === 'background-commands start') args.push('--command <shell> [--cwd <path>]');
  return [command, ...args, '[--json]'].join(' ');
}

function inferRequiredCliArgs(command: string): string[] {
  if (
    command.endsWith(' list') ||
    command.endsWith(' schema') ||
    command.endsWith(' doctor') ||
    command.endsWith(' catalog') ||
    command.endsWith(' paths') ||
    command.endsWith(' sources') ||
    command === 'commands' ||
    command === 'help' ||
    command === 'cli status' ||
    command === 'conversations workspace' ||
    command === 'conversations open list'
  ) {
    return [];
  }
  if (command === 'settings get' || command === 'settings set' || command === 'settings reset') return ['key'];
  if (
    command.includes(' delete') ||
    command.includes(' get') ||
    command.includes(' logs') ||
    command.includes(' rerun') ||
    command.includes(' cancel')
  ) {
    return ['id'];
  }
  if (command.startsWith('conversations')) return ['conversationId'];
  if (command.startsWith('extensions') && !['extensions reload'].includes(command)) return ['extensionId'];
  if (command === 'protocol') return ['protocolId'];
  return [];
}

function inferCliArgsSchema(command: string): Record<string, unknown> {
  const required = inferRequiredCliArgs(command);
  return {
    type: 'array',
    items: { type: 'string' },
    ...(required.length ? { minItems: required.length, description: `Positional args: ${required.join(', ')}.` } : {}),
  };
}

function inferCliFlagsSchema(
  command: string,
  contract: Pick<NeonPilotCliCommandDefinition, 'supportsDryRun' | 'mode'>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    json: { type: 'boolean', description: 'Print structured JSON output.' },
  };
  if (contract.supportsDryRun) {
    properties['dry-run'] = { type: 'boolean', description: 'Validate and describe the operation without changing runtime state.' };
  }
  if (contract.mode === 'streaming') {
    properties.follow = { type: 'boolean', description: 'Follow progress when supported.' };
    properties.format = { enum: ['text', 'json', 'jsonl'], description: 'Output format.' };
    properties['cancel-on-interrupt'] = { type: 'boolean', description: 'Cancel remote work on interrupt when supported.' };
  }
  if (command.includes('run-turn') || command.includes('send')) properties.text = { type: 'string' };
  return { type: 'object', properties, additionalProperties: true };
}

function exampleFromCliUsage(usage: string): string {
  let example = usage
    .replace(/\[--json\]/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();
  example = example
    .replace(/<key>/g, 'conversation.pinnedToolCalls')
    .replace(/<value>/g, 'false')
    .replace(/<id>/g, 'example-id')
    .replace(/<conversationId>/g, 'conversation-example')
    .replace(/<extensionId>/g, 'system-settings')
    .replace(/<protocolId>/g, 'acp')
    .replace(/<message>/g, 'Hello')
    .replace(/<shell>/g, 'echo ok')
    .replace(/<prompt>/g, 'Summarize status');
  return `neon-pilot ${example}`.replace(/\s+/g, ' ').trim();
}
