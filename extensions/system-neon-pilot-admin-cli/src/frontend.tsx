import { api, Button, ErrorState, MetaLabel, SettingsRow, Switch, useApi } from '@neon-pilot/extensions/settings';
import { QuietLoadingState } from '@neon-pilot/extensions/ui';
import { useEffect, useState } from 'react';

type Settings = {
  cliEnabled: boolean;
};

type SettingsState = {
  settings: Settings;
};

type CliShellLinkSetupState = {
  status: 'ready' | 'needs_setup' | 'blocked' | 'not_applicable' | 'unknown';
  detail?: string;
  actions?: string[];
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

async function readCliShellLinkSetupStatus(): Promise<CliShellLinkSetupState> {
  const response = await api.invokeExtensionAction('system-neon-pilot-admin-cli', 'cliShellLinkSetupStatus', {});
  return response.result as CliShellLinkSetupState;
}

async function installCliShellLink(): Promise<{ ok: boolean; detail?: string }> {
  const response = await api.invokeExtensionAction('system-neon-pilot-admin-cli', 'installCliShellLink', {});
  return response.result as { ok: boolean; detail?: string };
}

export function NeonPilotAgentSettingsPanel() {
  const { data, loading, error, refetch } = useApi(readAgentSettings, 'system-neon-pilot-cli-settings');
  const {
    data: shellLink,
    loading: shellLinkLoading,
    error: shellLinkError,
    refetch: refetchShellLink,
  } = useApi(readCliShellLinkSetupStatus, 'system-neon-pilot-cli-shell-link-setup');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shellLinkMessage, setShellLinkMessage] = useState<string | null>(null);
  const [shellLinkSaveError, setShellLinkSaveError] = useState<string | null>(null);

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

  async function installShellLink() {
    setInstalling(true);
    setShellLinkMessage(null);
    setShellLinkSaveError(null);
    try {
      const result = await installCliShellLink();
      if (!result.ok) throw new Error(result.detail ?? 'The shell command could not be installed.');
      setShellLinkMessage(result.detail ?? 'Shell command installed.');
      await refetchShellLink();
    } catch (err) {
      setShellLinkSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  }

  const canInstallShellLink = Array.isArray(shellLink?.actions) && shellLink.actions.includes('install');

  return (
    <div className="space-y-3">
      {loading ? <QuietLoadingState label="Loading settings" className="min-h-12" /> : null}
      {error ? <ErrorState title="Settings failed to load" body={error instanceof Error ? error.message : String(error)} /> : null}
      <SettingsRow
        title={
          <span className="flex items-center gap-2">
            <span>Shell command</span>
            {shellLink?.status ? (
              <MetaLabel tone={shellLink.status === 'ready' ? 'success' : shellLink.status === 'blocked' ? 'danger' : 'muted'}>
                {shellLink.status === 'ready' ? 'Ready' : shellLink.status === 'blocked' ? 'Blocked' : 'Needs setup'}
              </MetaLabel>
            ) : null}
          </span>
        }
        description={
          shellLinkError
            ? shellLinkError instanceof Error
              ? shellLinkError.message
              : String(shellLinkError)
            : (shellLink?.detail ?? 'Install the neon-pilot command in your user shell path.')
        }
        disabled={shellLinkLoading || installing}
        actionsClassName="max-w-none"
      >
        <div className="flex items-center gap-2">
          <Button
            aria-label="Check shell command setup again"
            title="Check shell command setup again"
            disabled={shellLinkLoading || installing}
            onClick={() => void refetchShellLink()}
          >
            <span aria-hidden="true">↻</span>
          </Button>
          {canInstallShellLink ? (
            <Button disabled={shellLinkLoading || installing} onClick={() => void installShellLink()}>
              {installing ? 'Installing' : 'Install'}
            </Button>
          ) : null}
        </div>
      </SettingsRow>
      <SettingsRow
        title="CLI entrypoint"
        description="Allows neon-pilot to administer Neon Pilot, run delegated tasks, start subagents, and inspect runs."
        disabled={saving}
        actionsClassName="max-w-none"
      >
        <div className="flex items-center gap-2">
          <Button
            aria-label="Refresh CLI entrypoint settings"
            title="Refresh CLI entrypoint settings"
            disabled={saving}
            onClick={() => void refetch()}
          >
            <span aria-hidden="true">↻</span>
          </Button>
          <Switch
            checked={settings.cliEnabled}
            disabled={saving}
            aria-label="CLI entrypoint"
            onClick={() => void save({ cliEnabled: !settings.cliEnabled })}
          />
        </div>
      </SettingsRow>
      <div className="flex items-center gap-2 text-[12px] text-secondary">
        {message ? <span className="text-success">{message}</span> : null}
        {saveError ? <span className="text-danger">{saveError}</span> : null}
        {shellLinkMessage ? <span className="text-success">{shellLinkMessage}</span> : null}
        {shellLinkSaveError ? <span className="text-danger">{shellLinkSaveError}</span> : null}
      </div>
    </div>
  );
}
