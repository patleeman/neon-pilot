import { api, ErrorState, LoadingState, SettingToggleRow, SettingsSection, ToolbarButton, useApi } from '@neon-pilot/extensions/settings';
import { useEffect, useState } from 'react';

type Settings = {
  cliEnabled: boolean;
};

type SettingsState = {
  settings: Settings;
};

const DEFAULT_SETTINGS: Settings = {
  cliEnabled: true,
};

async function readAgentSettings(): Promise<SettingsState> {
  const response = await api.invokeExtensionAction('system-neon-pilot-admin-cli', 'readSettings', {});
  return response.result as SettingsState;
}

async function updateAgentSettings(patch: Partial<Settings>): Promise<SettingsState> {
  const response = await api.invokeExtensionAction('system-neon-pilot-admin-cli', 'updateSettings', patch);
  return response.result as SettingsState;
}

export function NeonPilotAgentSettingsPanel() {
  const { data, loading, error, refetch } = useApi(readAgentSettings, 'system-neon-pilot-cli-settings');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.settings) setSettings(data.settings);
  }, [data?.settings]);

  async function save(patch: Partial<Settings>) {
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    try {
      const result = await updateAgentSettings(patch);
      setSettings(result.settings);
      setMessage('Settings saved.');
      await refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      if (data?.settings) setSettings(data.settings);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection title="CLI access" description="Control whether Neon Pilot CLI entrypoints can be launched by other tools.">
      {loading ? <LoadingState label="Loading settings..." /> : null}
      {error ? <ErrorState title="Settings failed to load" body={error instanceof Error ? error.message : String(error)} /> : null}
      <SettingToggleRow
        title="CLI entrypoint"
        description="Allows neon-pilot to administer Neon Pilot, run delegated tasks, start subagents, and inspect runs."
        checked={settings.cliEnabled}
        disabled={saving}
        onCheckedChange={(checked) => void save({ cliEnabled: checked })}
      />
      <div className="flex items-center gap-2 text-[12px] text-secondary">
        <ToolbarButton disabled={saving} onClick={() => void refetch()}>
          Refresh
        </ToolbarButton>
        {message ? <span className="text-success">{message}</span> : null}
        {saveError ? <span className="text-danger">{saveError}</span> : null}
      </div>
    </SettingsSection>
  );
}
