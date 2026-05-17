import type { NativeExtensionClient } from '@personal-agent/extensions';
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
    const next = (await pa.extension.invoke('caffeinateStatus', {})) as CaffeinateStatus;
    setStatus(next);
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
    <button
      type="button"
      className={`ui-toolbar-button ui-desktop-top-bar__icon-button group relative transition-colors ${running ? 'text-warning' : 'text-secondary'}`}
      aria-label={running ? 'Stop caffeinate' : 'Start caffeinate'}
      aria-pressed={running}
      title={`${statusLabel} — click to ${running ? 'stop' : 'start'}`}
      disabled={busy}
      onClick={() => void toggle()}
    >
      <CoffeeCupIcon active={running} />
      <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden whitespace-nowrap rounded-md bg-elevated px-2 py-1 text-xs font-medium text-primary shadow-lg ring-1 ring-border group-hover:block group-focus-visible:block">
        {statusLabel}
      </span>
    </button>
  );
}
