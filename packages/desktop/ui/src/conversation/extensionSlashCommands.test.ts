import { describe, expect, it } from 'vitest';

import { findExtensionSlashCommand, resolveExtensionSlashCommandResult } from './extensionSlashCommands';

const command = { extensionId: 'ext', name: 'todo', action: 'run' } as never;

describe('extensionSlashCommands', () => {
  it('finds extension slash commands and arguments', () => {
    expect(findExtensionSlashCommand('/todo add item', [command])).toEqual({ command, argument: 'add item' });
    expect(findExtensionSlashCommand('not a command', [command])).toBeNull();
    expect(findExtensionSlashCommand('/missing arg', [command])).toBeNull();
  });

  it('resolves command action results', () => {
    expect(resolveExtensionSlashCommandResult('send this')).toEqual({ kind: 'send', text: 'send this' });
    expect(resolveExtensionSlashCommandResult(null)).toEqual({ kind: 'handled', effect: 'clear' });
    expect(resolveExtensionSlashCommandResult({ replaceComposerText: 'replace' })).toEqual({ kind: 'replace', text: 'replace' });
    expect(resolveExtensionSlashCommandResult({ appendComposerText: ' more' })).toEqual({ kind: 'append', text: ' more' });
    expect(resolveExtensionSlashCommandResult({ prompt: 'prompt' })).toEqual({ kind: 'send', text: 'prompt' });
    expect(resolveExtensionSlashCommandResult({ text: 'text' })).toEqual({ kind: 'send', text: 'text' });
    expect(resolveExtensionSlashCommandResult({ notice: { tone: 'danger', text: 'bad' }, text: 'send' })).toEqual({
      kind: 'notice',
      tone: 'danger',
      text: 'bad',
      next: { kind: 'send', text: 'send' },
    });
  });
});
