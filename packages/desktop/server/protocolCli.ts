import { pathToFileURL } from 'node:url';

import {
  actionFromCliCommand,
  buildCliInvocation,
  findCliHelpTarget,
  formatCliResult,
  getPiAgentRuntimeDir,
  getStateRoot,
  NEON_PILOT_CLI_EXIT_CODES,
  renderCliCommandHelp,
  renderCliCommandList,
  renderCliUsage,
  selectCliCommandMatch,
  stripJsonFlag,
  wantsJson,
  type NeonPilotCliCommandDefinition,
} from '@neon-pilot/core';

import { createRuntimeState } from './app/runtimeState.js';
import { readNeonPilotCliControlPlaneRecord } from './cliControlPlane.js';
import { installNeonPilotUserCli, readNeonPilotCliInstallStatus, uninstallNeonPilotUserCli } from './cliEnvironment.js';
import { type ExtensionHostClient, getExtensionHostClient } from './extensions/extensionHostClient.js';
import { createExtensionHostRpcClient } from './extensions/extensionHostRpcClient.js';
import type { ExtensionHostServerContextSnapshot } from './extensions/extensionHostServerContext.js';
import { getRuntimeSettingsFilePath } from './ui/settingsPersistence.js';

export const PROTOCOL_CLI_EXIT_CODES = NEON_PILOT_CLI_EXIT_CODES;

interface CliCommandRegistration extends NeonPilotCliCommandDefinition {
  extensionId: string;
  surfaceId: string;
  action: string;
  inputAction?: string;
}

