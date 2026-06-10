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
