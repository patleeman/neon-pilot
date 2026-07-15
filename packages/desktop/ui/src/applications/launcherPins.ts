export type LauncherPinTarget =
  | { kind: 'application'; applicationId: string }
  | { kind: 'page'; navigationId: string }
  | { kind: 'conversation'; conversationId: string };

export interface LauncherPinSnapshot {
  title: string;
  icon?: string;
  applicationTitle?: string;
}

export interface LauncherPin {
  key: string;
  target: LauncherPinTarget;
  snapshot: LauncherPinSnapshot;
}

export function launcherPinKey(target: LauncherPinTarget): string {
  switch (target.kind) {
    case 'application':
      return `application:${target.applicationId}`;
    case 'page':
      return `page:${target.navigationId}`;
    case 'conversation':
      return `conversation:${target.conversationId}`;
  }
}

export function normalizeLauncherPins(value: unknown): LauncherPin[] {
  if (!Array.isArray(value)) return [];
  const pins: LauncherPin[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const target = normalizeLauncherPinTarget(record.target);
    const snapshot = normalizeSnapshot(record.snapshot);
    if (!target || !snapshot) continue;
    const key = launcherPinKey(target);
    if (seen.has(key)) continue;
    seen.add(key);
    pins.push({ key, target, snapshot });
  }
  return pins;
}

function normalizeLauncherPinTarget(value: unknown): LauncherPinTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind === 'application' && typeof record.applicationId === 'string' && record.applicationId.trim()) {
    return { kind: 'application', applicationId: record.applicationId.trim() };
  }
  if (record.kind === 'page' && typeof record.navigationId === 'string' && record.navigationId.trim()) {
    return { kind: 'page', navigationId: record.navigationId.trim() };
  }
  if (record.kind === 'conversation' && typeof record.conversationId === 'string' && record.conversationId.trim()) {
    return { kind: 'conversation', conversationId: record.conversationId.trim() };
  }
  return null;
}

function normalizeSnapshot(value: unknown): LauncherPinSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  if (!title) return null;
  return {
    title,
    ...(typeof record.icon === 'string' && record.icon.trim() ? { icon: record.icon.trim() } : {}),
    ...(typeof record.applicationTitle === 'string' && record.applicationTitle.trim()
      ? { applicationTitle: record.applicationTitle.trim() }
      : {}),
  };
}
