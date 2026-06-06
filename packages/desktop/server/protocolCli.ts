import { pathToFileURL } from 'node:url';

import { getPiAgentRuntimeDir } from '@neon-pilot/core';

import { createRuntimeState } from './app/runtimeState.js';
import {
  ensureNeonPilotCliLauncher,
  getDefaultUserCliInstallPath,
  getNeonPilotCliBinDir,
  installUserCliSymlink,
} from './cliEnvironment.js';
import { getExtensionHostClient, type ExtensionHostClient } from './extensions/extensionHostClient.js';
import { createExtensionHostRpcClient } from './extensions/extensionHostRpcClient.js';
import type { ExtensionHostServerContextSnapshot } from './extensions/extensionHostServerContext.js';

export const PROTOCOL_CLI_EXIT_CODES = {
  usage: 1,
  notFound: 2,
  ambiguous: 3,
  loadFailure: 4,
  runtimeFailure: 5,
} as const;

interface CliCommandRegistration {
  extensionId: string;
  surfaceId: string;
  command: string;
  action: string;
  title?: string;
  description?: string;
  aliases?: string[];
  jsonDefault?: boolean;
}

function buildServerContextSnapshot(): ExtensionHostServerContextSnapshot {
  const repoRoot = process.cwd();
  const agentDir = getPiAgentRuntimeDir();
  const runtimeState = createRuntimeState({
    repoRoot,
    agentDir,
    logger: {
      warn: (message, fields) => {
        const suffix = fields ? ` ${JSON.stringify(fields)}` : '';
        process.stderr.write(`[protocol] ${message}${suffix}\n`);
      },
    },
  });

  return {
    runtimeScope: runtimeState.getRuntimeScope(),
    repoRoot,
    agentDir,
  };
}

function usage(): string {
  return [
    'Usage: neon-pilot <command> [args]',
    '',
    'Built-in commands:',
    '  commands [--json]             List extension-contributed CLI commands',
    '  cli status|install|uninstall  Manage the optional user-shell CLI symlink',
    '  help [command]                Show help',
    '  protocol <protocol-id> ...    Invoke a raw extension protocol entrypoint',
    '',
    'Examples:',
    '  neon-pilot commands',
    '  neon-pilot extensions list --json',
    '  neon-pilot protocol acp',
  ].join('\n');
}

function createExtensionHostClientFromEnv(): ExtensionHostClient | null {
  const baseUrl = process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL?.trim();
  const token = process.env.NEON_PILOT_EXTENSION_HOST_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return createExtensionHostRpcClient({ baseUrl, token });
}

function classifyError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('No enabled extension provides protocol entrypoint')) return PROTOCOL_CLI_EXIT_CODES.notFound;
  if (message.includes('Multiple enabled extensions provide protocol entrypoint')) return PROTOCOL_CLI_EXIT_CODES.ambiguous;
  if (message.includes('failed to compile') || message.includes('is not installed') || message.includes('has no backend entry')) {
    return PROTOCOL_CLI_EXIT_CODES.loadFailure;
  }
  return PROTOCOL_CLI_EXIT_CODES.runtimeFailure;
}

export async function runProtocolCli(argv: string[], options?: { signal?: AbortSignal }): Promise<number> {
  const [command, protocolId, ...protocolArgs] = argv;
  if (command === 'protocol') {
    if (!protocolId) {
      process.stderr.write(`${usage()}\n`);
      return PROTOCOL_CLI_EXIT_CODES.usage;
    }
    return invokeProtocolCli(protocolId, protocolArgs, options);
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    return printHelp(argv.slice(1));
  }

  if (command === 'commands') {
    return listCliCommands(argv.slice(1));
  }

  if (command === 'cli') {
    return manageCliInstall(argv.slice(1));
  }

  if (!command) {
    process.stderr.write(`${usage()}\n`);
    return PROTOCOL_CLI_EXIT_CODES.usage;
  }

  return invokeContributedCliCommand(argv, options);
}

async function manageCliInstall(args: string[]): Promise<number> {
  const [action = 'status'] = args;
  const repoRoot = process.cwd();
  const target = ensureNeonPilotCliLauncher({ repoRoot });
  const linkPath = getDefaultUserCliInstallPath();
  const payload = {
    target,
    binDir: getNeonPilotCliBinDir(),
    linkPath,
    globallyInstalled: false,
  };
  try {
    const { existsSync, lstatSync, readlinkSync, unlinkSync } = await import('node:fs');
    const isOwned = existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink() && readlinkSync(linkPath) === target;
    if (action === 'status') {
      const result = { ...payload, globallyInstalled: isOwned };
      process.stdout.write(wantsJson(args) ? `${JSON.stringify(result, null, 2)}\n` : `Neon Pilot CLI: ${target}\nUser shell link: ${isOwned ? linkPath : 'not installed'}\n`);
      return 0;
    }
    if (action === 'install') {
      const installed = installUserCliSymlink({ target });
      process.stdout.write(wantsJson(args) ? `${JSON.stringify({ ...payload, linkPath: installed, globallyInstalled: true }, null, 2)}\n` : `Installed ${installed} -> ${target}\n`);
      return 0;
    }
    if (action === 'uninstall') {
      if (isOwned) unlinkSync(linkPath);
      process.stdout.write(wantsJson(args) ? `${JSON.stringify({ ...payload, globallyInstalled: false, removed: isOwned }, null, 2)}\n` : `${isOwned ? `Removed ${linkPath}` : 'No Neon Pilot-owned user shell link found.'}\n`);
      return 0;
    }
    process.stderr.write(`Unknown cli action: ${action}\n`);
    return PROTOCOL_CLI_EXIT_CODES.usage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return PROTOCOL_CLI_EXIT_CODES.runtimeFailure;
  }
}

