import { describe, expect, it, vi } from 'vitest';

import { controlPlaneDoctor, manageAppCommands } from './backend.js';

function ctx(overrides: Record<string, unknown> = {}) {
  const storage = new Map<string, unknown>();
  return {
    commands: {
      list: vi.fn().mockResolvedValue([{ id: 'cmd-1' }]),
      execute: vi.fn().mockResolvedValue(true),
    },
    conversations: {
      list: vi.fn().mockResolvedValue([{ id: 'conv-1' }]),
      getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['conv-1'] }),
      prune: vi.fn().mockResolvedValue({ ok: true, dryRun: true, candidates: [] }),
    },
    runtime: {
      getRepoRoot: vi.fn().mockReturnValue('/repo'),
    },
    storage: {
      put: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
        return { ok: true };
      }),
      get: vi.fn(async (key: string) => storage.get(key) ?? null),
      delete: vi.fn(async (key: string) => ({ ok: true, deleted: storage.delete(key) })),
    },
    ...overrides,
  } as never;
}

describe('system-neon-pilot-admin-cli backend', () => {
  it('normalizes app command CLI list and run inputs', async () => {
    const context = ctx();
    await expect(manageAppCommands({ cli: { command: 'app-commands list' } }, context)).resolves.toEqual({
      ok: true,
      commands: [{ id: 'cmd-1' }],
    });

    await expect(
      manageAppCommands({ cli: { command: 'app-commands run', args: ['cmd-1'], flags: { args: '{"value":1}' } } }, context),
    ).resolves.toEqual({ ok: true, commandId: 'cmd-1', executed: true });
    expect((context as { commands: { execute: ReturnType<typeof vi.fn> } }).commands.execute).toHaveBeenCalledWith('cmd-1', { value: 1 });
  });

  it('runs non-destructive control-plane doctor checks', async () => {
    const context = ctx();
    const result = await controlPlaneDoctor({}, context);
    expect(result.ok).toBe(true);
    expect(result.checks.map((check) => check.name)).toEqual([
      'app_commands_list',
      'conversations_list',
      'conversations_workspace',
      'conversations_retention_dry_run',
      'runtime_repo_root',
      'storage_round_trip',
    ]);
    expect((context as { conversations: { prune: ReturnType<typeof vi.fn> } }).conversations.prune).toHaveBeenCalledWith({
      olderThanMs: 365 * 86_400_000,
      dryRun: true,
      archivedOnly: true,
    });
  });
});
