import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';

import {
  actionFromCliCommand,
  buildCliCommandSchema,
  buildCliInvocation,
  commandTokens,
  findCliHelpTarget,
  formatCliTable,
  formatCliError,
  formatCliResult,
  getPiAgentRuntimeDir,
  resolveNeonPilotRuntimeChannel,
  getStateRoot,
  NEON_PILOT_CLI_EXIT_CODES,
  renderCliCommandHelp,
  renderCliCommandList,
  renderCliUsage,
  selectCliCommandMatch,
  stripCliGlobalFlags,
  stripJsonFlag,
  validateCliInvocation,
  wantsJson,
  withDefaultCliCommandContract,
  type NeonPilotCliCommandDefinition,
} from '@neon-pilot/core';

import { createRuntimeState } from './app/runtimeState.js';
import { readNeonPilotCliControlPlaneRecord } from './cliControlPlane.js';
import { installNeonPilotUserCli, readNeonPilotCliInstallStatus, uninstallNeonPilotUserCli } from './cliEnvironment.js';
import {
  createCliFallbackExtensionHostClient,
  type ExtensionHostClient,
  getExtensionHostClient,
} from './extensions/extensionHostClient.js';
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
      'schema [--json]               Export CLI command contracts',
      'doctor [--json]               Check CLI/runtime readiness',
      'paths [--json]                Show local runtime paths',
      'version [--json]              Show CLI package/runtime version',
      'cli status|install|uninstall  Manage the optional user-shell CLI symlink',
      'help [command]                Show help',
    ],
    examples: [
      'neon-pilot ask "Summarize this repo"',
      'neon-pilot commands',
      'neon-pilot help extensions list',
      'neon-pilot commands --verbose',
    ],
  });
}

