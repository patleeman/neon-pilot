import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../client/api';

export type ExtensionBackendConfirmStatus = 'confirmed' | 'declined' | 'timeout';

export interface ExtensionBackendConfirmState {
  requestId: string;
  extensionId: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  timeoutMs: number;
  details?: Array<{ label: string; value: string }>;
  requestedAt: number;
}

type IncomingBackendConfirm = Omit<ExtensionBackendConfirmState, 'requestedAt'>;

export function useExtensionBackendConfirmations() {
  const [confirm, setConfirm] = useState<ExtensionBackendConfirmState | null>(null);
  const [now, setNow] = useState(Date.now());
  const confirmRef = useRef<ExtensionBackendConfirmState | null>(null);

  const showConfirm = useCallback((detail: IncomingBackendConfirm) => {
    if (confirmRef.current?.requestId === detail.requestId) {
      return;
    }
    if (confirmRef.current) {
      void api.resolveExtensionUiConfirmation(confirmRef.current.requestId, 'declined');
    }

    const next: ExtensionBackendConfirmState = {
      requestId: detail.requestId,
      extensionId: detail.extensionId,
      title: detail.title,
      message: detail.message,
      timeoutMs: detail.timeoutMs,
      requestedAt: Date.now(),
      ...(detail.confirmLabel ? { confirmLabel: detail.confirmLabel } : {}),
      ...(detail.cancelLabel ? { cancelLabel: detail.cancelLabel } : {}),
      ...(detail.details?.length ? { details: detail.details } : {}),
    };
    confirmRef.current = next;
    setConfirm(next);
    setNow(next.requestedAt);
  }, []);

  const resolveConfirm = useCallback((status: ExtensionBackendConfirmStatus) => {
    const current = confirmRef.current;
    if (!current) return;

    confirmRef.current = null;
    setConfirm(null);
    void api.resolveExtensionUiConfirmation(current.requestId, status);
  }, []);

  useEffect(() => {
    function handleBackendConfirm(event: CustomEvent) {
      showConfirm(event.detail as IncomingBackendConfirm);
    }

    window.addEventListener('neon-pilot-extension-ui-confirm', handleBackendConfirm as EventListener);
    return () => window.removeEventListener('neon-pilot-extension-ui-confirm', handleBackendConfirm as EventListener);
  }, [showConfirm]);

  useEffect(() => {
    let cancelled = false;
    async function refreshPendingBackendConfirms() {
      try {
        const response = await api.extensionUiConfirmations();
        if (cancelled) return;
        const next = response.confirmations[0];
        if (next) showConfirm(next);
      } catch {
        // Push events are the primary path; polling recovers confirmations missed during route changes.
      }
    }

    void refreshPendingBackendConfirms();
    const interval = window.setInterval(() => {
      void refreshPendingBackendConfirms();
    }, 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [showConfirm]);

  useEffect(() => {
    if (!confirm) return;
    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow - confirm.requestedAt >= confirm.timeoutMs) {
        resolveConfirm('timeout');
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [confirm, resolveConfirm]);

  useEffect(() => {
    return () => {
      if (confirmRef.current) {
        void api.resolveExtensionUiConfirmation(confirmRef.current.requestId, 'declined');
        confirmRef.current = null;
      }
    };
  }, []);

  return {
    confirm,
    remainingMs: confirm ? Math.max(0, confirm.timeoutMs - (now - confirm.requestedAt)) : 0,
    confirmApproval: () => resolveConfirm('confirmed'),
    declineApproval: () => resolveConfirm('declined'),
  };
}
