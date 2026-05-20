import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { ToolbarButton } from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useState } from 'react';

// Mirror the shape from src/backend.ts
interface MySettings {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
}

const defaultSettings: MySettings = { apiKey: '', endpoint: 'https://api.example.com', enabled: false };

// ── helpers ───────────────────────────────────────────────────────────────────

function inputClass() {
  return 'w-full rounded-lg border border-border-subtle bg-surface/70 px-3 py-2 text-[13px] text-primary shadow-none outline-none transition-colors placeholder:text-dim focus:border-accent/50 focus:bg-surface';
}

// Compact two-column label + input layout that fits inside a settings section.
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
      <div className="pt-2">
        <span className="text-[13px] font-medium text-primary">{label}</span>
        {hint ? <p className="mt-0.5 text-[11px] leading-5 text-dim">{hint}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── settings section component ────────────────────────────────────────────────
// The host renders this component inside the Settings page under your section heading.
// Props are injected by the host; pa is always present.

export function MySettingsSection({ pa }: { pa: NativeExtensionClient }) {
  const [settings, setSettings] = useState<MySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Load saved settings on mount
  useEffect(() => {
    pa.actions
      .call('templateSettingsLoad', {})
      .then((result) => {
        setSettings(result as MySettings);
      })
      .catch((err: Error) => {
        pa.ui.notify({ type: 'error', message: `Failed to load settings: ${err.message}`, source: 'template-settings-section' });
      })
      .finally(() => setLoading(false));
  }, [pa]);

  const save = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSaving(true);
      setNotice(null);
      try {
        await pa.actions.call('templateSettingsSave', settings);
        setNotice('Settings saved.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pa.ui.notify({ type: 'error', message: `Failed to save settings: ${msg}`, source: 'template-settings-section' });
      } finally {
        setSaving(false);
      }
    },
    [pa, settings],
  );

  if (loading) {
    return <div className="py-4 text-[13px] text-dim">Loading…</div>;
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {/* Add/remove fields below to match your settings shape */}

      <Field label="Enabled">
        <label className="flex items-center gap-2 pt-2 text-[13px] text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border-default bg-base text-accent focus:outline-none"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
          Enable My Integration
        </label>
      </Field>

      <Field label="API key" hint="Your secret API key. Never logged or shared.">
        <input
          className={inputClass()}
          type="password"
          autoComplete="off"
          placeholder="sk-…"
          value={settings.apiKey}
          onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
        />
      </Field>

      <Field label="Endpoint" hint="Base URL for the API. Change only if you use a self-hosted instance.">
        <input
          className={inputClass()}
          type="url"
          autoComplete="off"
          value={settings.endpoint}
          onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
        />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <ToolbarButton type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </ToolbarButton>
        {notice ? <span className="text-[13px] text-secondary">{notice}</span> : null}
      </div>
    </form>
  );
}
