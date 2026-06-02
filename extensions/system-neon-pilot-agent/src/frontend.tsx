import { api, ToolbarButton, useApi } from '@neon-pilot/extensions/settings';
import { useEffect, useState } from 'react';

type Settings = {
  cliEnabled: boolean;
  mcpEnabled: boolean;
};

type SettingsState = {
  settings: Settings;
};

const DEFAULT_SETTINGS: Settings = {
  cliEnabled: true,
  mcpEnabled: true,
};

async function readAgentSettings(): Promise<SettingsState> {
  const response = await api.invokeExtensionAction('system-neon-pilot-agent', 'readSettings', {});
  return response.result as SettingsState;
}

async function updateAgentSettings(patch: Partial<Settings>): Promise<SettingsState> {
  const response = await api.invokeExtensionAction('system-neon-pilot-agent', 'updateSettings', patch);
  return response.result as SettingsState;
}

function EntryToggle({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-md border border-border-subtle bg-elevated/30 px-3 py-3">
      <span className="min-w-0 space-y-1">
        <span className="block text-[13px] font-medium text-primary">{title}</span>
        <span className="block text-[12px] leading-5 text-secondary">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-accent"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

export function NeonPilotAgentSettingsPanel() {
  const { data, loading, error, refetch } = useApi(readAgentSettings, 'system-neon-pilot-agent-settings');
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
    <section className="scroll-mt-24 grid gap-5 border-t border-border-subtle/70 py-6 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-1.5">
        <h3 className="text-[15px] font-medium tracking-tight text-primary">External agent access</h3>
        <p className="max-w-sm text-[12px] leading-5 text-secondary">Control which Neon Pilot agent entrypoints can be launched by other tools.</p>
      </div>
      <div className="min-w-0 space-y-3.5">
        {loading ? <div className="text-[12px] text-secondary">Loading settings...</div> : null}
        {error ? <div className="text-[12px] text-danger">{error instanceof Error ? error.message : String(error)}</div> : null}
        <EntryToggle
          title="CLI entrypoint"
          description="Allows neon-pilot protocol neon-pilot-agent to run tasks, start subagents, and inspect runs."
          checked={settings.cliEnabled}
          disabled={saving}
          onChange={(checked) => void save({ cliEnabled: checked })}
        />
        <EntryToggle
          title="MCP entrypoint"
          description="Allows neon-pilot protocol neon-pilot-agent-mcp to expose Neon Pilot tools over MCP stdio."
          checked={settings.mcpEnabled}
          disabled={saving}
          onChange={(checked) => void save({ mcpEnabled: checked })}
        />
        <div className="flex items-center gap-2 text-[12px] text-secondary">
          <ToolbarButton disabled={saving} onClick={() => void refetch()}>
            Refresh
          </ToolbarButton>
          {message ? <span className="text-success">{message}</span> : null}
          {saveError ? <span className="text-danger">{saveError}</span> : null}
        </div>
      </div>
    </section>
  );
}
