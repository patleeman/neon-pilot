import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { ToolbarButton, Tooltip } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useState } from 'react';

interface CaffeinateStatus {
  running: boolean;
  pid: number | null;
}

interface CaffeinateToggleProps {
  pa: NativeExtensionClient;
}

function CoffeeCupIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-all ${active ? 'drop-shadow-[0_0_7px_rgba(245,158,11,0.95)]' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8h9v5.5A3.5 3.5 0 0 1 11.5 17h-2A3.5 3.5 0 0 1 6 13.5V8Z" />
      <path d="M15 10h1.5a2 2 0 0 1 0 4H15" />
      <path d="M5 20h12" />
      <path d="M8 4.5c-.45-.55-.45-1.1 0-1.65" />
      <path d="M11 4.5c-.45-.55-.45-1.1 0-1.65" />
      <path d="M14 4.5c-.45-.55-.45-1.1 0-1.65" />
    </svg>
  );
}

export function CaffeinateToggle({ pa }: CaffeinateToggleProps) {
  const [status, setStatus] = useState<CaffeinateStatus>({ running: false, pid: null });
  const [busy, setBusy] = useState(false);

  const running = status.running;
  const statusLabel = running ? `Caffeinate is on${status.pid ? ` — pid ${status.pid}` : ''}` : 'Caffeinate is off';

  const refresh = useCallback(async () => {
    try {
      const next = (await pa.extension.invoke('caffeinateStatus', {})) as CaffeinateStatus;
      setStatus(next);
    } catch {
      // Ignore transient failures (backend warming up, etc.) — polling will retry.
    }
  }, [pa]);

  useEffect(() => {
    let cancelled = false;
    const runRefresh = () => {
      if (!cancelled) void refresh();
    };
    const timeoutId = window.setTimeout(runRefresh, 6_000);
    const intervalId = window.setInterval(runRefresh, 10_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const next = (await pa.extension.invoke('caffeinateToggle', {})) as CaffeinateStatus;
      setStatus(next);
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
    <ToolbarButton
      className={`ui-desktop-top-bar__icon-button group relative transition-colors ${running ? 'text-warning' : 'text-secondary'}`}
      aria-label={running ? 'Stop caffeinate' : 'Start caffeinate'}
      aria-pressed={running}
      title={`${statusLabel} — click to ${running ? 'stop' : 'start'}`}
      disabled={busy}
      onClick={() => void toggle()}
    >
      <CoffeeCupIcon active={running} />
      <Tooltip position="bottom-right" className="text-xs">
        {statusLabel}
      </Tooltip>
    </ToolbarButton>
  );
}
