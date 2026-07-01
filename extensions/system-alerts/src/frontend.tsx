import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { Notice, QuietLoadingState, Select, SettingsRow, Switch, ToolbarButton } from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useState } from 'react';

import type { AlertsSettings, AlertsSettingsState, AlertSoundId, AlertSeverityFilter } from './types.js';

const SOUND_OPTIONS: Array<{ id: AlertSoundId; label: string }> = [
  { id: 'ping', label: 'Ping' },
  { id: 'glass', label: 'Glass' },
  { id: 'pop', label: 'Pop' },
  { id: 'submarine', label: 'Submarine' },
];

interface AlertsSettingsPanelProps {
  pa: NativeExtensionClient;
}

function statusText(settings: AlertsSettings, systemNotificationsAvailable: boolean): string {
  if (!settings.enabled) return 'Paused';
  const channels = [
    settings.nativeNotifications ? (systemNotificationsAvailable ? 'macOS notifications' : 'macOS notifications unavailable') : null,
    settings.soundEnabled ? 'sound' : null,
  ].filter(Boolean);
  return channels.length > 0 ? channels.join(' and ') : 'No delivery channel selected';
}

export function AlertsSettingsPanel({ pa }: AlertsSettingsPanelProps) {
  const [state, setState] = useState<AlertsSettingsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = (await pa.extension.invoke('readSettings')) as AlertsSettingsState;
    setState(next);
  }, [pa]);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [load]);

  async function save(update: Partial<AlertsSettings>) {
    setBusy(true);
    setMessage(null);
    try {
      const next = (await pa.extension.invoke('updateSettings', update)) as AlertsSettingsState;
      setState(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function testAlert() {
    setBusy(true);
    setMessage(null);
    try {
      await pa.extension.invoke('sendTestAlert');
      setMessage('Test alert sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <QuietLoadingState label="Loading alert settings" className="min-h-12" />;
  }

  const settings = state.settings;

  return (
    <div className="space-y-3">
      {!state.systemNotificationsAvailable && settings.nativeNotifications ? (
        <Notice tone="warning">macOS notifications are not available until the desktop app notification bridge is ready.</Notice>
      ) : null}

      <SettingsRow title="Attention alerts" description={statusText(settings, state.systemNotificationsAvailable)}>
        <Switch
          checked={settings.enabled}
          disabled={busy}
          aria-label={settings.enabled ? 'Disable attention alerts' : 'Enable attention alerts'}
          label={settings.enabled ? 'On' : 'Off'}
          onClick={() => void save({ enabled: !settings.enabled })}
        />
      </SettingsRow>

      <SettingsRow title="Native notification" description="Show a macOS notification when an active alert is raised.">
        <Switch
          checked={settings.nativeNotifications}
          disabled={busy || !settings.enabled}
          aria-label={settings.nativeNotifications ? 'Disable native notifications' : 'Enable native notifications'}
          label={settings.nativeNotifications ? 'On' : 'Off'}
          onClick={() => void save({ nativeNotifications: !settings.nativeNotifications })}
        />
      </SettingsRow>

      <SettingsRow title="Sound" description="Play a short macOS system sound when alerts arrive, coalesced during bursts.">
        <div className="flex min-w-0 items-center gap-2">
          <Select
            aria-label="Alert sound"
            value={settings.sound}
            disabled={busy || !settings.enabled || !settings.soundEnabled}
            onChange={(event) => void save({ sound: event.target.value as AlertSoundId })}
          >
            {SOUND_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          <Switch
            checked={settings.soundEnabled}
            disabled={busy || !settings.enabled}
            aria-label={settings.soundEnabled ? 'Disable alert sound' : 'Enable alert sound'}
            label={settings.soundEnabled ? 'On' : 'Off'}
            onClick={() => void save({ soundEnabled: !settings.soundEnabled })}
          />
        </div>
      </SettingsRow>

      <SettingsRow title="Notify for" description="Choose whether passive alerts should also use native delivery.">
        <Select
          aria-label="Alert severity"
          value={settings.severity}
          disabled={busy || !settings.enabled}
          onChange={(event) => void save({ severity: event.target.value as AlertSeverityFilter })}
        >
          <option value="disruptive">Disruptive alerts</option>
          <option value="all">All active alerts</option>
        </Select>
      </SettingsRow>

      <SettingsRow title="Test alert" description={message ?? 'Send a notification and play the selected sound.'}>
        <ToolbarButton type="button" disabled={busy} onClick={() => void testAlert()}>
          {busy ? 'Working...' : 'Send test'}
        </ToolbarButton>
      </SettingsRow>
    </div>
  );
}
