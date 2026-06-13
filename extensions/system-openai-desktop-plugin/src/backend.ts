import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

type JsonRecord = Record<string, unknown>;

const PLUGIN_NAME = 'neon-pilot';
const MARKETPLACE_NAME = 'neon-pilot-local';
const DISPLAY_NAME = 'Neon Pilot';
const VERSION = '0.1.1';
const MCP_SERVER_NAME = 'neon-pilot';
const MCP_TOOLS = [
  'neon_pilot_delegate',
  'neon_pilot_list_delegates',
  'neon_pilot_get_delegate',
  'neon_pilot_delegate_logs',
  'neon_pilot_follow_up',
  'neon_pilot_cancel_delegate',
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text : undefined;
}

function bool(value: unknown): boolean {
  return value === true || value === 'true';
}

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function templateRoot(): string {
  return join(packageRoot(), 'templates', 'codex-plugin');
}

function defaultMarketplaceRoot(): string {
  return join(homedir(), '.local', 'share', 'neon-pilot', 'codex-plugin-marketplace');
}

function targetPaths(input: unknown = {}): { marketplaceRoot: string; marketplacePath: string; pluginPath: string } {
  const record = isRecord(input) ? input : {};
  const marketplaceRoot = resolve(readString(record.marketplaceRoot) ?? defaultMarketplaceRoot());
  return {
    marketplaceRoot,
    marketplacePath: join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'),
    pluginPath: join(marketplaceRoot, 'plugins', PLUGIN_NAME),
  };
}

function readJsonObject(path: string): JsonRecord | null {
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return isRecord(parsed) ? parsed : null;
}

function writeJson(path: string, payload: JsonRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

function marketplaceEntry(): JsonRecord {
  return {
    name: PLUGIN_NAME,
    source: {
      source: 'local',
      path: `./plugins/${PLUGIN_NAME}`,
    },
    policy: {
      installation: 'AVAILABLE',
      authentication: 'ON_INSTALL',
    },
    category: 'Productivity',
  };
}

function ensureMarketplaceEntry(marketplacePath: string): JsonRecord {
  const existing = readJsonObject(marketplacePath);
  const payload: JsonRecord = existing ?? {
    name: MARKETPLACE_NAME,
    interface: {
      displayName: 'Neon Pilot Local',
    },
    plugins: [],
  };

  if (!Array.isArray(payload.plugins)) {
    payload.plugins = [];
  }

  const plugins = payload.plugins as unknown[];
  const nextEntry = marketplaceEntry();
  const index = plugins.findIndex((entry) => isRecord(entry) && entry.name === PLUGIN_NAME);
  if (index >= 0) {
    plugins[index] = nextEntry;
  } else {
    plugins.push(nextEntry);
  }

  writeJson(marketplacePath, payload);
  return payload;
}

function removeMarketplaceEntry(marketplacePath: string): JsonRecord | null {
  const payload = readJsonObject(marketplacePath);
  if (!payload || !Array.isArray(payload.plugins)) return payload;
  payload.plugins = payload.plugins.filter((entry) => !(isRecord(entry) && entry.name === PLUGIN_NAME));
  writeJson(marketplacePath, payload);
  return payload;
}

function installedVersion(pluginPath: string): string | null {
  const manifest = readJsonObject(join(pluginPath, '.codex-plugin', 'plugin.json'));
  return readString(manifest?.version) ?? null;
}

function mcpScriptPath(pluginPath: string): string {
  return join(pluginPath, 'mcp', 'neon-pilot-subagent.mjs');
}

type ShellResult = {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
};

async function runCodex(ctx: ExtensionBackendContext, args: string[], input: unknown): Promise<ShellResult> {
  const record = isRecord(input) ? input : {};
  const command = readString(record.codexCommand) ?? 'codex';
  const codexHome = readString(record.codexHome);
  try {
    return (await ctx.shell.exec({
      command,
      args,
      ...(codexHome ? { env: { CODEX_HOME: codexHome } } : {}),
    })) as ShellResult;
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    };
  }
}

function shellOk(result: ShellResult): boolean {
  return result.exitCode === undefined || result.exitCode === 0;
}

