import { randomUUID } from 'node:crypto';

import { publishAppEvent } from '../shared/appEvents.js';

export type ExtensionUiConfirmStatus = 'confirmed' | 'declined' | 'timeout';

export interface ExtensionUiConfirmInput {
  extensionId: string;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  timeoutMs?: number;
  details?: Array<{ label: string; value: string }>;
}

interface PendingUiConfirm {
  resolve: (result: { status: ExtensionUiConfirmStatus; confirmed: boolean }) => void;
  timer: NodeJS.Timeout;
}

const pendingConfirms = new Map<string, PendingUiConfirm>();
const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;

export function requestExtensionUiConfirm(
  input: ExtensionUiConfirmInput,
): Promise<{ status: ExtensionUiConfirmStatus; confirmed: boolean }> {
  const requestId = randomUUID();
  const timeoutMs = clampTimeout(input.timeoutMs);
  const details = normalizeDetails(input.details);
  publishAppEvent({
    type: 'extension_ui_confirm',
    requestId,
    extensionId: input.extensionId,
    title: input.title?.trim() || 'Approve extension action',
    message: input.message,
    timeoutMs,
    ...(input.confirmLabel ? { confirmLabel: input.confirmLabel } : {}),
    ...(input.cancelLabel ? { cancelLabel: input.cancelLabel } : {}),
    ...(details ? { details } : {}),
  });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingConfirms.delete(requestId);
      resolve({ status: 'timeout', confirmed: false });
    }, timeoutMs);
    timer.unref?.();
    pendingConfirms.set(requestId, { resolve, timer });
  });
}

export function resolveExtensionUiConfirm(requestId: string, status: ExtensionUiConfirmStatus): boolean {
  const pending = pendingConfirms.get(requestId);
  if (!pending) return false;
  pendingConfirms.delete(requestId);
  clearTimeout(pending.timer);
  pending.resolve({ status, confirmed: status === 'confirmed' });
  return true;
}

function clampTimeout(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, number));
}

function normalizeDetails(value: ExtensionUiConfirmInput['details']): Array<{ label: string; value: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const details = value
    .flatMap((item) => {
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      const detailValue = typeof item.value === 'string' ? item.value.trim() : '';
      return label && detailValue ? [{ label, value: detailValue.slice(0, 300) }] : [];
    })
    .slice(0, 8);
  return details.length > 0 ? details : undefined;
}
