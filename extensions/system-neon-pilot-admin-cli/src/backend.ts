import type { ExtensionBackendContext } from '@neon-pilot/extensions';

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function cliArgs(input: Record<string, unknown>): string[] {
  const cli = asRecord(input.cli);
  return Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
}

function cliCommand(input: Record<string, unknown>): string {
  const cli = asRecord(input.cli);
  return typeof cli.command === 'string' ? cli.command : '';
}

function cliFlags(input: Record<string, unknown>): Record<string, unknown> {
  return asRecord(asRecord(input.cli).flags);
}

function flagString(flags: Record<string, unknown>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseJsonFlag(flags: Record<string, unknown>, key: string): unknown {
  const value = flagString(flags, key);
  if (!value) return undefined;
  return JSON.parse(value);
}

function normalizeCommandInput(input: unknown): Record<string, unknown> {
  const body = asRecord(input);
  const command = cliCommand(body);
  const args = cliArgs(body);
  const flags = cliFlags(body);
  if (command === 'app-commands list') return { ...body, action: 'list' };
  if (command === 'app-commands run') {
    return {
      ...body,
      action: 'run',
      commandId: args[0],
      args: parseJsonFlag(flags, 'args') ?? (args.length > 1 ? args.slice(1) : undefined),
    };
  }
  if (command === 'control-plane doctor') return { ...body, action: 'doctor' };
  return body;
}

async function check(name: string, run: () => Promise<unknown>) {
  const startedAt = Date.now();
  try {
    const result = await run();
    return { name, ok: true, durationMs: Date.now() - startedAt, result };
  } catch (error) {
    return { name, ok: false, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) };
  }
}

function countArray(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

export async function controlPlaneDoctor(_input: unknown, ctx: ExtensionBackendContext) {
  const checks = await Promise.all([
    check('app_commands_list', async () => ({ count: countArray(await ctx.commands.list()) })),
    check('conversations_list', async () => ({ count: countArray(await ctx.conversations.list()) })),
    check('conversations_workspace', async () => ctx.conversations.getWorkspace()),
    check('conversations_retention_dry_run', async () =>
      ctx.conversations.prune({ olderThanMs: 365_000 * 86_400_000, dryRun: true, archivedOnly: true }),
    ),
    check('runtime_repo_root', async () => ({ repoRoot: ctx.runtime.getRepoRoot() })),
    check('storage_round_trip', async () => {
      const key = `control-plane-doctor/${Date.now()}`;
      await ctx.storage.put(key, { ok: true });
      const stored = await ctx.storage.get(key);
      await ctx.storage.delete(key);
      return { stored: Boolean(stored) };
    }),
  ]);
  return { ok: checks.every((entry) => entry.ok), checks };
}

export async function manageAppCommands(input: unknown, ctx: ExtensionBackendContext) {
  const body = normalizeCommandInput(input);
  const action = typeof body.action === 'string' ? body.action : 'list';
  if (action === 'list') {
    const commands = await ctx.commands.list();
    return { ok: true, commands };
  }
  if (action === 'run') {
    const commandId = typeof body.commandId === 'string' ? body.commandId.trim() : '';
    if (!commandId) throw new Error('command id is required.');
    const executed = await ctx.commands.execute(commandId, body.args);
    return { ok: executed, commandId, executed };
  }
  throw new Error(`Unsupported app command action: ${action}`);
}
