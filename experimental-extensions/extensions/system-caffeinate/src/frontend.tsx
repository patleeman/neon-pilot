import type { NativeExtensionClient } from '@personal-agent/extensions';
import { useCallback, useEffect, useState } from 'react';

interface CaffeinateStatus {
  running: boolean;
  pid: number | null;
}

interface CaffeinateToggleProps {
  pa: NativeExtensionClient;
}

export function CaffeinateToggle({ pa }: CaffeinateToggleProps) {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = (await pa.extension.invoke('status', {})) as CaffeinateStatus;
    setRunning(next.running);
  }, [pa]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const next = (await pa.extension.invoke('toggle', {})) as CaffeinateStatus;
      setRunning(next.running);
    } catch (error) {
      pa.ui.notify({
        type: 'error',
        source: 'system-caffeinate',
        message: 'Caffeinate toggle failed',
        details: error instanceof Error ? error.message : String(error),
      });
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`ui-toolbar-button ui-desktop-top-bar__icon-button relative transition-all ${
        running ? 'text-warning ring-1 ring-warning/60 shadow-[0_0_18px_rgba(245,158,11,0.55)]' : 'text-secondary'
      }`}
      aria-label={running ? 'Stop caffeinate' : 'Start caffeinate'}
      aria-pressed={running}
      title={running ? 'Caffeinate is on — click to stop' : 'Caffeinate is off — click to start'}
      disabled={busy}
      onClick={() => void toggle()}
    >
      ☕
    </button>
  );
}
