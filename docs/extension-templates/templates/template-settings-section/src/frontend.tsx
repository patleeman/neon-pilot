import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { LoadingState, Notice, SettingsPanel, SettingsRow, Switch, TextInput } from '@neon-pilot/extensions/settings';
import { useCallback, useEffect, useRef, useState } from 'react';

// Mirror the shape from src/backend.ts.
interface MySettings {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
}

const defaultSettings: MySettings = { apiKey: '', endpoint: 'https://api.example.com', enabled: false };

// The host renders this component inside the Settings page. It owns the page
// title, outer width, scroll anchor, and section spacing; this component should
// render only compact settings row groups.
export function MySettingsSection({ pa }: { pa: NativeExtensionClient }) {
  const [settings, setSettings] = useState<MySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof MySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    pa.extension
      .invoke('templateSettingsLoad', {})
      .then((result) => {
        setSettings({ ...defaultSettings, ...(result as Partial<MySettings>) });
      })
      .catch((err: Error) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        pa.ui.notify({ type: 'error', message: `Failed to load settings: ${message}`, source: 'template-settings-section' });
      })
      .finally(() => setLoading(false));
  }, [pa]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const save = useCallback(
    async (patch: Partial<MySettings>, key: keyof MySettings) => {
      setSavingKey(key);
      setError(null);
      try {
        await pa.extension.invoke('templateSettingsSave', patch);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        pa.ui.notify({ type: 'error', message: `Failed to save settings: ${message}`, source: 'template-settings-section' });
      } finally {
        setSavingKey(null);
      }
    },
    [pa],
  );

  const update = useCallback(
    <K extends keyof MySettings>(key: K, value: MySettings[K], options: { debounce?: boolean } = {}) => {
      setSettings((current) => ({ ...current, [key]: value }));
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (options.debounce) {
        debounceRef.current = window.setTimeout(() => {
          void save({ [key]: value }, key);
        }, 600);
        return;
      }
      void save({ [key]: value }, key);
    },
    [save],
  );

  if (loading) {
    return <LoadingState label="Loading integration settings…" />;
  }

  return (
    <div className="space-y-3">
      <SettingsPanel title="Integration">
        <SettingsRow
          title="Enabled"
          description={settings.enabled ? 'Integration requests are allowed.' : 'Integration requests are disabled.'}
        >
          <Switch checked={settings.enabled} aria-label="Enable integration" onClick={() => update('enabled', !settings.enabled)} />
        </SettingsRow>

        <SettingsRow
          title="API key"
          description={settings.apiKey ? 'Stored by the extension backend.' : 'Enter the secret value issued by the integration.'}
        >
          <TextInput
            type="password"
            value={settings.apiKey}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
            aria-label="API key"
            disabled={savingKey === 'apiKey'}
            onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.currentTarget.value }))}
            onBlur={(event) => void save({ apiKey: event.currentTarget.value }, 'apiKey')}
          />
        </SettingsRow>

        <SettingsRow title="Endpoint" description={savingKey === 'endpoint' ? 'Saving...' : 'Base URL for API requests.'}>
          <TextInput
            type="url"
            value={settings.endpoint}
            placeholder="https://api.example.com"
            autoComplete="off"
            spellCheck={false}
            aria-label="Endpoint"
            onChange={(event) => update('endpoint', event.currentTarget.value, { debounce: true })}
          />
        </SettingsRow>
      </SettingsPanel>

      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
