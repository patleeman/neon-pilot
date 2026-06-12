import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { CORE_KEYBOARD_SHORTCUT_REGISTRATIONS, DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS } from './keyboard-shortcuts.js';

// ── keyboard-shortcuts — default shortcut definitions ─────────────────────

describe('DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS', () => {
  it('defines all expected shortcuts from the core registry', () => {
    const keys = Object.keys(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS);
    expect(keys.length).toBe(24);
    expect(CORE_KEYBOARD_SHORTCUT_REGISTRATIONS.map((registration) => registration.id)).toEqual(keys);
  });

  it('includes the essential conversation shortcuts', () => {
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.newConversation).toBe('CommandOrControl+N');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.closeTab).toBe('CommandOrControl+W');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.focusComposer).toBe('CommandOrControl+L');
  });

  it('includes layout mode shortcuts', () => {
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.conversationMode).toBe('F1');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.workbenchMode).toBe('F2');
  });

  it('includes sidebar and rail toggles', () => {
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.toggleSidebar).toBe('CommandOrControl+/');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.toggleRightRail).toBe('CommandOrControl+\\');
  });

  it('includes workbench shortcuts', () => {
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.newWorkbenchTab).toBe('CommandOrControl+T');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.closeWorkbenchTab).toBe('CommandOrControl+Shift+W');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.closeWorkbenchFile).toBe('CommandOrControl+Alt+W');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.refreshWorkbenchFile).toBe('F5');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.toggleWorkbenchExplorer).toBe('CommandOrControl+B');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.toggleWorkbenchDiff).toBe('CommandOrControl+Shift+D');
  });

  it('includes show app and quit', () => {
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.showApp).toBe('CommandOrControl+Shift+A');
    expect(DEFAULT_DESKTOP_KEYBOARD_SHORTCUTS.quit).toBe('CommandOrControl+Q');
  });

  it('keeps the desktop app docs shortcut table aligned with the core registry', () => {
    const docs = readFileSync(new URL('../../../docs/desktop-app.md', import.meta.url), 'utf8');

    for (const registration of CORE_KEYBOARD_SHORTCUT_REGISTRATIONS) {
      expect(docs).toContain(`| ${registration.title} | \`${formatShortcutForDocs(registration.defaultKeys[0] ?? '')}\` |`);
    }
  });
});

function formatShortcutForDocs(shortcut: string): string {
  return shortcut.replaceAll('CommandOrControl', 'Cmd/Ctrl').replaceAll('Command', 'Cmd');
}
