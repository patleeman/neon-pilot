/**
 * Extension notification system.
 *
 * Provides two notification channels for extensions:
 *   1. System/OS notifications — visible in the notification centre (macOS, etc.)
 *   2. Dock badge count — numeric badge on the app icon
 *
 * Both require the desktop main process IPC bridge.
 */

import type { ExtensionBackendNotifyInput } from './extensionBackend.js';
import type { ExtensionInstallSummary } from './extensionRegistry.js';
import { listExtensionInstallSummaries } from './extensionRegistry.js';
import { publishAppEvent } from '../shared/appEvents.js';

// ── In-memory badge state ─────────────────────────────────────────────────────

/**
 * Accumulated badge count from all extensions.
 * The desktop app reads this value to set the dock badge.
 */
let aggregatedBadgeCount = 0;
const extensionBadgeCounters = new Map<string, number>();

// ── Badge API ─────────────────────────────────────────────────────────────────

/**
 * Set or clear a badge counter for a specific extension.
 * Negative values are clamped to 0.
 */
export function setExtensionBadge(extensionId: string, count: number): { badge: number; aggregated: number } {
  const clamped = Math.max(0, Math.floor(count));
  extensionBadgeCounters.set(extensionId, clamped);
  aggregatedBadgeCount = computeAggregatedBadge();
  broadcastBadgeUpdate();
  return { badge: clamped, aggregated: aggregatedBadgeCount };
}

/**
 * Clear badge for a specific extension.
 */
export function clearExtensionBadge(extensionId: string): void {
  extensionBadgeCounters.delete(extensionId);
  aggregatedBadgeCount = computeAggregatedBadge();
  broadcastBadgeUpdate();
}

/**
 * Get the current aggregated badge count.
 */
export function getAggregatedBadgeCount(): number {
  return aggregatedBadgeCount;
}

function computeAggregatedBadge(): number {
  let total = 0;
  for (const count of extensionBadgeCounters.values()) {
    total += count;
  }
  return total;
}

// ── Desktop IPC bridge ────────────────────────────────────────────────────────

type BadgeUpdateListener = (count: number) => void;
type SystemNotificationListener = (notification: { title: string; body: string; subtitle?: string; extensionId?: string }) => void;

const badgeListeners = new Set<BadgeUpdateListener>();
const notificationListeners = new Set<SystemNotificationListener>();

/**
 * Register a listener for badge count changes.
 * Used by the Electron main process IPC bridge.
 */
export function onBadgeChanged(listener: BadgeUpdateListener): () => void {
  badgeListeners.add(listener);
  return () => badgeListeners.delete(listener);
}

/**
 * Register a listener for system notification requests.
 * Used by the Electron main process IPC bridge.
 */
export function onSystemNotification(listener: SystemNotificationListener): () => void {
  notificationListeners.add(listener);
  return () => notificationListeners.delete(listener);
}

function broadcastBadgeUpdate(): void {
  for (const listener of badgeListeners) {
    try {
      listener(aggregatedBadgeCount);
    } catch {
      // Listener cleanup is the owner's responsibility
    }
  }
}

// ── Notification API ──────────────────────────────────────────────────────────

export interface SystemNotification {
  title: string;
  body: string;
  subtitle?: string;
  /** If true, the notification persists until acknowledged. */
  persistent?: boolean;
  /** Optional action payload delivered when the user clicks the notification. */
  actionPayload?: unknown;
}

/**
 * Request a system notification.
 * Returns true if at least one listener received the notification.
 */
export function sendSystemNotification(extensionId: string, notification: SystemNotification): boolean {
  if (notificationListeners.size === 0) return false;

  for (const listener of notificationListeners) {
    try {
      listener({ ...notification, extensionId });
    } catch {
      // Individual listener failure is non-fatal
    }
  }
  return true;
}

/**
 * Check whether system notification support is available (at least one listener).
 */
export function isSystemNotificationAvailable(): boolean {
  return notificationListeners.size > 0;
}

/**
 * Convenience: convert an extension backend notify input to a system notification.
 */
export function sendNotifyAsSystemNotification(extensionId: string, input: ExtensionBackendNotifyInput): boolean {
  const body = typeof input.message === 'string' ? input.message : '';
  const title = input.title ?? extensionId;

  return sendSystemNotification(extensionId, {
    title,
    body,
    subtitle: input.subtitle,
    persistent: input.persistent,
    actionPayload: input.actionPayload,
  });
}

export interface ExtensionStartupStatusNotification {
  severity: 'warning' | 'error';
  message: string;
  details?: string;
}

function uniqueDetails(details: string[]): string[] {
  return [...new Set(details)].filter((detail) => detail.trim().length > 0);
}

function buildExtensionErrorDetails(summary: ExtensionInstallSummary): string[] {
  const details: string[] = [];
  for (const error of summary.errors ?? []) {
    details.push(error);
  }
  if (summary.buildError) {
    details.push(`Build error: ${summary.buildError}`);
  }
  if (summary.healthError) {
    details.push(`Health error: ${summary.healthError}`);
  }
  return uniqueDetails(details);
}

function buildExtensionWarningDetails(summary: ExtensionInstallSummary): string[] {
  const details: string[] = [];
  for (const diagnostic of summary.diagnostics ?? []) {
    details.push(diagnostic);
  }
  return uniqueDetails(details);
}

export function buildExtensionStartupStatusNotifications(
  summaries: ExtensionInstallSummary[],
): ExtensionStartupStatusNotification[] {
  const invalidOrErrored = summaries
    .map((summary) => ({ summary, details: buildExtensionErrorDetails(summary) }))
    .filter(({ summary, details }) => summary.status === 'invalid' || details.length > 0);

  const warnings = summaries
    .filter((summary) => !invalidOrErrored.some((item) => item.summary.id === summary.id))
    .map((summary) => ({ summary, details: buildExtensionWarningDetails(summary) }))
    .filter(({ details }) => details.length > 0);

  const notifications: ExtensionStartupStatusNotification[] = [];
  if (invalidOrErrored.length > 0) {
    notifications.push({
      severity: 'error',
      message:
        invalidOrErrored.length === 1
          ? `${invalidOrErrored[0]?.summary.name ?? invalidOrErrored[0]?.summary.id} needs attention.`
          : `${invalidOrErrored.length} extensions need attention.`,
      details: invalidOrErrored
        .map(({ summary, details }) => `${summary.name} (${summary.id}): ${details.join('; ') || summary.status}`)
        .join('\n'),
    });
  }

  if (warnings.length > 0) {
    notifications.push({
      severity: 'warning',
      message:
        warnings.length === 1
          ? `${warnings[0]?.summary.name ?? warnings[0]?.summary.id} has extension warnings.`
          : `${warnings.length} extensions have warnings.`,
      details: warnings.map(({ summary, details }) => `${summary.name} (${summary.id}): ${details.join('; ')}`).join('\n'),
    });
  }

  return notifications;
}

export function notifyExtensionStartupStatus(summaries: ExtensionInstallSummary[] = listExtensionInstallSummaries()): number {
  const notifications = buildExtensionStartupStatusNotifications(summaries);
  for (const notification of notifications) {
    publishAppEvent({
      type: 'notification',
      extensionId: 'core',
      message: notification.message,
      severity: notification.severity,
      ...(notification.details ? { details: notification.details } : {}),
    });
  }
  return notifications.length;
}
