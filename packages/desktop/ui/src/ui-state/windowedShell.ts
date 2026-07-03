export const DESKTOP_SHELL_PRESENTATION_STORAGE_KEY = 'pa:desktop-shell-presentation';
export const WINDOWED_OS_THEME_STORAGE_KEY = 'pa:windowed-os-theme:v1';
export const WINDOWED_OS_THEME_CHANGED_EVENT = 'pa:windowed-os-theme-changed';
export const WINDOWED_SHELL_CHILD_PARAM = 'windowed-child';

export type DesktopShellPresentation = 'stable' | 'windowed';
export type WindowedOsResolvedTheme = 'light' | 'dark';
export type WindowedOsTheme = WindowedOsResolvedTheme | 'auto';
export type WindowedOsThemePhase = 'deep-night' | 'night' | 'dawn' | 'morning' | 'bright-noon' | 'afternoon' | 'dusk';

export interface DesktopRect {
  width: number;
  height: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SnapTarget = 'maximize' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const MIN_VISIBLE_X = 96;
const MIN_VISIBLE_Y = 34;
const SNAP_THRESHOLD = 24;
const TITLEBAR_RESTORE_DRAG_Y = 30;

export function isWindowedShellChild(search = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(search).get(WINDOWED_SHELL_CHILD_PARAM) === '1';
}

export function normalizeDesktopShellPresentation(value: unknown): DesktopShellPresentation | null {
  return value === 'stable' || value === 'windowed' ? value : null;
}

export function readDesktopShellPresentation(): DesktopShellPresentation {
  if (typeof window === 'undefined' || isWindowedShellChild()) {
    return 'stable';
  }

  const queryMode = normalizeDesktopShellPresentation(new URLSearchParams(window.location.search).get('shell'));
  if (queryMode) {
    try {
      window.localStorage.setItem(DESKTOP_SHELL_PRESENTATION_STORAGE_KEY, queryMode);
    } catch {
      // Ignore storage failures; the query string still selects this load.
    }
    return queryMode;
  }

  try {
    return normalizeDesktopShellPresentation(window.localStorage.getItem(DESKTOP_SHELL_PRESENTATION_STORAGE_KEY)) ?? 'stable';
  } catch {
    return 'stable';
  }
}

export function writeDesktopShellPresentation(mode: DesktopShellPresentation): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DESKTOP_SHELL_PRESENTATION_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures.
  }
}

export function normalizeWindowedOsTheme(value: unknown): WindowedOsTheme | null {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : null;
}

export function readWindowedOsTheme(): WindowedOsTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    return normalizeWindowedOsTheme(window.localStorage.getItem(WINDOWED_OS_THEME_STORAGE_KEY)) ?? 'light';
  } catch {
    return 'light';
  }
}

export function writeWindowedOsTheme(theme: WindowedOsTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WINDOWED_OS_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures; the in-memory shell state still updates.
  }
  window.dispatchEvent(new CustomEvent(WINDOWED_OS_THEME_CHANGED_EVENT, { detail: { theme } }));
}

export function resolveWindowedOsThemePhase(date = new Date()): WindowedOsThemePhase {
  const hour = date.getHours();
  if (hour < 5) return 'deep-night';
  if (hour < 7) return 'dawn';
  if (hour < 11) return 'morning';
  if (hour < 15) return 'bright-noon';
  if (hour < 18) return 'afternoon';
  if (hour < 21) return 'dusk';
  return 'night';
}

export function resolveWindowedOsTheme(theme: WindowedOsTheme, date = new Date()): WindowedOsResolvedTheme {
  if (theme !== 'auto') return theme;
  const phase = resolveWindowedOsThemePhase(date);
  return phase === 'deep-night' || phase === 'night' || phase === 'dusk' ? 'dark' : 'light';
}

export function constrainWindowBounds(bounds: WindowBounds, desktop: DesktopRect): WindowBounds {
  const maxX = Math.max(0, desktop.width - MIN_VISIBLE_X);
  const maxY = Math.max(0, desktop.height - MIN_VISIBLE_Y);
  const minX = Math.min(0, MIN_VISIBLE_X - bounds.width);
  const minY = Math.min(0, MIN_VISIBLE_Y - bounds.height);

  return {
    ...bounds,
    x: Math.min(maxX, Math.max(minX, bounds.x)),
    y: Math.min(maxY, Math.max(minY, bounds.y)),
  };
}

export function resolveSnapTarget(pointer: { x: number; y: number }, desktop: DesktopRect): SnapTarget | null {
  const nearLeft = pointer.x <= SNAP_THRESHOLD;
  const nearRight = pointer.x >= desktop.width - SNAP_THRESHOLD;
  const nearTop = pointer.y <= SNAP_THRESHOLD;
  const nearBottom = pointer.y >= desktop.height - SNAP_THRESHOLD;

  if (nearTop && nearLeft) return 'top-left';
  if (nearTop && nearRight) return 'top-right';
  if (nearBottom && nearLeft) return 'bottom-left';
  if (nearBottom && nearRight) return 'bottom-right';
  if (nearTop) return 'top';
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  if (nearBottom) return 'bottom';
  return null;
}

export function boundsForSnapTarget(target: SnapTarget, desktop: DesktopRect): WindowBounds {
  const halfWidth = Math.round(desktop.width / 2);
  const halfHeight = Math.round(desktop.height / 2);

  switch (target) {
    case 'maximize':
      return { x: 0, y: 0, width: desktop.width, height: desktop.height };
    case 'left':
      return { x: 0, y: 0, width: halfWidth, height: desktop.height };
    case 'right':
      return { x: halfWidth, y: 0, width: desktop.width - halfWidth, height: desktop.height };
    case 'top':
      return { x: 0, y: 0, width: desktop.width, height: Math.round(desktop.height / 4) };
    case 'bottom':
      return { x: 0, y: halfHeight, width: desktop.width, height: desktop.height - halfHeight };
    case 'top-left':
      return { x: 0, y: 0, width: halfWidth, height: halfHeight };
    case 'top-right':
      return { x: halfWidth, y: 0, width: desktop.width - halfWidth, height: halfHeight };
    case 'bottom-left':
      return { x: 0, y: halfHeight, width: halfWidth, height: desktop.height - halfHeight };
    case 'bottom-right':
      return { x: halfWidth, y: halfHeight, width: desktop.width - halfWidth, height: desktop.height - halfHeight };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function boundsForRestoredDragStart(
  snappedBounds: WindowBounds,
  restoredBounds: WindowBounds,
  pointer: { x: number; y: number },
  desktop: DesktopRect,
): WindowBounds {
  const pointerRatioX = clamp((pointer.x - snappedBounds.x) / Math.max(1, snappedBounds.width), 0, 1);
  const titlebarOffsetY = clamp(pointer.y - snappedBounds.y, 0, TITLEBAR_RESTORE_DRAG_Y);

  return constrainWindowBounds(
    {
      ...restoredBounds,
      x: Math.round(pointer.x - restoredBounds.width * pointerRatioX),
      y: Math.round(pointer.y - titlebarOffsetY),
    },
    desktop,
  );
}
