import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { useCallback, useEffect, useState } from 'react';

interface SpeechMikeStatus {
  running: boolean;
  pid?: number | null;
  vendorId: string;
  productId: string;
  lastEvent?: { name: string; raw: string; at: string } | null;
  logs: string[];
}

export function SpeechMikeSettingsPanel({ pa }: { pa: NativeExtensionClient }) {
  const [status, setStatus] = useState<SpeechMikeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = (await pa.extension.invoke('status')) as SpeechMikeStatus;
    setStatus(next);
  }, [pa]);

  useEffect(() => {
    void load().catch((nextError) => setError(nextError instanceof Error ? nextError.message : String(nextError)));
    const interval = window.setInterval(() => void load().catch(() => undefined), 1500);
    return () => window.clearInterval(interval);
  }, [load]);

  async function run(action: 'start' | 'stop') {
    setBusy(true);
    setError(null);
    try {
      await pa.extension.invoke(action);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[13px] font-medium text-primary">Philips SpeechMike direct events</div>
        <p className="ui-card-meta mt-1">
          Put SpeechControl in Event mode and save to device. Neon Pilot listens for vendor HID events and maps them to commands.
        </p>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface/60 p-3 text-[12px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-primary">{status?.running ? 'Monitor running' : 'Monitor stopped'}</div>
            <div className="text-dim">
              vendor {status?.vendorId ?? '0x0911'} · product {status?.productId ?? '0x0c1c'} {status?.pid ? `· pid ${status.pid}` : ''}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="ui-toolbar-button" disabled={busy || status?.running} onClick={() => void run('start')}>
              Start
            </button>
            <button type="button" className="ui-toolbar-button" disabled={busy || !status?.running} onClick={() => void run('stop')}>
              Stop
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[12px] font-medium text-secondary">Last event</div>
        <div className="mt-1 rounded-lg bg-elevated/50 p-3 font-mono text-[12px] text-primary">
          {status?.lastEvent ? `${status.lastEvent.name} · ${status.lastEvent.raw}` : 'No event yet'}
        </div>
      </div>

      <div>
        <div className="text-[12px] font-medium text-secondary">Recent log</div>
        <div className="mt-1 max-h-56 overflow-auto rounded-lg bg-elevated/50 p-3 font-mono text-[11px] text-secondary">
          {(status?.logs?.length ? status.logs : ['No logs yet.']).map((line, index) => (
            <div key={`${index}-${line}`}>{line}</div>
          ))}
        </div>
      </div>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
