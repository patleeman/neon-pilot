import { parseSlashInput } from '../commands/slashMenu';

const DEFERRED_RESUME_SLASH_USAGE = 'Usage: /resume <delay> [--follow-up] [prompt]';
const DEFERRED_RESUME_SLASH_COMMANDS = new Set(['/resume', '/defer']);
const DEFERRED_RESUME_DELAY_UNITS = new Set([
  's',
  'sec',
  'secs',
  'second',
  'seconds',
  'm',
  'min',
  'mins',
  'minute',
  'minutes',
  'h',
  'hr',
  'hrs',
  'hour',
  'hours',
  'd',
  'day',
  'days',
]);

interface DeferredResumeSlashCommand {
  action: 'schedule';
  delay: string;
  prompt?: string;
  behavior?: 'followUp';
}

type DeferredResumeSlashParseResult = { kind: 'command'; command: DeferredResumeSlashCommand } | { kind: 'invalid'; message: string };

export function parseDeferredResumeSlashCommand(input: string): DeferredResumeSlashParseResult | null {
  const parsed = parseSlashInput(input.trim());
  if (!parsed || !DEFERRED_RESUME_SLASH_COMMANDS.has(parsed.command)) {
    return null;
  }

  const argument = parsed.argument.trim();
  if (argument.length === 0) {
    return { kind: 'invalid', message: DEFERRED_RESUME_SLASH_USAGE };
  }

  const tokens = argument.split(/\s+/);
  const delayToken = tokens[0]?.trim() ?? '';
  const secondToken = tokens[1]?.trim().toLowerCase() ?? '';
  const hasSeparatedUnit = /^\d+$/.test(delayToken) && DEFERRED_RESUME_DELAY_UNITS.has(secondToken);
  const delay = hasSeparatedUnit ? `${delayToken} ${secondToken}` : delayToken;
  const restTokens = hasSeparatedUnit ? tokens.slice(2) : tokens.slice(1);
  if (!delay) {
    return { kind: 'invalid', message: DEFERRED_RESUME_SLASH_USAGE };
  }

  const firstRestToken = restTokens[0]?.trim().toLowerCase();
  const behavior = firstRestToken === '--follow-up' || firstRestToken === '--followup' ? ('followUp' as const) : undefined;
  const promptTokens = behavior ? restTokens.slice(1) : restTokens;
  const prompt = promptTokens.join(' ').trim();
  return {
    kind: 'command',
    command: {
      action: 'schedule',
      delay,
      ...(behavior ? { behavior } : {}),
      ...(prompt ? { prompt } : {}),
    },
  };
}
