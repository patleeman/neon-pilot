import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { installPlugin, removePlugin, status } from './backend';

const execFileAsync = promisify(execFile);

function makeCtx() {
  return {
    shell: {
      async exec(input: { command: string; args?: string[]; env?: Record<string, string> }) {
        const { stdout, stderr } = await execFileAsync(input.command, input.args ?? [], {
          env: { ...process.env, ...(input.env ?? {}) },
          maxBuffer: 1024 * 1024 * 8,
        });
        return {
          command: input.command,
          args: input.args ?? [],
          stdout,
          stderr,
          executionWrappers: [],
        };
      },
    },
  } as never;
}

describe('OpenAI Desktop plugin installer', () => {
  it('passes Codex JSON flags before positional plugin arguments', async () => {
    const marketplaceRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-codex-marketplace-'));
    const calls: Array<{ command: string; args: string[] }> = [];
    const ctx = {
      shell: {
        async exec(input: { command: string; args?: string[] }) {
          calls.push({ command: input.command, args: input.args ?? [] });
          return { stdout: '{}', stderr: '', executionWrappers: [] };
        },
      },
    } as never;

    await installPlugin({ marketplaceRoot, force: true }, ctx);
    await removePlugin({ marketplaceRoot }, ctx);

    expect(calls.map((call) => call.args)).toEqual([
      ['plugin', 'marketplace', 'add', '--json', marketplaceRoot],
      ['plugin', 'add', '--json', 'neon-pilot@neon-pilot-local'],
      ['mcp', 'add', 'neon-pilot', '--', 'node', join(marketplaceRoot, 'plugins', 'neon-pilot', 'mcp', 'neon-pilot-subagent.mjs')],
      ['mcp', 'remove', 'neon-pilot'],
      ['plugin', 'remove', '--json', 'neon-pilot@neon-pilot-local'],
      ['plugin', 'marketplace', 'remove', '--json', 'neon-pilot-local'],
    ]);
  });

  it('installs into a Codex CLI marketplace and removes cleanly', async () => {
    const marketplaceRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-codex-marketplace-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'neon-pilot-codex-home-'));
    const ctx = makeCtx();

    const before = await status({ marketplaceRoot, codexHome }, ctx);
    expect(before.installed).toBe(false);
    expect(before.codex).toMatchObject({ checked: true, marketplaceRegistered: false, pluginInstalled: false });

    const installed = await installPlugin({ marketplaceRoot, codexHome, force: true }, ctx);
    expect(installed.installed).toBe(true);
    expect(existsSync(join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json'))).toBe(true);
    expect(existsSync(join(marketplaceRoot, 'plugins', 'neon-pilot', '.codex-plugin', 'plugin.json'))).toBe(true);
    expect(installed.codexSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'plugin marketplace add', ok: true }),
        expect.objectContaining({ command: 'plugin add', ok: true }),
        expect.objectContaining({ command: 'mcp add', ok: true }),
      ]),
    );

    const after = await status({ marketplaceRoot, codexHome }, ctx);
    expect(after.installed).toBe(true);
    expect(after.installedVersion).toBe('0.1.1');
    expect(after.codex).toMatchObject({ checked: true, marketplaceRegistered: true, pluginInstalled: true, pluginEnabled: true });
    expect(after.codex).toMatchObject({
      mcp: {
        checked: true,
        serverName: 'neon-pilot',
        registered: true,
        tools: expect.arrayContaining(['neon_pilot_delegate', 'neon_pilot_list_delegates', 'neon_pilot_wait_any_delegate']),
      },
    });

    const { stdout: mcpList } = await execFileAsync('codex', ['mcp', 'list'], {
      env: { ...process.env, CODEX_HOME: codexHome },
      maxBuffer: 1024 * 1024,
    });
    expect(mcpList).toContain('neon-pilot');
    expect(mcpList).toContain(join(marketplaceRoot, 'plugins', 'neon-pilot', 'mcp', 'neon-pilot-subagent.mjs'));

    const removed = await removePlugin({ marketplaceRoot, codexHome }, ctx);
    expect(removed.installed).toBe(false);
    expect(removed.codexSteps).toEqual(expect.arrayContaining([expect.objectContaining({ command: 'mcp remove', ok: true })]));
    expect(existsSync(join(marketplaceRoot, 'plugins', 'neon-pilot', '.codex-plugin', 'plugin.json'))).toBe(false);

    const final = await status({ marketplaceRoot, codexHome }, ctx);
    expect(final.installed).toBe(false);
    expect(final.codex).toMatchObject({ checked: true, marketplaceRegistered: false, pluginInstalled: false });
    expect(final.codex).toMatchObject({ mcp: { registered: false } });
  });
});
