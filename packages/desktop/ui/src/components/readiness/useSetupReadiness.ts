import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppEvents } from '../../app/contexts';
import { api } from '../../client/api';
import type { SetupReadinessSnapshot } from '../../shared/types';

export interface SetupReadinessState {
  snapshot: SetupReadinessSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  runAction: (extensionId: string, itemId: string, actionId: string) => Promise<boolean>;
  dismiss: (extensionId: string, itemId: string) => Promise<boolean>;
  restore: (extensionId: string, itemId: string) => Promise<boolean>;
}

export function useSetupReadiness(): SetupReadinessState {
  const { versions } = useAppEvents();
  const [snapshot, setSnapshot] = useState<SetupReadinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const next = await api.setupReadiness();
      if (requestSeqRef.current !== seq) return;
      setSnapshot(next);
      setError(null);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setError('Setup status could not be refreshed. Try again.');
    } finally {
      if (requestSeqRef.current === seq) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, versions.extensions, versions.readiness]);

  const applyMutation = useCallback(async (run: () => Promise<SetupReadinessSnapshot>) => {
    setError(null);
    try {
      const next = await run();
      setSnapshot(next);
      return true;
    } catch {
      setError('Setup could not be updated. Try again.');
      return false;
    }
  }, []);

  return {
    snapshot,
    loading,
    error,
    refresh,
    runAction: (extensionId, itemId, actionId) => applyMutation(() => api.runSetupReadinessAction(extensionId, itemId, actionId)),
    dismiss: (extensionId, itemId) => applyMutation(() => api.dismissSetupReadinessItem(extensionId, itemId)),
    restore: (extensionId, itemId) => applyMutation(() => api.restoreSetupReadinessItem(extensionId, itemId)),
  };
}
