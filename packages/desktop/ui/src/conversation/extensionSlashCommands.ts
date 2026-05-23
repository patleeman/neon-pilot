import { parseSlashInput } from '../commands/slashMenu';
import type { ExtensionSlashCommandRegistration } from '../extensions/types';

export type ExtensionSlashCommandResult =
  | { kind: 'handled'; effect: 'clear' | 'none' }
  | { kind: 'send'; text: string }
  | { kind: 'replace'; text: string }
  | { kind: 'append'; text: string }
  | { kind: 'notice'; tone: 'accent' | 'danger'; text: string; next: ExtensionSlashCommandResult };

export function findExtensionSlashCommand(
  text: string,
  commands: ExtensionSlashCommandRegistration[],
): { command: ExtensionSlashCommandRegistration; argument: string } | null {
  const parsed = parseSlashInput(text.trim());
  if (!parsed) {
    return null;
  }

  const name = parsed.command.slice(1);
  const command = commands.find((candidate) => candidate.name === name);
  return command ? { command, argument: parsed.argument } : null;
}

export function resolveExtensionSlashCommandResult(result: unknown): ExtensionSlashCommandResult {
  if (typeof result === 'string') {
    return { kind: 'send', text: result };
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { kind: 'handled', effect: 'clear' };
  }

  const payload = result as {
    text?: unknown;
    prompt?: unknown;
    replaceComposerText?: unknown;
    appendComposerText?: unknown;
    notice?: { tone?: unknown; text?: unknown };
  };
  const next = resolveExtensionSlashCommandPayload(payload);
  if (typeof payload.notice?.text === 'string') {
    return {
      kind: 'notice',
      tone: payload.notice.tone === 'danger' ? 'danger' : 'accent',
      text: payload.notice.text,
      next,
    };
  }
  return next;
}

function resolveExtensionSlashCommandPayload(payload: {
  text?: unknown;
  prompt?: unknown;
  replaceComposerText?: unknown;
  appendComposerText?: unknown;
}): ExtensionSlashCommandResult {
  if (typeof payload.replaceComposerText === 'string') {
    return { kind: 'replace', text: payload.replaceComposerText };
  }
  if (typeof payload.appendComposerText === 'string') {
    return { kind: 'append', text: payload.appendComposerText };
  }
  if (typeof payload.prompt === 'string') {
    return { kind: 'send', text: payload.prompt };
  }
  if (typeof payload.text === 'string') {
    return { kind: 'send', text: payload.text };
  }
  return { kind: 'handled', effect: 'clear' };
}