function parseJsonText(text: string | undefined): unknown {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function codexError(result: ShellResult): string {
  return [result.stderr, result.stdout].filter((text) => text?.trim()).join('\n').trim() || `codex exited ${result.exitCode ?? 'unknown'}`;
}

function shouldManageCodex(input: unknown): boolean {
  return !isRecord(input) || input.manageCodex !== false;
}

export async function status(input: unknown, ctx?: ExtensionBackendContext): Promise<JsonRecord> {
  const paths = targetPaths(input);
  const marketplace = readJsonObject(paths.marketplacePath);
  const entryInstalled = Array.isArray(marketplace?.plugins)
    ? marketplace.plugins.some((entry) => isRecord(entry) && entry.name === PLUGIN_NAME)
    : false;
  const pluginInstalled = existsSync(join(paths.pluginPath, '.codex-plugin', 'plugin.json'));
  let codex: JsonRecord = { checked: false };
  if (ctx && shouldManageCodex(input)) {
    const marketplaces = await runCodex(ctx, ['plugin', 'marketplace', 'list'], input);
    const plugins = await runCodex(ctx, ['plugin', 'list', '--json'], input);
    const mcpServer = await runCodex(ctx, ['mcp', 'get', MCP_SERVER_NAME], input);
    const parsedPlugins = parseJsonText(plugins.stdout);
    const installedPlugins = isRecord(parsedPlugins) && Array.isArray(parsedPlugins.installed) ? parsedPlugins.installed : [];
    const pluginId = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;
    const mcpText = [mcpServer.stdout, mcpServer.stderr].filter((text) => text?.trim()).join('\n');
    codex = {
      checked: true,
      marketplaceRegistered: Boolean(marketplaces.stdout?.includes(MARKETPLACE_NAME)),
      pluginEnabled: installedPlugins.some((entry) => isRecord(entry) && entry.pluginId === pluginId && entry.enabled === true),
      pluginInstalled: installedPlugins.some((entry) => isRecord(entry) && entry.pluginId === pluginId && entry.installed === true),
      mcp: {
        checked: true,
        serverName: MCP_SERVER_NAME,
        registered: shellOk(mcpServer) && mcpText.includes(MCP_SERVER_NAME) && mcpText.includes('enabled: true'),
        tools: MCP_TOOLS,
        detail: mcpText,
      },
    };
  }
  return {
    ok: true,
    pluginName: PLUGIN_NAME,
    displayName: DISPLAY_NAME,
    version: VERSION,
    installed: pluginInstalled && entryInstalled && (codex.checked === true ? codex.pluginInstalled === true : true),
    pluginInstalled,
    marketplaceEntryInstalled: entryInstalled,
    marketplaceName: MARKETPLACE_NAME,
    marketplaceRoot: paths.marketplaceRoot,
    marketplacePath: paths.marketplacePath,
    pluginPath: paths.pluginPath,
    installedVersion: installedVersion(paths.pluginPath),
    codex,
  };
}

export async function installPlugin(input: unknown, ctx?: ExtensionBackendContext): Promise<JsonRecord> {
  const paths = targetPaths(input);
  const force = bool(isRecord(input) ? input.force : false);
  if (existsSync(paths.pluginPath) && force) {
    rmSync(paths.pluginPath, { recursive: true, force: true });
  }
  mkdirSync(dirname(paths.pluginPath), { recursive: true });
  cpSync(templateRoot(), paths.pluginPath, { recursive: true, force: true });
  const marketplace = ensureMarketplaceEntry(paths.marketplacePath);
  const codexSteps: JsonRecord[] = [];
  if (ctx && shouldManageCodex(input)) {
    const addMarketplace = await runCodex(ctx, ['plugin', 'marketplace', 'add', paths.marketplaceRoot, '--json'], input);
    codexSteps.push({ command: 'plugin marketplace add', ok: shellOk(addMarketplace), stdout: addMarketplace.stdout, stderr: addMarketplace.stderr });
    if (!shellOk(addMarketplace) && !codexError(addMarketplace).includes('already')) {
      throw new Error(`Failed to register Codex marketplace: ${codexError(addMarketplace)}`);
    }

    const addPlugin = await runCodex(ctx, ['plugin', 'add', `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, '--json'], input);
    codexSteps.push({ command: 'plugin add', ok: shellOk(addPlugin), stdout: addPlugin.stdout, stderr: addPlugin.stderr });
    if (!shellOk(addPlugin)) {
      throw new Error(`Failed to install Codex plugin: ${codexError(addPlugin)}`);
    }

    const addMcp = await runCodex(ctx, ['mcp', 'add', MCP_SERVER_NAME, '--', 'node', mcpScriptPath(paths.pluginPath)], input);
    codexSteps.push({ command: 'mcp add', ok: shellOk(addMcp), stdout: addMcp.stdout, stderr: addMcp.stderr });
    if (!shellOk(addMcp)) {
      throw new Error(`Failed to register Codex MCP server: ${codexError(addMcp)}`);
    }
  }
  return {
    ok: true,
    installed: true,
    pluginName: PLUGIN_NAME,
    version: VERSION,
    marketplaceName: MARKETPLACE_NAME,
    marketplaceRoot: paths.marketplaceRoot,
    marketplacePath: paths.marketplacePath,
    pluginPath: paths.pluginPath,
    marketplace,
    codexSteps,
  };
}

export async function removePlugin(input: unknown, ctx?: ExtensionBackendContext): Promise<JsonRecord> {
  const paths = targetPaths(input);
  const codexSteps: JsonRecord[] = [];
  if (ctx && shouldManageCodex(input)) {
    const removeMcpResult = await runCodex(ctx, ['mcp', 'remove', MCP_SERVER_NAME], input);
    codexSteps.push({
      command: 'mcp remove',
      ok: shellOk(removeMcpResult),
      stdout: removeMcpResult.stdout,
      stderr: removeMcpResult.stderr,
    });

    const removePluginResult = await runCodex(ctx, ['plugin', 'remove', `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, '--json'], input);
    codexSteps.push({
      command: 'plugin remove',
      ok: shellOk(removePluginResult),
      stdout: removePluginResult.stdout,
      stderr: removePluginResult.stderr,
    });

    const removeMarketplaceResult = await runCodex(ctx, ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME, '--json'], input);
    codexSteps.push({
      command: 'plugin marketplace remove',
      ok: shellOk(removeMarketplaceResult),
      stdout: removeMarketplaceResult.stdout,
      stderr: removeMarketplaceResult.stderr,
    });
  }
  rmSync(paths.pluginPath, { recursive: true, force: true });
  const marketplace = removeMarketplaceEntry(paths.marketplacePath);
  return {
    ok: true,
    installed: false,
    pluginName: PLUGIN_NAME,
    marketplaceName: MARKETPLACE_NAME,
    marketplaceRoot: paths.marketplaceRoot,
    marketplacePath: paths.marketplacePath,
    pluginPath: paths.pluginPath,
    marketplace,
    codexSteps,
  };
}