function buildServerContextSnapshot(): ExtensionHostServerContextSnapshot {
  const repoRoot = process.cwd();
  const stateRoot = getStateRoot();
  const agentDir = getPiAgentRuntimeDir(stateRoot);
  const settingsFile = getRuntimeSettingsFilePath(stateRoot);
  const runtimeState = createRuntimeState({
    repoRoot,
    agentDir,
    settingsFile,
    stateRoot,
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
    settingsFile,
    stateRoot,
  };
}

function usage(): string {
  return renderCliUsage({
    commandName: 'neon-pilot',
    summary: 'Neon Pilot command line administration for the local runtime and enabled extensions.',
    builtInCommands: [
      'commands [--json]             List core and extension CLI commands',
      'cli status|install|uninstall  Manage the optional user-shell CLI symlink',
      'help [command]                Show help',
      'protocol <protocol-id> ...    Invoke a raw extension protocol entrypoint',
    ],
    examples: ['neon-pilot commands', 'neon-pilot help extensions list', 'neon-pilot extensions list', 'neon-pilot protocol acp'],
  });
}

const CORE_CLI_COMMANDS: NeonPilotCliCommandDefinition[] = [
  {
    id: 'commands',
    command: 'commands',
    description: 'List core and enabled extension CLI commands.',
    usage: 'commands [--json]',
    examples: ['neon-pilot commands', 'neon-pilot commands --json'],
    source: 'core',
  },
  {
    id: 'help',
    command: 'help',
    aliases: ['--help', '-h'],
    description: 'Show general help or help for a specific command.',
    usage: 'help [command]',
    examples: ['neon-pilot help', 'neon-pilot help settings list'],
    source: 'core',
  },
  {
    id: 'cli-status',
    command: 'cli status',
    description: 'Show the channel-local launcher and optional user-shell link status.',
    usage: 'cli status [--json]',
    examples: ['neon-pilot cli status', 'neon-pilot cli status --json'],
    source: 'core',
  },
  {
    id: 'cli-install',
    command: 'cli install',
    description: 'Install the optional user-shell neon-pilot symlink.',
    usage: 'cli install [--json]',
    examples: ['neon-pilot cli install'],
    source: 'core',
  },
  {
    id: 'cli-uninstall',
    command: 'cli uninstall',
    description: 'Remove the optional Neon Pilot-owned user-shell symlink.',
    usage: 'cli uninstall [--json]',
    examples: ['neon-pilot cli uninstall'],
    source: 'core',
  },
  {
    id: 'protocol',
    command: 'protocol',
    description: 'Invoke a raw extension protocol entrypoint.',
    usage: 'protocol <protocol-id> [args]',
    examples: ['neon-pilot protocol acp', 'neon-pilot protocol ds4-tools tools'],
    source: 'core',
  },
];

function createExtensionHostClientFromEnv(): ExtensionHostClient | null {
  const baseUrl = process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL?.trim();
  const token = process.env.NEON_PILOT_EXTENSION_HOST_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return createExtensionHostRpcClient({ baseUrl, token });
}

async function createExtensionHostClientFromControlPlane(): Promise<ExtensionHostClient | null> {
  const record = readNeonPilotCliControlPlaneRecord();
  if (!record) return null;
  const client = createExtensionHostRpcClient({ baseUrl: record.extensionHost.baseUrl, token: record.extensionHost.token });
  try {
    await client.health();
    return client;
  } catch {
    return null;
  }
}

async function getCliExtensionHostClient(): Promise<ExtensionHostClient> {
  const rpcClient = createExtensionHostClientFromEnv();
  if (rpcClient) return rpcClient;
  const controlPlaneClient = await createExtensionHostClientFromControlPlane();
  if (controlPlaneClient) return controlPlaneClient;
  return getExtensionHostClient();
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
  try {
    if (action === 'status') {
      const result = readNeonPilotCliInstallStatus({ repoRoot });
      process.stdout.write(
        wantsJson(args)
          ? `${JSON.stringify(result, null, 2)}\n`
          : `Neon Pilot CLI: ${result.target}\nUser shell link: ${result.globallyInstalled ? result.linkPath : 'not installed'}\n`,
      );
      return 0;
    }
    if (action === 'install') {
      const result = installNeonPilotUserCli({ repoRoot });
      process.stdout.write(wantsJson(args) ? `${JSON.stringify(result, null, 2)}\n` : `Installed ${result.linkPath} -> ${result.target}\n`);
      return 0;
    }
    if (action === 'uninstall') {
      const result = uninstallNeonPilotUserCli({ repoRoot });
      process.stdout.write(
        wantsJson(args)
          ? `${JSON.stringify(result, null, 2)}\n`
          : `${result.removed ? `Removed ${result.linkPath}` : 'No Neon Pilot-owned user shell link found.'}\n`,
      );
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
    const extensionHostClient = await getCliExtensionHostClient();
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

async function readCliCommandRegistrations(): Promise<CliCommandRegistration[]> {
  const extensionHostClient = await getCliExtensionHostClient();
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
        id: entry.surfaceId,
        extensionId: entry.extensionId,
        surfaceId: entry.surfaceId,
        command: entry.command,
        action: entry.action,
        source: 'extension',
        ...(typeof entry.inputAction === 'string' ? { inputAction: entry.inputAction } : {}),
        ...(typeof entry.title === 'string' ? { title: entry.title } : {}),
        ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
        ...(typeof entry.usage === 'string' ? { usage: entry.usage } : {}),
        ...(Array.isArray(entry.examples) ? { examples: entry.examples.filter((example): example is string => typeof example === 'string') } : {}),
        aliases: Array.isArray(entry.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
        jsonDefault: entry.jsonDefault === true,
      },
    ];
  });
}

async function listCliCommands(args: string[]): Promise<number> {
  try {
    const registrations = await readCliCommandRegistrations();
    process.stdout.write(renderCliCommandList([...CORE_CLI_COMMANDS, ...registrations], wantsJson(args)));
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
    const match = findCliHelpTarget([...CORE_CLI_COMMANDS, ...registrations], helpTarget);
    if (!match) {
      process.stderr.write(`Unknown Neon Pilot command: ${helpTarget}\n`);
      return PROTOCOL_CLI_EXIT_CODES.notFound;
    }
    process.stdout.write(renderCliCommandHelp(match));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return classifyError(error);
  }
}

async function invokeContributedCliCommand(argv: string[], options?: { signal?: AbortSignal }): Promise<number> {
  try {
    const registrations = await readCliCommandRegistrations();
    const selected = selectCliCommandMatch(registrations, argv);
    if (selected.status === 'notFound') {
      process.stderr.write(`Unknown Neon Pilot command: ${argv.join(' ')}\n\n${usage()}\n`);
      return PROTOCOL_CLI_EXIT_CODES.notFound;
    }
    if (selected.status === 'ambiguous') {
      process.stderr.write(`Ambiguous Neon Pilot command: ${selected.command}\n`);
      return PROTOCOL_CLI_EXIT_CODES.ambiguous;
    }

    const match = selected.match;
    const rawArgs = argv.slice(match.length);
    const invocation = await buildCliInvocation(match.definition, rawArgs);
    const extensionHostClient = await getCliExtensionHostClient();
    const inputAction = match.definition.inputAction ?? actionFromCliCommand(match.definition.command);
    const invokeResult = await extensionHostClient.invokeAction({
      extensionId: match.definition.extensionId,
      actionId: match.definition.action,
      input: {
        ...(inputAction ? { action: inputAction } : {}),
        cli: {
          command: match.definition.command,
          rawArgv: invocation.rawArgv,
          args: invocation.args,
          flags: invocation.flags,
          json: invocation.json,
          cwd: invocation.cwd,
          ...(invocation.stdinText !== undefined ? { stdinText: invocation.stdinText } : {}),
        },
      },
      serverContextSnapshot: buildServerContextSnapshot(),
      signal: options?.signal,
    });
    if (!invokeResult.ok) throw new Error('error' in invokeResult ? invokeResult.error : 'Extension CLI command failed.');
    process.stdout.write(formatCliResult(invokeResult.result, invocation.json));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return classifyError(error);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
  });
  const code = await runProtocolCli(argv);
  process.exitCode = code;
  if (!process.env.VITEST) process.exit(code);
}

function isProtocolCliEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  if (import.meta.url === pathToFileURL(entry).href) return true;
  return /(?:^|\/)protocolCli\.(?:ts|js)$/.test(entry);
}

if (isProtocolCliEntrypoint()) {
  void main();
}
