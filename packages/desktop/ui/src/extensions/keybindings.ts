import type { ExtensionKeybindingRegistration } from './types';

export const COMMAND_KEYBINDINGS_CHANGED_EVENT = 'neon-pilot-command-keybindings-changed';
const CUSTOM_COMMAND_KEYBINDINGS_STORAGE_KEY = 'neon-pilot.commandKeybindings.v1';

export interface CustomCommandKeybindingRegistration {
  extensionId: 'host' | string;
  surfaceId: string;
  title: string;
  keys: string[];
  command: string;
  args?: unknown;
  scope: 'global' | 'surface';
  enabled: boolean;
  defaultKeys: string[];
  packageType?: 'user' | 'system';
}

export interface KeybindingEventLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
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
  keybindings: Array<ExtensionKeybindingRegistration | CustomCommandKeybindingRegistration>,
): ExtensionKeybindingRegistration | CustomCommandKeybindingRegistration | null {
  return keybindings.find((keybinding) => keybinding.keys.some((shortcut) => matchesExtensionKeybinding(event, shortcut))) ?? null;
}

export function readCustomCommandKeybindings(): CustomCommandKeybindingRegistration[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_COMMAND_KEYBINDINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomCommandKeybindingRegistration);
  } catch {
    return [];
  }
}

export function writeCustomCommandKeybinding(next: CustomCommandKeybindingRegistration): void {
  const current = readCustomCommandKeybindings().filter((item) => customKeybindingId(item) !== customKeybindingId(next));
  window.localStorage.setItem(CUSTOM_COMMAND_KEYBINDINGS_STORAGE_KEY, JSON.stringify([...current, next]));
  window.dispatchEvent(new CustomEvent(COMMAND_KEYBINDINGS_CHANGED_EVENT));
}

export function customKeybindingId(keybinding: Pick<CustomCommandKeybindingRegistration, 'extensionId' | 'surfaceId'>): string {
  return `${keybinding.extensionId}:${keybinding.surfaceId}`;
}

function isCustomCommandKeybindingRegistration(value: unknown): value is CustomCommandKeybindingRegistration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.extensionId === 'string' &&
    typeof record.surfaceId === 'string' &&
    typeof record.title === 'string' &&
    Array.isArray(record.keys) &&
    record.keys.every((key) => typeof key === 'string') &&
    typeof record.command === 'string' &&
    (record.scope === 'global' || record.scope === 'surface') &&
    typeof record.enabled === 'boolean' &&
    Array.isArray(record.defaultKeys)
  );
}
