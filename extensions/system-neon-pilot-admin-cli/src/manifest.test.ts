import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PKG_ROOT = resolve(import.meta.dirname, '..');
const EXTENSION_JSON_PATH = resolve(PKG_ROOT, 'extension.json');

describe('system-neon-pilot-admin-cli manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('keeps admin CLI positional and required flag schemas aligned with backend normalization', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

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
});