async function invokeProtocolCli(protocolId: string, protocolArgs: string[], options?: { signal?: AbortSignal }): Promise<number> {
  const signal = options?.signal ?? new AbortController().signal;

  try {
    const extensionHostClient = createExtensionHostClientFromEnv() ?? getExtensionHostClient();
    await extensionHostClient.invokeProtocolEntrypoint({
      protocolId,
      input: { args: protocolArgs },
      serverContextSnapshot: buildServerContextSnapshot(),
      stdio: {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      },
      signal,
      });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return classifyError(error);
  }
}

function wantsJson(args: string[]): boolean {
  return args.includes('--json');
}

function stripJsonFlag(args: string[]): string[] {
  return args.filter((arg) => arg !== '--json');
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
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

function commandTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

function commandMatches(registration: CliCommandRegistration, argv: string[]): { matched: boolean; length: number } {
  const candidates = [registration.command, ...(registration.aliases ?? [])].map(commandTokens);
  for (const candidate of candidates) {
    if (candidate.length === 0 || candidate.length > argv.length) continue;
    if (candidate.every((token, index) => argv[index] === token)) return { matched: true, length: candidate.length };
  }
  return { matched: false, length: 0 };
}

async function readCliCommandRegistrations(): Promise<CliCommandRegistration[]> {
  const extensionHostClient = createExtensionHostClientFromEnv() ?? getExtensionHostClient();
  const presentation = await extensionHostClient.readRegistryPresentation();
  return (presentation.cliCommandRegistrations ?? []).flatMap((entry): CliCommandRegistration[] => {
    if (
      typeof entry.extensionId !== 'string' ||
      typeof entry.surfaceId !== 'string' ||
      typeof entry.command !== 'string' ||
      typeof entry.action !== 'string'
    ) {
      return [];
    }
    return [
      {
        extensionId: entry.extensionId,
        surfaceId: entry.surfaceId,
        command: entry.command,
        action: entry.action,
        ...(typeof entry.title === 'string' ? { title: entry.title } : {}),
        ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
        aliases: Array.isArray(entry.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
        jsonDefault: entry.jsonDefault === true,
      },
    ];
  });
}

async function listCliCommands(args: string[]): Promise<number> {
  try {
    const registrations = await readCliCommandRegistrations();
    if (wantsJson(args)) {
      process.stdout.write(`${JSON.stringify({ commands: registrations }, null, 2)}\n`);
      return 0;
    }
    process.stdout.write(
      [
        'Neon Pilot commands:',
        ...registrations
          .sort((a, b) => a.command.localeCompare(b.command))
          .map((command) => `  ${command.command}${command.description ? `  ${command.description}` : ''}`),
      ].join('\n') + '\n',
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return classifyError(error);
  }
}

async function printHelp(args: string[]): Promise<number> {
  const helpTarget = stripJsonFlag(args).join(' ').trim();
  if (!helpTarget) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  try {
    const registrations = await readCliCommandRegistrations();
    const match = registrations.find((registration) => registration.command === helpTarget || registration.aliases?.includes(helpTarget));
    if (!match) {
      process.stderr.write(`Unknown Neon Pilot command: ${helpTarget}\n`);
      return PROTOCOL_CLI_EXIT_CODES.notFound;
    }
    process.stdout.write(`${match.command}\n${match.description ?? match.title ?? ''}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return classifyError(error);
  }
}

function formatActionResult(result: unknown, json: boolean): string {
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const record = result as Record<string, unknown>;
    if (typeof record.text === 'string') return `${record.text}\n`;
    if (typeof record.message === 'string') return `${record.message}\n`;
  }
  return `${JSON.stringify(result, null, 2)}\n`;
}

async function invokeContributedCliCommand(argv: string[], options?: { signal?: AbortSignal }): Promise<number> {
  try {
    const registrations = await readCliCommandRegistrations();
    const matches = registrations
      .map((registration) => ({ registration, ...commandMatches(registration, argv) }))
      .filter((match) => match.matched)
      .sort((a, b) => b.length - a.length);
    if (matches.length === 0) {
      process.stderr.write(`Unknown Neon Pilot command: ${argv.join(' ')}\n\n${usage()}\n`);
      return PROTOCOL_CLI_EXIT_CODES.notFound;
    }
    const bestLength = matches[0]!.length;
    const bestMatches = matches.filter((match) => match.length === bestLength);
    if (bestMatches.length > 1) {
      process.stderr.write(`Ambiguous Neon Pilot command: ${argv.slice(0, bestLength).join(' ')}\n`);
      return PROTOCOL_CLI_EXIT_CODES.ambiguous;
    }

    const match = bestMatches[0]!;
    const rawArgs = argv.slice(match.length);
    const json = wantsJson(rawArgs) || match.registration.jsonDefault === true;
    const parsed = parseFlags(stripJsonFlag(rawArgs));
    const extensionHostClient = createExtensionHostClientFromEnv() ?? getExtensionHostClient();
    const invokeResult = await extensionHostClient.invokeAction({
      extensionId: match.registration.extensionId,
      actionId: match.registration.action,
      input: {
        cli: {
          command: match.registration.command,
          rawArgv: argv,
          args: parsed.positional,
          flags: parsed.flags,
          json,
          cwd: process.cwd(),
        },
      },
      serverContextSnapshot: buildServerContextSnapshot(),
      signal: options?.signal,
    });
    if (!invokeResult.ok) throw new Error('error' in invokeResult ? invokeResult.error : 'Extension CLI command failed.');
    process.stdout.write(formatActionResult(invokeResult.result, json));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return classifyError(error);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const code = await runProtocolCli(argv);
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
