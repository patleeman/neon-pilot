import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PKG_ROOT = resolve(import.meta.dirname, '..');
const EXTENSION_JSON_PATH = resolve(PKG_ROOT, 'extension.json');

describe('system-neon-pilot-admin-cli manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('keeps admin CLI positional and required flag schemas aligned with backend normalization', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

    expect(commands.get('app update')).toMatchObject({
      usage: 'app update [--channel stable|rc] [--app-dir /Applications] [--repo owner/name] [--dry-run] [--json]',
      argsSchema: { maxItems: 0 },
      flagsSchema: { properties: { 'dry-run': { type: 'boolean' } } },
      supportsDryRun: true,
    });
    expect(commands.get('app-commands run')).toMatchObject({
      usage: 'app-commands run <commandId> [args...] [--args <json>] [--json]',
      argsSchema: { minItems: 1 },
      flagsSchema: { properties: { args: { type: 'string' } } },
    });
    expect(commands.get('heartbeats start')).toMatchObject({
      usage: 'heartbeats start <id> --interval-minutes <n> --conversation-id <id> --prompt <prompt> [--json]',
      argsSchema: { minItems: 1, maxItems: 1 },
      flagsSchema: {
        required: ['interval-minutes', 'conversation-id', 'prompt'],
        properties: {
          'interval-minutes': { type: 'string', minLength: 1 },
          'conversation-id': { type: 'string', minLength: 1 },
          prompt: { type: 'string', minLength: 1 },
        },
      },
    });
  });

  it('keeps bootstrap CLI positional schemas aligned with agent backend normalization', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

    for (const command of [
      'app-commands list',
      'control-plane doctor',
      'heartbeats list',
      'bootstrap doctor',
      'bootstrap configure',
      'bootstrap defaults set',
    ]) {
      expect(commands.get(command)).toMatchObject({ argsSchema: { maxItems: 0 } });
    }

    expect(commands.get('bootstrap provider set-key')).toMatchObject({
      usage: 'bootstrap provider set-key <provider> --stdin [--json]',
      argsSchema: { minItems: 1, maxItems: 1, description: 'Positional args: provider.' },
      flagsSchema: { properties: { stdin: { type: 'boolean' } } },
    });
    expect(commands.get('bootstrap provider save')).toMatchObject({
      usage: 'bootstrap provider save <provider> [--base-url <url>] [--api <api>] [--json]',
      argsSchema: { minItems: 1, maxItems: 1, description: 'Positional args: provider.' },
    });
    expect(commands.get('bootstrap provider model')).toMatchObject({
      usage: 'bootstrap provider model <provider> <modelId> [--context-window <tokens>] [--json]',
      argsSchema: { minItems: 2, maxItems: 2, description: 'Positional args: provider modelId.' },
      flagsSchema: { properties: { 'context-window': { type: 'string' } } },
    });
  });
});
