import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

const PLUGIN_NAME = 'neon-pilot';
const MARKETPLACE_NAME = 'personal';
const DISPLAY_NAME = 'Neon Pilot';
const VERSION = '0.1.0';

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
  return join(homedir(), '.agents', 'plugins');
}

function targetPaths(input: unknown = {}): { marketplaceRoot: string; marketplacePath: string; pluginPath: string } {
  const record = isRecord(input) ? input : {};
  const marketplaceRoot = resolve(readString(record.marketplaceRoot) ?? defaultMarketplaceRoot());
  return {
    marketplaceRoot,
    marketplacePath: join(marketplaceRoot, 'marketplace.json'),
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
      displayName: 'Personal',
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

export async function status(input: unknown): Promise<JsonRecord> {
  const paths = targetPaths(input);
  const marketplace = readJsonObject(paths.marketplacePath);
  const entryInstalled = Array.isArray(marketplace?.plugins)
    ? marketplace.plugins.some((entry) => isRecord(entry) && entry.name === PLUGIN_NAME)
    : false;
  const pluginInstalled = existsSync(join(paths.pluginPath, '.codex-plugin', 'plugin.json'));
  return {
    ok: true,
    pluginName: PLUGIN_NAME,
    displayName: DISPLAY_NAME,
    version: VERSION,
    installed: pluginInstalled && entryInstalled,
    pluginInstalled,
    marketplaceEntryInstalled: entryInstalled,
    marketplacePath: paths.marketplacePath,
    pluginPath: paths.pluginPath,
    installedVersion: installedVersion(paths.pluginPath),
  };
}

export async function installPlugin(input: unknown): Promise<JsonRecord> {
  const paths = targetPaths(input);
  const force = bool(isRecord(input) ? input.force : false);
  if (existsSync(paths.pluginPath) && force) {
    rmSync(paths.pluginPath, { recursive: true, force: true });
  }
  mkdirSync(dirname(paths.pluginPath), { recursive: true });
  cpSync(templateRoot(), paths.pluginPath, { recursive: true, force: true });
  const marketplace = ensureMarketplaceEntry(paths.marketplacePath);
  return {
    ok: true,
    installed: true,
    pluginName: PLUGIN_NAME,
    version: VERSION,
    marketplacePath: paths.marketplacePath,
    pluginPath: paths.pluginPath,
    marketplace,
  };
}

export async function removePlugin(input: unknown): Promise<JsonRecord> {
  const paths = targetPaths(input);
  rmSync(paths.pluginPath, { recursive: true, force: true });
  const marketplace = removeMarketplaceEntry(paths.marketplacePath);
  return {
    ok: true,
    installed: false,
    pluginName: PLUGIN_NAME,
    marketplacePath: paths.marketplacePath,
    pluginPath: paths.pluginPath,
    marketplace,
  };
}

