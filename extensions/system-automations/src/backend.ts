export { deferredResume } from './conversationQueueBackend.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cliArgs(input: Record<string, unknown>): string[] {
  const cli = isRecord(input.cli) ? input.cli : {};
  return Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
}

function cliFlags(input: Record<string, unknown>): Record<string, string | boolean> {
  const cli = isRecord(input.cli) ? input.cli : {};
  return isRecord(cli.flags) ? (cli.flags as Record<string, string | boolean>) : {};
}

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function flagNumber(flags: Record<string, string | boolean>, key: string): number | undefined {
  const value = flagString(flags, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function flagBoolean(flags: Record<string, string | boolean>, key: string): boolean | undefined {
  const value = flags[key];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  if (['1', 'true', 'yes'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(value.toLowerCase())) return false;
  return undefined;
}

function normalizeScheduledTaskCliInput(input: unknown): unknown {
  if (!isRecord(input) || !isRecord(input.cli)) return input;
  const args = cliArgs(input);
  const flags = cliFlags(input);
  return {
    ...input,
    ...(args[0] ? { taskId: args[0] } : {}),
    ...(flagString(flags, 'profile') ? { profile: flagString(flags, 'profile') } : {}),
    ...(flagString(flags, 'title') ? { title: flagString(flags, 'title') } : {}),
    ...(flagString(flags, 'cron') ? { cron: flagString(flags, 'cron') } : {}),
    ...(flagString(flags, 'at') ? { at: flagString(flags, 'at') } : {}),
    ...(flagString(flags, 'target-type') ? { targetType: flagString(flags, 'target-type') } : {}),
    ...(flagString(flags, 'thread-mode') ? { threadMode: flagString(flags, 'thread-mode') } : {}),
    ...(flagString(flags, 'thread-conversation-id') ? { threadConversationId: flagString(flags, 'thread-conversation-id') } : {}),
    ...(flagString(flags, 'deliver-as') ? { deliverAs: flagString(flags, 'deliver-as') } : {}),
    ...(flagString(flags, 'model') ? { model: flagString(flags, 'model') } : {}),
    ...(flagString(flags, 'cwd') ? { cwd: flagString(flags, 'cwd') } : {}),
    ...(flagString(flags, 'prompt') ? { prompt: flagString(flags, 'prompt') } : {}),
    ...(flagNumber(flags, 'timeout-seconds') ? { timeoutSeconds: flagNumber(flags, 'timeout-seconds') } : {}),
    ...(flagNumber(flags, 'catch-up-window-seconds') ? { catchUpWindowSeconds: flagNumber(flags, 'catch-up-window-seconds') } : {}),
    ...(flagBoolean(flags, 'enabled') !== undefined ? { enabled: flagBoolean(flags, 'enabled') } : {}),
    ...(flagBoolean(flags, 'deliver-result-to-conversation') !== undefined
      ? { deliverResultToConversation: flagBoolean(flags, 'deliver-result-to-conversation') }
      : {}),
    ...(flagBoolean(flags, 'notify-on-success') !== undefined ? { notifyOnSuccess: flagBoolean(flags, 'notify-on-success') } : {}),
    ...(flagBoolean(flags, 'notify-on-failure') !== undefined ? { notifyOnFailure: flagBoolean(flags, 'notify-on-failure') } : {}),
    ...(flagBoolean(flags, 'require-ack') !== undefined ? { requireAck: flagBoolean(flags, 'require-ack') } : {}),
    ...(flagBoolean(flags, 'auto-resume-if-open') !== undefined ? { autoResumeIfOpen: flagBoolean(flags, 'auto-resume-if-open') } : {}),
  };
}

export async function scheduledTask(input: unknown, ctx: unknown) {
  const module = await import('./scheduledTaskBackend.js');
  return module.scheduledTask(normalizeScheduledTaskCliInput(input), ctx as never);
}
