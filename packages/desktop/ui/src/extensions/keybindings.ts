import { evaluateCommandEnablement, type ExtensionCommandContext } from './commands';
import type { ExtensionKeybindingRegistration } from './types';

export interface KeybindingEventLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
}

export function isShortcutCaptureEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('.ui-shortcut-capture-capturing'));
}

export function isShortcutCaptureActive(root?: ParentNode): boolean {
  const targetRoot = root ?? (typeof document !== 'undefined' ? document : null);
  return Boolean(targetRoot?.querySelector('.ui-shortcut-capture-capturing'));
}

const MODIFIER_ALIASES: Record<string, 'mod' | 'ctrl' | 'meta' | 'alt' | 'shift'> = {
  mod: 'mod',
  cmd: 'mod',
  command: 'mod',
  commandorcontrol: 'mod',
  cmdorctrl: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
};

function normalizeKey(value: string): string {
  const key = value.trim();
  if (key.length === 1) return key.toLowerCase();
  return key.toLowerCase().replace(/^arrow/, '');
}

function matchesExtensionKeybinding(event: KeybindingEventLike, shortcut: string): boolean {
  if (event.isComposing) return false;
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const required = new Set<'mod' | 'ctrl' | 'meta' | 'alt' | 'shift'>();
  let key: string | null = null;
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) {
      required.add(modifier);
      continue;
    }
    key = normalizeKey(part);
  }

  if (!key) return false;
  const eventMod = event.metaKey || event.ctrlKey;
  if (required.has('mod')) {
    if (!eventMod) return false;
    const explicitCtrl = required.has('ctrl');
    const explicitMeta = required.has('meta');
    if (explicitCtrl && !event.ctrlKey) return false;
    if (explicitMeta && !event.metaKey) return false;
    if (!explicitCtrl && !explicitMeta && event.ctrlKey && event.metaKey) return false;
    if (explicitCtrl && !explicitMeta && !event.metaKey) return false;
    if (explicitMeta && !explicitCtrl && !event.ctrlKey) return false;
  } else {
    if (required.has('ctrl') !== event.ctrlKey) return false;
    if (required.has('meta') !== event.metaKey) return false;
  }
  if (required.has('alt') !== event.altKey) return false;
  if (required.has('shift') !== event.shiftKey) return false;

  return normalizeKey(event.key) === key || normalizeKey(event.code ?? '') === key;
}

export function findMatchingExtensionKeybinding(
  event: KeybindingEventLike,
  keybindings: ExtensionKeybindingRegistration[],
  context: ExtensionCommandContext = {},
): ExtensionKeybindingRegistration | null {
  return (
    keybindings.find(
      (keybinding) =>
        keybinding.enabled !== false &&
        evaluateCommandEnablement(keybinding.when, context) &&
        keybinding.keys.some((shortcut) => matchesExtensionKeybinding(event, shortcut)),
    ) ?? null
  );
}
