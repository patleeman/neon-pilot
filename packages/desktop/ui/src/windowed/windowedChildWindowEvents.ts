export const WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT = 'neon-pilot-windowed-parent-window-lifecycle';

export type WindowedParentWindowLifecycleReason = 'closed' | 'minimized';

export interface WindowedParentWindowLifecycleDetail {
  parentWindowId: string;
  parentWindowKind: 'chat' | 'route';
  parentWindowTitle: string;
  reason: WindowedParentWindowLifecycleReason;
}

export function dispatchWindowedParentWindowLifecycle(detail: WindowedParentWindowLifecycleDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WindowedParentWindowLifecycleDetail>(WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT, { detail }));
}
