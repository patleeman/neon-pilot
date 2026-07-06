import type { NativeExtensionClient } from '@neon-pilot/extensions';
import {
  Notice,
  QuietLoadingState,
  Select,
  SettingsRow,
  Switch,
  ToolbarButton,
  WindowedDataRow,
  WindowedDataTable,
  WindowedPageButton,
  WindowedPageSection,
  WindowedSelect,
  WindowedStateBlock,
  WindowedToggle,
} from '@neon-pilot/extensions/ui';
import React, { useCallback, useEffect, useState } from 'react';

import type { AlertSeverityFilter, AlertSoundId, AlertsSettings, AlertsSettingsState } from './types.js';

const SOUND_OPTIONS: Array<{ id: AlertSoundId; label: string }> = [
  { id: 'basso', label: 'Basso' },
  { id: 'blow', label: 'Blow' },
  { id: 'bottle', label: 'Bottle' },
  { id: 'frog', label: 'Frog' },
  { id: 'funk', label: 'Funk' },
  { id: 'glass', label: 'Glass' },
  { id: 'hero', label: 'Hero' },
  { id: 'morse', label: 'Morse' },
  { id: 'ping', label: 'Ping' },
  { id: 'pop', label: 'Pop' },
  { id: 'purr', label: 'Purr' },
  { id: 'sosumi', label: 'Sosumi' },
  { id: 'submarine', label: 'Submarine' },
  { id: 'tink', label: 'Tink' },
];

interface AlertsSettingsPanelProps {
  pa: NativeExtensionClient;
  settingsContext?: { extensionId?: string; shellPresentation?: 'windowed' };
}

function statusText(settings: AlertsSettings, systemNotificationsAvailable: boolean): string {
  if (!settings.enabled) return 'Paused';
  const channels = [
    settings.nativeNotifications ? (systemNotificationsAvailable ? 'macOS notifications' : 'macOS notifications unavailable') : null,
    settings.soundEnabled ? 'sound' : null,
  ].filter(Boolean);
  return channels.length > 0 ? channels.join(' and ') : 'No delivery channel selected';
}

const INTERNAL_ERROR_PATTERNS = [
  /^Extension "[^"]+" action "[^"]+" failed/i,
  /^Extension backend action failed/i,
  /^Extension host/i,
  /\bworker\.enabled\b/i,
  /\bCannot find module\b/i,
  /\bENOENT\b/i,
  /\bfile:\/\//i,
  /\/api\//i,
  /\blocalApi\.js\b/i,
];

export function formatAlertsSettingsFailure(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const message = raw.trim();
  if (!message) return fallback;
  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

export function AlertsSettingsPanel({ pa, settingsContext }: AlertsSettingsPanelProps) {
  const [state, setState] = useState<AlertsSettingsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = (await pa.extension.invoke('readSettings', {})) as AlertsSettingsState;
    setState(next);
  }, [pa]);

  useEffect(() => {
    void load().catch((error) =>
      setMessage(formatAlertsSettingsFailure(error, 'Alert settings are unavailable. Reload the app or restart Neon Pilot.')),
    );
  }, [load]);

  async function save(update: Partial<AlertsSettings>) {
    setBusy(true);
    setMessage(null);
    try {
      const next = (await pa.extension.invoke('updateSettings', update)) as AlertsSettingsState;
      setState(next);
    } catch (error) {
      setMessage(formatAlertsSettingsFailure(error, 'Could not update alert settings. Reload the app and try again.'));
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
      setMessage(formatAlertsSettingsFailure(error, 'Could not send a test alert. Check notification access and try again.'));
    } finally {
      setBusy(false);
    }
  }

  const isWindowed = settingsContext?.shellPresentation === 'windowed';

  if (!state) {
    return isWindowed ? (
      <div className="alerts-page-windowed flex min-h-0 flex-col gap-3">
        <WindowedStateBlock tone={message ? 'danger' : 'neutral'}>{message ?? 'Loading alert settings.'}</WindowedStateBlock>
      </div>
    ) : (
      <>
        <QuietLoadingState label="Loading alert settings" className="min-h-12" />
        {message ? <Notice tone="danger">{message}</Notice> : null}
      </>
    );
  }

  const settings = state.settings;

  if (isWindowed) {
    return (
      <div className="alerts-page-windowed flex min-h-0 flex-col gap-3">
        {!state.systemNotificationsAvailable && settings.nativeNotifications ? (
          <WindowedStateBlock tone="warning">
            macOS notifications are not available until the desktop app notification bridge is ready.
          </WindowedStateBlock>
        ) : null}
        <WindowedPageSection title="Delivery" meta={statusText(settings, state.systemNotificationsAvailable)}>
          <WindowedDataTable columns={[{ label: 'Alert' }, { label: 'State' }, { label: 'Control', align: 'right' }]}>
            <WindowedDataRow
              name="Attention alerts"
              meta={settings.enabled ? 'On' : 'Paused'}
              action={
                <WindowedToggle
                  checked={settings.enabled}
                  disabled={busy}
                  accent="settings"
                  label={settings.enabled ? 'Disable attention alerts' : 'Enable attention alerts'}
                  onChange={() => void save({ enabled: !settings.enabled })}
                />
              }
            />
            <WindowedDataRow
              name="Native notification"
              meta={state.systemNotificationsAvailable ? 'macOS notifications' : 'macOS notifications unavailable'}
              action={
                <WindowedToggle
                  checked={settings.nativeNotifications}
                  disabled={busy || !settings.enabled}
                  accent="settings"
                  label={settings.nativeNotifications ? 'Disable native notifications' : 'Enable native notifications'}
                  onChange={() => void save({ nativeNotifications: !settings.nativeNotifications })}
                />
              }
            />
            <WindowedDataRow
              name="Sound"
              meta={settings.soundEnabled ? settings.sound : 'Off'}
              cells={[
                {
                  value: (
                    <WindowedSelect
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
                    </WindowedSelect>
                  ),
                  className: 'wos-data-row__cell--wide',
                },
              ]}
              action={
                <WindowedToggle
                  checked={settings.soundEnabled}
                  disabled={busy || !settings.enabled}
                  accent="settings"
                  label={settings.soundEnabled ? 'Disable alert sound' : 'Enable alert sound'}
                  onChange={() => void save({ soundEnabled: !settings.soundEnabled })}
                />
              }
            />
            <WindowedDataRow
              name="Notify for"
              meta={settings.severity === 'all' ? 'All active alerts' : 'Disruptive alerts'}
              action={
                <WindowedSelect
                  aria-label="Alert severity"
                  value={settings.severity}
                  disabled={busy || !settings.enabled}
                  onChange={(event) => void save({ severity: event.target.value as AlertSeverityFilter })}
                >
                  <option value="disruptive">Disruptive alerts</option>
                  <option value="all">All active alerts</option>
                </WindowedSelect>
              }
            />
          </WindowedDataTable>
        </WindowedPageSection>
        <WindowedPageSection title="Test alert" meta={message ?? 'Send a notification and play the selected sound.'}>
          <WindowedPageButton type="button" tone="accent" disabled={busy} onClick={() => void testAlert()}>
            {busy ? 'Working...' : 'Send test'}
          </WindowedPageButton>
        </WindowedPageSection>
      </div>
    );
  }

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
