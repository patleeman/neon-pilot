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

export function wantsJson(args: string[]): boolean {
  return args.includes('--json');
}

export function stripJsonFlag(args: string[]): string[] {
  return args.filter((arg) => arg !== '--json');
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
  const json = wantsJson(rawArgs);
  const cleanArgs = stripJsonFlag(rawArgs);
  const parsed = parseCliFlags(cleanArgs);
  const stdinText = await readCliStdinIfRequested(parsed.flags, options?.stdin);
  return {
    definition,
    rawArgv: cleanArgs,
    args: parsed.positional,
    flags: parsed.flags,
    json,
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
  }
  return `${JSON.stringify(result, null, 2)}\n`;
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
    'Built-in commands:',
    ...builtInCommands.map((command) => `  ${command}`),
    '',
    'Examples:',
    ...examples.map((example) => `  ${example}`),
  ].join('\n');
}

export function renderCliCommandList(definitions: NeonPilotCliCommandDefinition[], json: boolean): string {
  const commands = [...definitions].sort((a, b) => a.command.localeCompare(b.command));
  if (json) return `${JSON.stringify({ commands }, null, 2)}\n`;
  return (
    [
      'Neon Pilot commands:',
      ...commands.map((command) => {
        const owner = command.source === 'extension' && command.extensionId ? ` [${command.extensionId}]` : '';
        const description = command.description ?? command.title;
        return `  ${command.command}${owner}${description ? `  ${description}` : ''}`;
      }),
    ].join('\n') + '\n'
  );
}

export function renderCliCommandHelp(definition: NeonPilotCliCommandDefinition, commandName = 'neon-pilot'): string {
  const lines = [definition.command];
  const description = definition.description ?? definition.title;
  if (description) lines.push('', description);
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

export function withDefaultCliCommandContract<T extends NeonPilotCliCommandDefinition>(definition: T): T {
  const mode = definition.mode ?? inferCliCommandMode(definition.command);
  const requiresApp = definition.requiresApp ?? inferCliCommandRequiresApp(definition.command);
  const supportsDryRun =
    definition.supportsDryRun ??
    (mode === 'write' || mode === 'destructive' || mode === 'background' || definition.command === 'conversations run-turn');
  const usage = definition.usage ?? inferCliCommandUsage(definition.command);
  const outputModes = definition.outputModes ?? (mode === 'streaming' ? ['text', 'json', 'jsonl'] : ['text', 'json']);
  return {
    ...definition,
    usage,
    examples: definition.examples ?? [exampleFromCliUsage(usage), `${exampleFromCliUsage(usage)} --json`],
    argsSchema: definition.argsSchema ?? inferCliArgsSchema(definition.command),
    flagsSchema: definition.flagsSchema ?? inferCliFlagsSchema(definition.command, { supportsDryRun, mode }),
    mode,
    requiresApp,
    destructive: definition.destructive ?? mode === 'destructive',
    idempotent: definition.idempotent ?? mode === 'read',
    startsBackgroundWork: definition.startsBackgroundWork ?? mode === 'background',
    supportsDryRun,
    outputModes,
    ...(definition.streaming ?? mode === 'streaming'
      ? { streaming: definition.streaming ?? { supportsFollow: true, supportsJsonl: outputModes.includes('jsonl'), cancelOnInterruptDefault: false } }
      : {}),
  };
}

function inferCliCommandMode(command: string): NonNullable<NeonPilotCliCommandDefinition['mode']> {
  if (command === 'conversations run-turn' || command === 'protocol') return 'streaming';
  if (
    command.startsWith('background-commands start') ||
    command.startsWith('subagents start') ||
    command.startsWith('subagents follow-up') ||
    command.startsWith('tasks run') ||
    command.startsWith('heartbeats start')
  ) {
    return 'background';
  }
  if (command.includes(' delete') || command.includes(' uninstall') || command.includes('retention prune')) return 'destructive';
  const readVerbs = new Set(['list', 'get', 'search', 'inspect', 'schema', 'doctor', 'catalog', 'paths', 'sources', 'logs', 'workspace', 'validate']);
  if (readVerbs.has(commandTokens(command).at(-1) ?? '') || command.endsWith('open list') || command.endsWith('scratchpad get')) return 'read';
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
  if (command === 'subagents start') args.push('--prompt <prompt> [--cwd <path>]');
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
  if (command.includes(' delete') || command.includes(' get') || command.includes(' logs') || command.includes(' rerun') || command.includes(' cancel')) {
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
  let example = usage.replace(/\[--json\]/g, '').replace(/\[[^\]]+\]/g, '').trim();
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
