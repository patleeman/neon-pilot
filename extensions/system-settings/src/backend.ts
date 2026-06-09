import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  installNeonPilotUserCli,
  readNeonPilotCliInstallStatus,
  uninstallNeonPilotUserCli,
} from '@neon-pilot/extensions/backend/cli';
import {
  readExtensionSettings,
  readExtensionSettingsSchema,
  resetExtensionSettings,
  updateExtensionSettings,
  type ExtensionSettingRegistration,
} from '@neon-pilot/extensions/backend/settings';

type CliEnvelope = {
  cli?: {
    command?: unknown;
    args?: unknown;
    flags?: unknown;
  };
};

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function cliArgs(input: Record<string, unknown>): string[] {
  const cli = asRecord((input as CliEnvelope).cli);
  return Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
}

function cliCommand(input: Record<string, unknown>): string {
  const cli = asRecord((input as CliEnvelope).cli);
  return typeof cli.command === 'string' ? cli.command : '';
}

function parseCliValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function schemaByKey(schema: ExtensionSettingRegistration[]): Map<string, ExtensionSettingRegistration> {
  return new Map(schema.map((entry) => [entry.key, entry]));
}

function formatSettingsList(settings: Record<string, unknown>, schema: ExtensionSettingRegistration[]): string {
  const schemaMap = schemaByKey(schema);
  return Object.keys(settings)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const description = schemaMap.get(key)?.description;
      return `${key}=${JSON.stringify(settings[key])}${description ? `  ${description}` : ''}`;
    })
    .join('\n');
}

export async function manageSettings(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const command = cliCommand(body);
  const args = cliArgs(body);
  const action = typeof body.action === 'string' ? body.action : command.split(/\s+/).at(-1) || 'list';

  if (action === 'schema') {
    const schema = await readExtensionSettingsSchema();
    return { schema, text: JSON.stringify({ schema }, null, 2) };
  }

  if (action === 'list') {
    const [prefix] = args;
    const [settings, schema] = await Promise.all([readExtensionSettings(), readExtensionSettingsSchema()]);
    const filtered = prefix
      ? Object.fromEntries(Object.entries(settings).filter(([key]) => key === prefix || key.startsWith(`${prefix}.`)))
      : settings;
    return { settings: filtered, text: formatSettingsList(filtered, schema) };
  }

  if (action === 'get') {
    const key = args[0];
    if (!key) throw new Error('setting key is required.');
    const settings = await readExtensionSettings();
    return { key, value: settings[key], text: `${key}=${JSON.stringify(settings[key])}` };
  }

  if (action === 'set') {
    const [key, rawValue] = args;
    if (!key) throw new Error('setting key is required.');
    if (rawValue === undefined) throw new Error('setting value is required.');
    const schema = await readExtensionSettingsSchema();
    if (!schemaByKey(schema).has(key)) throw new Error(`Unknown setting: ${key}`);
    const settings = await updateExtensionSettings({ [key]: parseCliValue(rawValue) });
    return { key, value: settings[key], settings, text: `Set ${key}=${JSON.stringify(settings[key])}` };
  }

  if (action === 'reset') {
    const keys = args.map((key) => key.trim()).filter(Boolean);
    if (keys.length === 0) throw new Error('at least one setting key is required.');
    const schema = await readExtensionSettingsSchema();
    const known = schemaByKey(schema);
    for (const key of keys) if (!known.has(key)) throw new Error(`Unknown setting: ${key}`);
    const settings = await resetExtensionSettings(keys);
    return { keys, settings, text: `Reset ${keys.join(', ')}.` };
  }

  throw new Error(`Unsupported settings action: ${action}`);
}

export async function manageCli(input: unknown, _ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const action = typeof body.action === 'string' ? body.action : 'status';
  if (action === 'status') return readNeonPilotCliInstallStatus();
  if (action === 'install') return installNeonPilotUserCli();
  if (action === 'uninstall') return uninstallNeonPilotUserCli();
  throw new Error(`Unsupported CLI action: ${action}`);
}
