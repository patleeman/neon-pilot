import { describe, expect, it } from 'vitest';

import { findMatchingExtensionKeybinding } from './keybindings';
import type { ExtensionKeybindingRegistration } from './types';

const keybindings: ExtensionKeybindingRegistration[] = [
  {
    extensionId: 'system-conversation-tools',
    surfaceId: 'open-thread-palette',
    packageType: 'system',
    title: 'Open thread palette',
    keys: ['mod+p'],
    command: 'palette.open',
    args: { scope: 'threads' },
    scope: 'global',
    defaultKeys: ['mod+p'],
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
];

describe('extension keybindings', () => {
  it('keeps Cmd+P and Cmd+Shift+P distinct', () => {
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
});
