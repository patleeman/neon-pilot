import { describe, expect, it, vi } from 'vitest';

import { createHostCommands, evaluateCommandEnablement, listHostCommands, normalizeLegacyCommand } from './commands';

describe('extension commands', () => {
  it('normalizes legacy host command strings', () => {
    expect(normalizeLegacyCommand('navigate:/settings')).toEqual({ command: 'app.navigate', args: { to: '/settings' } });
    expect(normalizeLegacyCommand('commandPalette:threads')).toEqual({ command: 'palette.open', args: { scope: 'threads' } });
    expect(normalizeLegacyCommand('layout:workbench')).toEqual({ command: 'layout.set', args: { mode: 'workbench' } });
    expect(normalizeLegacyCommand('rightRail:system-browser/browser-tabs')).toEqual({
      command: 'rail.open',
      args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
    });
  });

  it('evaluates the intentionally tiny enablement language', () => {
    const context = { 'speechmic.connected': true, 'layout.mode': 'workbench', 'conversation.isStreaming': false };
    expect(evaluateCommandEnablement('speechmic.connected', context)).toBe(true);
    expect(evaluateCommandEnablement('!conversation.isStreaming', context)).toBe(true);
    expect(evaluateCommandEnablement('layout.mode == workbench', context)).toBe(true);
    expect(evaluateCommandEnablement('layout.mode != compact', context)).toBe(true);
    expect(evaluateCommandEnablement('missing.context', context)).toBe(false);
  });

  it('includes hardware-friendly composer and dictation commands', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['composer.submit', 'dictation.toggle']));

    const submitComposer = vi.fn(() => true);
    const toggleDictation = vi.fn(() => true);
    const commands = createHostCommands({
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      submitComposer,
      toggleDictation,
    });

    await expect(Promise.resolve(commands.find((command) => command.id === 'composer.submit')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'dictation.toggle')?.execute(undefined))).resolves.toBe(true);
    expect(submitComposer).toHaveBeenCalledTimes(1);
    expect(toggleDictation).toHaveBeenCalledTimes(1);
  });
});
