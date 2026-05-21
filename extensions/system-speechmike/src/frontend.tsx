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

interface SpeechMikeSettingsState {
  settings: { bindings: Record<string, string> };
  events: Array<{ id: string; label: string }>;
  actions: Array<{ id: string; label: string }>;
}

const SELECT_CLASS =
  'h-8 w-full rounded-md border border-border-subtle bg-surface/70 px-2 text-[12px] text-primary outline-none focus:border-accent/50';

export function SpeechMikeSettingsPanel({ pa }: { pa: NativeExtensionClient }) {
  const [status, setStatus] = useState<SpeechMikeStatus | null>(null);
  const [settingsState, setSettingsState] = useState<SpeechMikeSettingsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const next = (await pa.extension.invoke('status')) as SpeechMikeStatus;
    setStatus(next);
  }, [pa]);

  const loadSettings = useCallback(async () => {
    const next = (await pa.extension.invoke('readSettings')) as SpeechMikeSettingsState;
    setSettingsState(next);
  }, [pa]);

  useEffect(() => {
    void loadStatus().catch((nextError) => setError(nextError instanceof Error ? nextError.message : String(nextError)));
    void loadSettings().catch((nextError) => setError(nextError instanceof Error ? nextError.message : String(nextError)));
    const interval = window.setInterval(() => void loadStatus().catch(() => undefined), 300);
    return () => window.clearInterval(interval);
  }, [loadSettings, loadStatus]);

  async function run(action: 'start' | 'stop') {
    setBusy(true);
    setError(null);
    try {
      await pa.extension.invoke(action);
      await loadStatus();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function updateBinding(eventId: string, actionId: string) {
    if (!settingsState) return;
    setSavingEvent(eventId);
    setError(null);
    const nextBindings = { ...settingsState.settings.bindings, [eventId]: actionId };
    setSettingsState({ ...settingsState, settings: { bindings: nextBindings } });
    try {
      const next = (await pa.extension.invoke('updateSettings', { bindings: nextBindings })) as SpeechMikeSettingsState;
      setSettingsState(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      await loadSettings();
    } finally {
      setSavingEvent(null);
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
        <div className="text-[12px] font-medium text-secondary">Button actions</div>
        <div className="mt-2 divide-y divide-border-subtle/70 rounded-lg border border-border-subtle bg-surface/40">
          {(settingsState?.events ?? []).map((event) => (
            <div key={event.id} className="grid gap-2 p-2 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-primary">{event.label}</div>
                <div className="font-mono text-[11px] text-dim">{event.id}</div>
              </div>
              <select
                className={SELECT_CLASS}
                value={settingsState?.settings.bindings[event.id] ?? 'none'}
                disabled={!settingsState || savingEvent === event.id}
                onChange={(eventChange) => void updateBinding(event.id, eventChange.target.value)}
                aria-label={`Action for ${event.label}`}
              >
                {(settingsState?.actions ?? []).map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
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
