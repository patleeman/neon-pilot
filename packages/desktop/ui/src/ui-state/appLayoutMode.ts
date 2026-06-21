export const APP_LAYOUT_MODE_STORAGE_KEY = 'pa:app-layout-mode';
export const APP_LAYOUT_MODE_SESSION_STORAGE_KEY = 'pa:app-layout-mode-session';
export const APP_LAYOUT_MODE_CHANGED_EVENT = 'pa:app-layout-mode-changed';

export type AppLayoutMode = 'compact' | 'workbench';

function isAppLayoutMode(value: unknown): value is AppLayoutMode {
  return value === 'compact' || value === 'workbench';
}

function readAppLayoutModeSession(): AppLayoutMode | null {
  try {
    const stored = sessionStorage.getItem(APP_LAYOUT_MODE_SESSION_STORAGE_KEY);
    return isAppLayoutMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeAppLayoutModeSession(mode: AppLayoutMode): void {
  try {
    sessionStorage.setItem(APP_LAYOUT_MODE_SESSION_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures; local storage still captures the user's in-session choice.
  }
}

export function readAppLayoutMode(): AppLayoutMode {
  const sessionMode = readAppLayoutModeSession();
  if (sessionMode) {
    return sessionMode;
  }

  try {
    const stored = localStorage.getItem(APP_LAYOUT_MODE_STORAGE_KEY);
    if (!isAppLayoutMode(stored)) {
      return 'compact';
    }
    return stored === 'workbench' ? 'compact' : stored;
  } catch {
    return 'compact';
  }
}

export function writeAppLayoutMode(mode: AppLayoutMode): void {
  writeAppLayoutModeSession(mode);

  try {
    localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures; the in-memory selection still applies.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(createAppLayoutModeChangedEvent(mode));
  }
}

export function createAppLayoutModeChangedEvent(mode: AppLayoutMode): CustomEvent<{ mode: AppLayoutMode }> {
  return new CustomEvent(APP_LAYOUT_MODE_CHANGED_EVENT, { detail: { mode } });
}
