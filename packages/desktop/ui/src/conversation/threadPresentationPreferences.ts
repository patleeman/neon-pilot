import { buildSidebarNavSectionStorageKey } from '../local/localSettings';

export type ThreadsOrganizeMode = 'project' | 'chronological';
export type ThreadsFilterMode = 'all' | 'human' | 'automation';
export type ThreadsSortMode = 'created' | 'updated' | 'manual';

const THREADS_COLLAPSED_CWD_GROUPS_STORAGE_KEY = buildSidebarNavSectionStorageKey('threads-collapsed-cwd-groups');
const THREADS_CWD_GROUP_LABEL_OVERRIDES_STORAGE_KEY = buildSidebarNavSectionStorageKey('threads-cwd-group-label-overrides');
const THREADS_ORGANIZE_STORAGE_KEY = buildSidebarNavSectionStorageKey('threads-organize');
const THREADS_FILTER_STORAGE_KEY = buildSidebarNavSectionStorageKey('threads-filter');
const THREADS_SORT_BY_STORAGE_KEY = buildSidebarNavSectionStorageKey('threads-sort-by');
const THREADS_MANUAL_GROUP_ORDER_STORAGE_KEY = buildSidebarNavSectionStorageKey('threads-manual-group-order');

export function normalizeStoredThreadStringList(values: Iterable<unknown>): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const key = typeof value === 'string' ? value.trim() : '';
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(key);
  }

  return normalized;
}

export function readCollapsedConversationGroupKeys(): string[] {
  try {
    const raw = localStorage.getItem(THREADS_COLLAPSED_CWD_GROUPS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? normalizeStoredThreadStringList(parsed) : [];
  } catch {
    return [];
  }
}

export function writeCollapsedConversationGroupKeys(keys: readonly string[]): void {
  try {
    if (keys.length > 0) {
      localStorage.setItem(THREADS_COLLAPSED_CWD_GROUPS_STORAGE_KEY, JSON.stringify(keys));
      return;
    }

    localStorage.removeItem(THREADS_COLLAPSED_CWD_GROUPS_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function readConversationGroupLabelOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(THREADS_CWD_GROUP_LABEL_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const overrides: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(parsed)) {
      const key = rawKey.trim();
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (key && value) overrides[key] = value;
    }

    return overrides;
  } catch {
    return {};
  }
}

export function writeConversationGroupLabelOverrides(overrides: Record<string, string>): void {
  try {
    const entries = Object.entries(overrides)
      .map(([rawKey, rawValue]) => [rawKey.trim(), rawValue.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0);

    if (entries.length > 0) {
      localStorage.setItem(THREADS_CWD_GROUP_LABEL_OVERRIDES_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
      return;
    }

    localStorage.removeItem(THREADS_CWD_GROUP_LABEL_OVERRIDES_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function readThreadsOrganizeMode(): ThreadsOrganizeMode {
  try {
    const raw = localStorage.getItem(THREADS_ORGANIZE_STORAGE_KEY);
    return raw === 'chronological' || raw === 'manual' ? 'chronological' : 'project';
  } catch {
    return 'project';
  }
}

export function writeThreadsOrganizeMode(value: ThreadsOrganizeMode): void {
  try {
    localStorage.setItem(THREADS_ORGANIZE_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

export function readThreadsFilterMode(): ThreadsFilterMode {
  try {
    const raw = localStorage.getItem(THREADS_FILTER_STORAGE_KEY);
    return raw === 'human' || raw === 'automation' ? raw : 'all';
  } catch {
    return 'all';
  }
}

export function writeThreadsFilterMode(value: ThreadsFilterMode): void {
  try {
    localStorage.setItem(THREADS_FILTER_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

export function readThreadsSortMode(): ThreadsSortMode {
  try {
    if (localStorage.getItem(THREADS_ORGANIZE_STORAGE_KEY) === 'manual') {
      return 'manual';
    }

    const raw = localStorage.getItem(THREADS_SORT_BY_STORAGE_KEY);
    return raw === 'updated' || raw === 'manual' ? raw : 'created';
  } catch {
    return 'created';
  }
}

export function writeThreadsSortMode(value: ThreadsSortMode): void {
  try {
    localStorage.setItem(THREADS_SORT_BY_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

export function readManualConversationGroupOrder(): string[] {
  try {
    const raw = localStorage.getItem(THREADS_MANUAL_GROUP_ORDER_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? normalizeStoredThreadStringList(parsed) : [];
  } catch {
    return [];
  }
}

export function writeManualConversationGroupOrder(groupKeys: readonly string[]): void {
  try {
    if (groupKeys.length > 0) {
      localStorage.setItem(THREADS_MANUAL_GROUP_ORDER_STORAGE_KEY, JSON.stringify(groupKeys));
      return;
    }

    localStorage.removeItem(THREADS_MANUAL_GROUP_ORDER_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
