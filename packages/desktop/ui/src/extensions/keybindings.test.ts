// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { findMatchingExtensionKeybinding, isShortcutCaptureEventTarget } from './keybindings';
import type { ExtensionKeybindingRegistration } from './types';

const keybindings: ExtensionKeybindingRegistration[] = [
  {
    extensionId: 'system-conversation-tools',
    surfaceId: 'open-thread-palette',
    packageType: 'system',
    title: 'Open thread palette',
    keys: ['mod+k', 'mod+p'],
    command: 'palette.open',
    args: { scope: 'threads' },
    scope: 'global',
    defaultKeys: ['mod+k', 'mod+p'],
    enabled: true,
  },
  {
    extensionId: 'system-conversation-tools',
    surfaceId: 'open-command-palette',
    packageType: 'system',
    title: 'Open command palette',
    keys: ['mod+shift+p'],
    command: 'palette.open',
    args: { scope: 'commands' },
    scope: 'global',
    defaultKeys: ['mod+shift+p'],
    enabled: true,
  },
  {
    extensionId: 'system-conversation-tools',
    surfaceId: 'submit-composer',
    packageType: 'system',
    title: 'Submit composer',
    keys: ['mod+enter'],
    command: 'composer.submit',
    when: 'composer.focused',
    scope: 'global',
    defaultKeys: ['mod+enter'],
    enabled: true,
  },
  {
    extensionId: 'system-test',
    surfaceId: 'open-specific',
    packageType: 'system',
    title: 'Open specific palette',
    keys: ['mod+ctrl+p'],
    command: 'palette.open',
    args: { scope: 'specific' },
    scope: 'global',
    defaultKeys: ['mod+ctrl+p'],
    enabled: true,
  },
];

describe('extension keybindings', () => {
  it('keeps Cmd+P and Cmd+Shift+P distinct', () => {
    expect(
      findMatchingExtensionKeybinding({ key: 'k', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }, keybindings)?.args,
    ).toEqual({ scope: 'threads' });

    expect(
      findMatchingExtensionKeybinding({ key: 'p', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }, keybindings)?.args,
    ).toEqual({ scope: 'threads' });

    expect(
      findMatchingExtensionKeybinding({ key: 'P', metaKey: true, ctrlKey: false, altKey: false, shiftKey: true }, keybindings)?.args,
    ).toEqual({ scope: 'commands' });
  });

  it('honors declared keybinding context conditions', () => {
    const event = { key: 'Enter', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };

    expect(findMatchingExtensionKeybinding(event, keybindings, { 'composer.focused': false })).toBeNull();
    expect(findMatchingExtensionKeybinding(event, keybindings, { 'composer.focused': true })?.command).toBe('composer.submit');
  });

  it('does not collapse explicit ctrl/meta modifiers into mod', () => {
    const specificOnly = keybindings.filter((keybinding) => keybinding.surfaceId === 'open-specific');

    expect(
      findMatchingExtensionKeybinding({ key: 'p', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }, specificOnly),
    ).toBeNull();
    expect(
      findMatchingExtensionKeybinding({ key: 'p', metaKey: false, ctrlKey: true, altKey: false, shiftKey: false }, specificOnly),
    ).toBeNull();
    expect(
      findMatchingExtensionKeybinding({ key: 'p', metaKey: true, ctrlKey: true, altKey: false, shiftKey: false }, specificOnly)?.args,
    ).toEqual({ scope: 'specific' });
  });

  it('ignores disabled registrations even when callers pass them through', () => {
    expect(
      findMatchingExtensionKeybinding({ key: 'p', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false }, [
        { ...keybindings[0]!, enabled: false },
      ]),
    ).toBeNull();
  });

  it('identifies active shortcut capture controls as reserved keybinding targets', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<button class="ui-shortcut-capture ui-shortcut-capture-capturing"><span>Press shortcut...</span></button>';
    const target = wrapper.querySelector('span');

    expect(isShortcutCaptureEventTarget(target)).toBe(true);
    expect(isShortcutCaptureEventTarget(document.createElement('button'))).toBe(false);
    expect(isShortcutCaptureEventTarget(null)).toBe(false);
  });
});