const CORE_CLI_COMMANDS: NeonPilotCliCommandDefinition[] = [
  {
    id: 'commands',
    command: 'commands',
    aliases: ['ls'],
    description: 'List core and enabled extension CLI commands.',
    usage: 'commands [--json] [--quiet] [--verbose] [--no-color]',
    examples: ['neon-pilot commands', 'neon-pilot commands --json'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: {
      type: 'object',
      properties: {
        json: { type: 'boolean' },
        quiet: { type: 'boolean' },
        verbose: { type: 'boolean' },
        'no-color': { type: 'boolean' },
      },
      additionalProperties: false,
    },
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['text', 'json'],
    smoke: { argv: ['commands'], expectHumanIncludes: ['Neon Pilot commands:'], expectJsonFields: ['commands'] },
    source: 'core',
  },
  {
    id: 'schema',
    command: 'schema',
    aliases: ['commands schema'],
    description: 'Export machine-readable CLI command contracts.',
    usage: 'schema [--json]',
    examples: ['neon-pilot schema --json'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: { type: 'object', properties: { json: { type: 'boolean' } }, additionalProperties: false },
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['json'],
    smoke: { argv: ['schema', '--json'], expectJsonFields: ['commands'] },
    source: 'core',
  },
  {
    id: 'help',
    command: 'help',
    aliases: ['--help', '-h', '?'],
    description: 'Show general help or help for a specific command.',
    usage: 'help [command] [--json]',
    examples: ['neon-pilot help', 'neon-pilot help settings list'],
    argsSchema: { type: 'array', items: { type: 'string' } },
    flagsSchema: { type: 'object', properties: { json: { type: 'boolean' } }, additionalProperties: false },
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['text', 'json'],
    smoke: { argv: ['help'], expectHumanIncludes: ['Usage: neon-pilot <command> [args]'] },
    source: 'core',
  },
  {
    id: 'doctor',
    command: 'doctor',
    aliases: ['runtime doctor'],
    description: 'Check CLI launcher, app connection, and runtime path readiness.',
    usage: 'doctor [--json] [--verbose]',
    examples: ['neon-pilot doctor', 'neon-pilot doctor --json'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: { type: 'object', properties: { json: { type: 'boolean' }, verbose: { type: 'boolean' } }, additionalProperties: false },
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['text', 'json'],
    smoke: { argv: ['doctor'], expectHumanIncludes: ['Neon Pilot CLI doctor:'], expectJsonFields: ['checks'] },
    source: 'core',
  },
  {
    id: 'paths',
    command: 'paths',
    aliases: ['runtime paths'],
    description: 'Show local Neon Pilot runtime paths used by the CLI.',
    usage: 'paths [--json]',
    examples: ['neon-pilot paths', 'neon-pilot paths --json'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: { type: 'object', properties: { json: { type: 'boolean' } }, additionalProperties: false },
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['text', 'json'],
    smoke: { argv: ['paths'], expectHumanIncludes: ['stateRoot'], expectJsonFields: ['stateRoot'] },
    source: 'core',
  },
  {
    id: 'version',
    command: 'version',
    aliases: ['--version', '-v'],
    description: 'Show Neon Pilot CLI package and runtime channel version information.',
    usage: 'version [--json]',
    examples: ['neon-pilot version', 'neon-pilot version --json'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: { type: 'object', properties: { json: { type: 'boolean' } }, additionalProperties: false },
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['text', 'json'],
    smoke: { argv: ['version'], expectHumanIncludes: ['Neon Pilot'], expectJsonFields: ['version'] },
    source: 'core',
  },
  {
    id: 'cli-status',
    command: 'cli status',
    aliases: ['cli'],
    description: 'Show the channel-local launcher and optional user-shell link status.',
    usage: 'cli status [--json]',
    examples: ['neon-pilot cli status', 'neon-pilot cli status --json'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: { type: 'object', properties: { json: { type: 'boolean' } }, additionalProperties: false },
    mode: 'read',
    requiresApp: false,
    idempotent: true,
    outputModes: ['text', 'json'],
    smoke: { argv: ['cli', 'status'], expectHumanIncludes: ['Neon Pilot CLI:'], expectJsonFields: ['target', 'binDir'] },
    source: 'core',
  },
  {
    id: 'cli-install',
    command: 'cli install',
    description: 'Install the optional user-shell neon-pilot symlink.',
    usage: 'cli install [--json]',
    examples: ['neon-pilot cli install'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: {
      type: 'object',
      properties: {
        json: { type: 'boolean' },
        'dry-run': { type: 'boolean', description: 'Show the link that would be installed without changing the filesystem.' },
      },
      additionalProperties: false,
    },
    mode: 'write',
    requiresApp: false,
    idempotent: true,
    supportsDryRun: true,
    outputModes: ['text', 'json'],
    source: 'core',
  },
  {
    id: 'cli-uninstall',
    command: 'cli uninstall',
    description: 'Remove the optional Neon Pilot-owned user-shell symlink.',
    usage: 'cli uninstall [--json]',
    examples: ['neon-pilot cli uninstall'],
    argsSchema: { type: 'array', items: false, maxItems: 0 },
    flagsSchema: {
      type: 'object',
      properties: {
        json: { type: 'boolean' },
        'dry-run': { type: 'boolean', description: 'Show the link that would be removed without changing the filesystem.' },
      },
      additionalProperties: false,
    },
    mode: 'write',
    requiresApp: false,
    idempotent: true,
    supportsDryRun: true,
    outputModes: ['text', 'json'],
    source: 'core',
  },
  {
    id: 'protocol',
    command: 'protocol',
    description:
      'Invoke a raw extension protocol entrypoint. Advanced integration surface; prefer first-class CLI commands for normal automation.',
    usage: 'protocol <protocol-id> [args]',
    examples: ['neon-pilot protocol acp', 'neon-pilot protocol ds4-tools tools'],
    argsSchema: {
      type: 'array',
      prefixItems: [{ type: 'string', description: 'Protocol entrypoint id.' }],
      items: { type: 'string' },
      minItems: 1,
    },
    flagsSchema: { type: 'object', additionalProperties: true },
    mode: 'streaming',
    requiresApp: true,
    idempotent: false,
    outputModes: ['text'],
    streaming: { supportsFollow: true, supportsJsonl: false, cancelOnInterruptDefault: true },
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
  if (process.env.NEON_PILOT_FORCE_SOURCE_CLI === '1') {
    return createCliFallbackExtensionHostClient();
  }
  const rpcClient = createExtensionHostClientFromEnv();
  if (rpcClient) return rpcClient;
  const controlPlaneClient = await createExtensionHostClientFromControlPlane();
  if (controlPlaneClient) return controlPlaneClient;
  try {
    return getExtensionHostClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Extension host client is not configured')) throw error;
    return createCliFallbackExtensionHostClient();
  }
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

function classifyErrorCategory(error: unknown): 'not_found' | 'ambiguous' | 'load_failure' | 'runtime_failure' {
  const code = classifyError(error);
  if (code === PROTOCOL_CLI_EXIT_CODES.notFound) return 'not_found';
  if (code === PROTOCOL_CLI_EXIT_CODES.ambiguous) return 'ambiguous';
  if (code === PROTOCOL_CLI_EXIT_CODES.loadFailure) return 'load_failure';
  return 'runtime_failure';
}

function writeCliError(input: Parameters<typeof formatCliError>[0], json: boolean): void {
  process.stderr.write(formatCliError(input, json));
}

function outputFormat(flags: Record<string, string | boolean>): 'text' | 'json' | 'jsonl' {
  return flags.format === 'json' || flags.format === 'jsonl' ? flags.format : 'text';
}

function formatCliActionResult(result: unknown, json: boolean, flags: Record<string, string | boolean>, quiet = false): string {
  if (quiet && !json && outputFormat(flags) === 'text') return '';
  const format = outputFormat(flags);
  if (format === 'jsonl') return `${JSON.stringify({ event: 'result', data: result })}\n`;
  return formatCliResult(result, json || format === 'json');
}

function writeCliActionResult(
  result: unknown,
  invocation: { json: boolean; quiet?: boolean; flags: Record<string, string | boolean> },
): void {
  const text = formatCliActionResult(result, invocation.json, invocation.flags, invocation.quiet === true);
  if (text) process.stdout.write(text);
}

function formatCliStreamUpdate(update: unknown, format: 'text' | 'json' | 'jsonl'): string {
  if (format === 'jsonl') return `${JSON.stringify({ event: 'update', data: update })}\n`;
  if (format === 'json') return '';
  const record = update && typeof update === 'object' && !Array.isArray(update) ? (update as Record<string, unknown>) : {};
  const content = Array.isArray(record.content) ? record.content : [];
  const text = content
    .map((item) =>
      item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : '',
    )
    .join('');
  return text ? `${text}\n` : '';
}

function cliGlobalFlagArgs(argv: string[]): string[] {
  return argv.filter((arg) => ['--json', '--quiet', '--verbose', '--no-color'].includes(arg));
}

export async function runProtocolCli(argv: string[], options?: { signal?: AbortSignal }): Promise<number> {
  const commandArgv = stripCliGlobalFlags(argv);
  const selectedCore = selectCliCommandMatch(CORE_CLI_COMMANDS, commandArgv);
  if (selectedCore.status === 'ambiguous') {
    writeCliError(
      {
        code: 'ambiguous_command',
        category: 'ambiguous',
        message: `Ambiguous Neon Pilot command: ${selectedCore.command}`,
        command: selectedCore.command,
      },
      wantsJson(argv),
    );
    return PROTOCOL_CLI_EXIT_CODES.ambiguous;
  }
  if (selectedCore.status === 'matched') {
    const command = selectedCore.match.definition.command;
    const args = commandArgv.slice(selectedCore.match.length);
    if (command === 'protocol') {
      const [protocolId, ...protocolArgs] = args;
      if (!protocolId) {
        if (wantsJson(argv)) {
          writeCliError(
            {
              code: 'usage_error',
              category: 'usage',
              message: 'protocol id is required.',
              command: 'protocol',
              hint: 'Run neon-pilot help protocol.',
            },
            true,
          );
        } else {
          process.stderr.write(`${usage()}\n`);
        }
        return PROTOCOL_CLI_EXIT_CODES.usage;
      }
      return invokeProtocolCli(protocolId, protocolArgs, options);
    }
    if (command === 'help') return printHelp(args, argv);
    if (command === 'commands') return listCliCommands(args, argv);
    if (command === 'schema') return printCliSchema(args, argv);
    if (command === 'doctor') return printCliDoctor(args, argv);
    if (command === 'paths') return printCliPaths(args, argv);
    if (command === 'version') return printCliVersion(args, argv);
    if (command === 'cli status' || command === 'cli install' || command === 'cli uninstall') {
      return manageCliInstall(commandTokens(command).slice(1).concat(args), argv);
    }
  }
  const [command] = commandArgv;
  if (command === 'protocol') {
    if (!commandArgv[1]) {
      if (wantsJson(argv)) {
        writeCliError(
          {
            code: 'usage_error',
            category: 'usage',
            message: 'protocol id is required.',
            command: 'protocol',
            hint: 'Run neon-pilot help protocol.',
          },
          true,
        );
      } else {
        process.stderr.write(`${usage()}\n`);
      }
      return PROTOCOL_CLI_EXIT_CODES.usage;
    }
    return invokeProtocolCli(commandArgv[1], commandArgv.slice(2), options);
  }

  if (!command) {
    if (wantsJson(argv)) {
      writeCliError({ code: 'usage_error', category: 'usage', message: 'command is required.', hint: 'Run neon-pilot help.' }, true);
    } else {
      process.stderr.write(`${usage()}\n`);
    }
    return PROTOCOL_CLI_EXIT_CODES.usage;
  }

  return invokeContributedCliCommand(argv, options);
}

async function manageCliInstall(args: string[], rawArgs = args): Promise<number> {
  const [action = 'status'] = args;
  const repoRoot = process.cwd();
  const dryRun = args.includes('--dry-run');
  try {
    if (action === 'status') {
      const result = readNeonPilotCliInstallStatus({ repoRoot });
      if (!rawArgs.includes('--quiet'))
        process.stdout.write(
          wantsJson(rawArgs)
            ? `${JSON.stringify(result, null, 2)}\n`
            : `Neon Pilot CLI: ${result.target}\nUser shell link: ${result.globallyInstalled ? result.linkPath : 'not installed'}\n`,
        );
      return 0;
    }
    if (action === 'install') {
      if (dryRun) {
        const result = readNeonPilotCliInstallStatus({ repoRoot });
        if (!rawArgs.includes('--quiet'))
          process.stdout.write(
            formatCliResult(
              {
                ok: true,
                dryRun: true,
                command: 'cli install',
                ...result,
                text: `Dry run: would install ${result.linkPath} -> ${result.target}`,
              },
              wantsJson(rawArgs),
            ),
          );
        return 0;
      }
      const result = installNeonPilotUserCli({ repoRoot });
      if (!rawArgs.includes('--quiet')) {
        process.stdout.write(
          wantsJson(rawArgs) ? `${JSON.stringify(result, null, 2)}\n` : `Installed ${result.linkPath} -> ${result.target}\n`,
        );
      }
      return 0;
    }
    if (action === 'uninstall') {
      if (dryRun) {
        const result = readNeonPilotCliInstallStatus({ repoRoot });
        if (!rawArgs.includes('--quiet'))
          process.stdout.write(
            formatCliResult(
              { ok: true, dryRun: true, command: 'cli uninstall', ...result, text: `Dry run: would remove ${result.linkPath}` },
              wantsJson(rawArgs),
            ),
          );
        return 0;
      }
      const result = uninstallNeonPilotUserCli({ repoRoot });
      if (!rawArgs.includes('--quiet'))
        process.stdout.write(
          wantsJson(rawArgs)
            ? `${JSON.stringify(result, null, 2)}\n`
            : `${result.removed ? `Removed ${result.linkPath}` : 'No Neon Pilot-owned user shell link found.'}\n`,
        );
      return 0;
    }
    writeCliError(
      {
        code: 'unknown_cli_action',
        category: 'usage',
        message: `Unknown cli action: ${action}`,
        command: `cli ${action}`,
        hint: 'Run neon-pilot help cli status.',
      },
      wantsJson(rawArgs),
    );
    return PROTOCOL_CLI_EXIT_CODES.usage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeCliError({ code: 'cli_runtime_error', category: 'runtime_failure', message, command: `cli ${action}` }, wantsJson(rawArgs));
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
    writeCliError(
      {
        code: 'protocol_error',
        category: classifyErrorCategory(error),
        message,
        command: `protocol ${protocolId}`,
        hint: 'Run neon-pilot commands --json.',
      },
      wantsJson(protocolArgs),
    );
    return classifyError(error);
  }
}

function cliCommandRegistrationFromEntry(entry: Record<string, unknown>): CliCommandRegistration[] {
  const surfaceId = typeof entry.surfaceId === 'string' ? entry.surfaceId : typeof entry.id === 'string' ? entry.id : '';
  if (typeof entry.extensionId !== 'string' || !surfaceId || typeof entry.command !== 'string' || typeof entry.action !== 'string') {
    return [];
  }
  return [
    withDefaultCliCommandContract<CliCommandRegistration>({
      id: surfaceId,
      extensionId: entry.extensionId,
      surfaceId,
      command: entry.command,
      action: entry.action,
      source: 'extension',
      ...(typeof entry.inputAction === 'string' ? { inputAction: entry.inputAction } : {}),
      ...(typeof entry.title === 'string' ? { title: entry.title } : {}),
      ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
      ...(typeof entry.intent === 'string' ? { intent: entry.intent } : {}),
      ...(Array.isArray(entry.audience)
        ? {
            audience: entry.audience.filter(
              (audience): audience is NonNullable<NeonPilotCliCommandDefinition['audience']>[number] =>
                audience === 'human' || audience === 'external-agent' || audience === 'internal-agent' || audience === 'extension-author',
            ),
          }
        : {}),
      ...(entry.stability === 'public' ||
      entry.stability === 'advanced' ||
      entry.stability === 'internal' ||
      entry.stability === 'deprecated'
        ? { stability: entry.stability }
        : {}),
      ...(Array.isArray(entry.recommendedFor)
        ? { recommendedFor: entry.recommendedFor.filter((item): item is string => typeof item === 'string') }
        : {}),
      ...(Array.isArray(entry.notFor) ? { notFor: entry.notFor.filter((item): item is string => typeof item === 'string') } : {}),
      ...(Array.isArray(entry.preferredOver)
        ? { preferredOver: entry.preferredOver.filter((item): item is string => typeof item === 'string') }
        : {}),
      ...(typeof entry.usage === 'string' ? { usage: entry.usage } : {}),
      ...(Array.isArray(entry.examples)
        ? { examples: entry.examples.filter((example): example is string => typeof example === 'string') }
        : {}),
      ...(entry.argsSchema && typeof entry.argsSchema === 'object' && !Array.isArray(entry.argsSchema)
        ? { argsSchema: entry.argsSchema as Record<string, unknown> }
        : {}),
      ...(entry.flagsSchema && typeof entry.flagsSchema === 'object' && !Array.isArray(entry.flagsSchema)
        ? { flagsSchema: entry.flagsSchema as Record<string, unknown> }
        : {}),
      ...(typeof entry.mode === 'string' ? { mode: entry.mode as NeonPilotCliCommandDefinition['mode'] } : {}),
      ...(typeof entry.requiresApp === 'boolean' ? { requiresApp: entry.requiresApp } : {}),
      ...(typeof entry.destructive === 'boolean' ? { destructive: entry.destructive } : {}),
      ...(typeof entry.idempotent === 'boolean' ? { idempotent: entry.idempotent } : {}),
      ...(typeof entry.startsBackgroundWork === 'boolean' ? { startsBackgroundWork: entry.startsBackgroundWork } : {}),
      ...(typeof entry.supportsDryRun === 'boolean' ? { supportsDryRun: entry.supportsDryRun } : {}),
      ...(Array.isArray(entry.outputModes)
        ? {
            outputModes: entry.outputModes.filter(
              (mode): mode is 'text' | 'json' | 'jsonl' => mode === 'text' || mode === 'json' || mode === 'jsonl',
            ),
          }
        : {}),
      ...(entry.streaming && typeof entry.streaming === 'object' && !Array.isArray(entry.streaming)
        ? { streaming: entry.streaming as NeonPilotCliCommandDefinition['streaming'] }
        : {}),
      ...(entry.smoke && typeof entry.smoke === 'object' && !Array.isArray(entry.smoke)
        ? { smoke: entry.smoke as NeonPilotCliCommandDefinition['smoke'] }
        : {}),
      aliases: Array.isArray(entry.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
      jsonDefault: entry.jsonDefault === true,
    }),
  ];
}

function readSystemManifestCliCommandRegistrations(): CliCommandRegistration[] {
  const extensionsRoot = join(process.cwd(), 'extensions');
  if (!existsSync(extensionsRoot)) return [];
  return readdirSync(extensionsRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const manifestPath = join(extensionsRoot, entry.name, 'extension.json');
    if (!existsSync(manifestPath)) return [];
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
      const extensionId = typeof manifest.id === 'string' ? manifest.id : entry.name;
      const contributes =
        manifest.contributes && typeof manifest.contributes === 'object' && !Array.isArray(manifest.contributes)
          ? (manifest.contributes as Record<string, unknown>)
          : {};
      const cliCommands = Array.isArray(contributes.cliCommands) ? contributes.cliCommands : [];
      return cliCommands.flatMap((command): CliCommandRegistration[] =>
        command && typeof command === 'object' && !Array.isArray(command)
          ? cliCommandRegistrationFromEntry({ ...(command as Record<string, unknown>), extensionId })
          : [],
      );
    } catch {
      return [];
    }
  });
}

async function readCliCommandRegistrations(): Promise<CliCommandRegistration[]> {
  try {
    const extensionHostClient = await getCliExtensionHostClient();
    const presentation = await extensionHostClient.readRegistryPresentation();
    return (presentation.cliCommandRegistrations ?? []).flatMap((entry): CliCommandRegistration[] =>
      entry && typeof entry === 'object' && !Array.isArray(entry) ? cliCommandRegistrationFromEntry(entry as Record<string, unknown>) : [],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Extension host client is not configured')) return readSystemManifestCliCommandRegistrations();
    throw error;
  }
}

async function allCliCommandDefinitions(): Promise<NeonPilotCliCommandDefinition[]> {
  return [...CORE_CLI_COMMANDS.map((command) => withDefaultCliCommandContract(command)), ...(await readCliCommandRegistrations())];
}

async function listCliCommands(args: string[], rawArgs = args): Promise<number> {
  try {
    const definitions = await allCliCommandDefinitions();
    if (!rawArgs.includes('--quiet'))
      process.stdout.write(renderCliCommandList(definitions, wantsJson(rawArgs), { verbose: rawArgs.includes('--verbose') }));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeCliError({ code: 'commands_error', category: classifyErrorCategory(error), message, command: 'commands' }, wantsJson(rawArgs));
    return classifyError(error);
  }
}

async function printCliSchema(args: string[], rawArgs = args): Promise<number> {
  try {
    const validation = validateBuiltinInvocation('schema', args, rawArgs);
    if (!validation.ok) return validation.code;
    process.stdout.write(`${JSON.stringify(buildCliCommandSchema(await allCliCommandDefinitions()), null, 2)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeCliError({ code: 'schema_error', category: classifyErrorCategory(error), message, command: 'schema' }, wantsJson(rawArgs));
    return classifyError(error);
  }
}

function cliPathsResult(): Record<string, unknown> {
  const stateRoot = getStateRoot();
  const agentDir = getPiAgentRuntimeDir(stateRoot);
  return {
    repoRoot: process.cwd(),
    stateRoot,
    agentDir,
    settingsFile: getRuntimeSettingsFilePath(stateRoot),
    runtimeChannel: resolveNeonPilotRuntimeChannel(),
  };
}

async function printCliPaths(args: string[], rawArgs = args): Promise<number> {
  const validation = validateBuiltinInvocation('paths', args, rawArgs);
  if (!validation.ok) return validation.code;
  const result = cliPathsResult();
  process.stdout.write(
    wantsJson(rawArgs)
      ? `${JSON.stringify(result, null, 2)}\n`
      : formatCliTable([result], ['repoRoot', 'stateRoot', 'agentDir', 'settingsFile', 'runtimeChannel']),
  );
  return 0;
}

function readPackageVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf-8')) as { version?: unknown };
    return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function printCliVersion(args: string[], rawArgs = args): Promise<number> {
  const validation = validateBuiltinInvocation('version', args, rawArgs);
  if (!validation.ok) return validation.code;
  const result = { name: 'neon-pilot', version: readPackageVersion(), runtimeChannel: resolveNeonPilotRuntimeChannel() };
  process.stdout.write(
    wantsJson(rawArgs) ? `${JSON.stringify(result, null, 2)}\n` : `Neon Pilot ${result.version} (${result.runtimeChannel})\n`,
  );
  return 0;
}

async function printCliDoctor(args: string[], rawArgs = args): Promise<number> {
  const validation = validateBuiltinInvocation('doctor', args, rawArgs);
  if (!validation.ok) return validation.code;
  const repoRoot = process.cwd();
  const installStatus = readNeonPilotCliInstallStatus({ repoRoot });
  let appConnected = false;
  let appError: string | undefined;
  try {
    const client = await createExtensionHostClientFromControlPlane();
    appConnected = Boolean(client);
  } catch (error) {
    appError = error instanceof Error ? error.message : String(error);
  }
  const paths = cliPathsResult();
  const checks = [
    { name: 'repoRoot', ok: true, detail: repoRoot },
    { name: 'launcher', ok: true, detail: installStatus.target },
    {
      name: 'userShellLink',
      ok: installStatus.globallyInstalled,
      detail: installStatus.globallyInstalled ? installStatus.linkPath : 'not installed',
    },
    { name: 'appConnection', ok: appConnected, detail: appConnected ? 'connected' : (appError ?? 'not running') },
    { name: 'stateRoot', ok: true, detail: String(paths.stateRoot) },
  ];
  const result = {
    ok: checks.every((check) => check.ok || check.name === 'userShellLink' || check.name === 'appConnection'),
    checks,
    paths,
  };
  if (wantsJson(rawArgs)) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`Neon Pilot CLI doctor:\n${formatCliTable(checks, ['name', 'ok', 'detail'])}`);
  }
  return 0;
}

function validateBuiltinInvocation(command: string, args: string[], rawArgs = args): { ok: true } | { ok: false; code: number } {
  const definition = CORE_CLI_COMMANDS.find((candidate) => candidate.command === command);
  if (!definition) return { ok: true };
  const validation = validateCliInvocation({
    definition,
    rawArgv: stripCliGlobalFlags(args),
    args: stripCliGlobalFlags(args).filter((arg) => !arg.startsWith('--')),
    flags: Object.fromEntries(
      stripCliGlobalFlags(args)
        .filter((arg) => arg.startsWith('--'))
        .map((arg) => [arg.slice(2), true]),
    ),
    json: wantsJson(rawArgs),
    quiet: rawArgs.includes('--quiet'),
    verbose: rawArgs.includes('--verbose'),
    color: !rawArgs.includes('--no-color'),
    cwd: process.cwd(),
  });
  if (validation.ok) return { ok: true };
  writeCliError(
    { code: 'usage_error', category: 'usage', message: validation.errors.join(' '), command, hint: `Run neon-pilot help ${command}.` },
    wantsJson(rawArgs),
  );
  return { ok: false, code: PROTOCOL_CLI_EXIT_CODES.usage };
}

async function printHelp(args: string[], rawArgs = args): Promise<number> {
  const helpTarget = stripJsonFlag(args).join(' ').trim();
  if (!helpTarget) {
    process.stdout.write(wantsJson(rawArgs) ? `${JSON.stringify({ usage: usage() }, null, 2)}\n` : `${usage()}\n`);
    return 0;
  }
  try {
    const match = findCliHelpTarget(await allCliCommandDefinitions(), helpTarget);
    if (!match) {
      writeCliError(
        {
          code: 'unknown_command',
          category: 'not_found',
          message: `Unknown Neon Pilot command: ${helpTarget}`,
          command: helpTarget,
          hint: 'Run neon-pilot commands.',
        },
        wantsJson(rawArgs),
      );
      return PROTOCOL_CLI_EXIT_CODES.notFound;
    }
    process.stdout.write(wantsJson(rawArgs) ? `${JSON.stringify(match, null, 2)}\n` : renderCliCommandHelp(match));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeCliError({ code: 'help_error', category: classifyErrorCategory(error), message, command: helpTarget }, wantsJson(rawArgs));
    return classifyError(error);
  }
}

async function confirmDestructiveCommand(
  definition: NeonPilotCliCommandDefinition,
  invocation: { flags: Record<string, string | boolean>; json: boolean },
): Promise<boolean> {
  if (!definition.destructive) return true;
  if (invocation.flags.yes === true) return true;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    writeCliError(
      {
        code: 'confirmation_required',
        category: 'usage',
        message: `${definition.command} is destructive. Re-run with --yes to confirm, or use --dry-run first.`,
        command: definition.command,
        hint: `neon-pilot ${definition.command} --dry-run`,
      },
      invocation.json,
    );
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Run destructive command "${definition.command}"? Type yes to continue: `);
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function invokeContributedCliCommand(argv: string[], options?: { signal?: AbortSignal }): Promise<number> {
  try {
    const registrations = await readCliCommandRegistrations();
    const commandArgv = stripCliGlobalFlags(argv);
    const selected = selectCliCommandMatch(registrations, commandArgv);
    if (selected.status === 'notFound') {
      const message = `Unknown Neon Pilot command: ${commandArgv.join(' ')}`;
      if (wantsJson(argv)) {
        writeCliError(
          {
            code: 'unknown_command',
            category: 'not_found',
            message,
            command: commandArgv.join(' '),
            hint: 'Run neon-pilot commands --json.',
          },
          true,
        );
      } else {
        process.stderr.write(`${message}\n\n${usage()}\n`);
      }
      return PROTOCOL_CLI_EXIT_CODES.notFound;
    }
    if (selected.status === 'ambiguous') {
      writeCliError(
        {
          code: 'ambiguous_command',
          category: 'ambiguous',
          message: `Ambiguous Neon Pilot command: ${selected.command}`,
          command: selected.command,
        },
        wantsJson(argv),
      );
      return PROTOCOL_CLI_EXIT_CODES.ambiguous;
    }

    const match = selected.match;
    const rawArgs = [...commandArgv.slice(match.length), ...cliGlobalFlagArgs(argv)];
    const invocation = await buildCliInvocation(match.definition, rawArgs);
    const validation = validateCliInvocation(invocation);
    if (!validation.ok) {
      writeCliError(
        {
          code: 'usage_error',
          category: 'usage',
          message: validation.errors.join(' '),
          command: match.definition.command,
          hint: `Run neon-pilot help ${match.definition.command}.`,
        },
        invocation.json,
      );
      return PROTOCOL_CLI_EXIT_CODES.usage;
    }
    const requestedFormat = outputFormat(invocation.flags);
    if (requestedFormat !== 'text' && !(match.definition.outputModes ?? []).includes(requestedFormat)) {
      writeCliError(
        {
          code: 'unsupported_output_format',
          category: 'usage',
          message: `${match.definition.command} does not support --format ${requestedFormat}.`,
          command: match.definition.command,
          hint: `Supported output modes: ${(match.definition.outputModes ?? ['text']).join(', ')}.`,
        },
        invocation.json,
      );
      return PROTOCOL_CLI_EXIT_CODES.usage;
    }
    if (invocation.flags.yes === true && !match.definition.destructive) {
      writeCliError(
        {
          code: 'unsupported_confirmation',
          category: 'usage',
          message: `${match.definition.command} is not destructive and does not accept --yes.`,
          command: match.definition.command,
        },
        invocation.json,
      );
      return PROTOCOL_CLI_EXIT_CODES.usage;
    }
    if (invocation.flags['dry-run'] === true) {
      if (!match.definition.supportsDryRun) {
        writeCliError(
          {
            code: 'unsupported_dry_run',
            category: 'usage',
            message: `${match.definition.command} does not support --dry-run.`,
            command: match.definition.command,
            hint: `Run neon-pilot help ${match.definition.command}.`,
          },
          invocation.json,
        );
        return PROTOCOL_CLI_EXIT_CODES.usage;
      }
      writeCliActionResult(
        {
          ok: true,
          dryRun: true,
          command: match.definition.command,
          text: `Dry run: ${match.definition.command} would run with args ${JSON.stringify(invocation.args)} and flags ${JSON.stringify(invocation.flags)}.`,
        },
        invocation,
      );
      return 0;
    }
    if (!(await confirmDestructiveCommand(match.definition, invocation))) {
      return PROTOCOL_CLI_EXIT_CODES.usage;
    }
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
      ...(match.definition.mode === 'streaming'
        ? {
            toolContext: {
              onUpdate: (update: unknown) => {
                const text = formatCliStreamUpdate(update, requestedFormat);
                if (text && !invocation.quiet) process.stdout.write(text);
              },
            },
          }
        : {}),
      signal: options?.signal,
    });
    if (!invokeResult.ok) throw new Error('error' in invokeResult ? invokeResult.error : 'Extension CLI command failed.');
    writeCliActionResult(invokeResult.result, invocation);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeCliError({ code: 'command_error', category: classifyErrorCategory(error), message, command: argv.join(' ') }, wantsJson(argv));
    return classifyError(error);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
  });
  try {
    const code = await runProtocolCli(argv);
    process.exitCode = code;
  } finally {
    const { disposeExtensionBackendWorkers } = await import('./extensions/extensionBackend.js');
    await disposeExtensionBackendWorkers();
  }
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
