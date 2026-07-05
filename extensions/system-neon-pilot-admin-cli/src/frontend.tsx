import { api, Button, ErrorState, MetaLabel, SettingsRow, Switch, useApi } from '@neon-pilot/extensions/settings';
import {
  QuietLoadingState,
  WindowedBadge,
  WindowedDataRow,
  WindowedDataTable,
  WindowedPageButton,
  WindowedPageSection,
  WindowedStateBlock,
  WindowedToggle,
} from '@neon-pilot/extensions/ui';
import React, { useEffect, useState } from 'react';

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

type SettingsPanelContext = {
  shellPresentation?: 'stable' | 'windowed';
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

function shellLinkStatusLabel(status: CliShellLinkSetupState['status'] | undefined): string {
  if (status === 'ready') return 'Ready';
  if (status === 'blocked') return 'Blocked';
  if (status === 'not_applicable') return 'Not applicable';
  if (status === 'needs_setup') return 'Needs setup';
  return 'Unknown';
}

function shellLinkStatusTone(status: CliShellLinkSetupState['status'] | undefined): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ready') return 'positive';
  if (status === 'blocked') return 'danger';
  if (status === 'needs_setup') return 'warning';
  return 'neutral';
}

export function NeonPilotAgentSettingsPanel({ settingsContext }: { settingsContext?: SettingsPanelContext }) {
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

  if (settingsContext?.shellPresentation === 'windowed') {
    const shellLinkDetail = shellLinkError
      ? shellLinkError instanceof Error
        ? shellLinkError.message
        : String(shellLinkError)
      : (shellLink?.detail ?? 'Install the neon-pilot command in your user shell path.');

    return (
      <div className="admin-cli-page-windowed grid gap-3">
        {loading ? <WindowedStateBlock>Loading settings.</WindowedStateBlock> : null}
        {error ? <WindowedStateBlock tone="danger">{error instanceof Error ? error.message : String(error)}</WindowedStateBlock> : null}
        <WindowedPageSection title="Command line">
          <WindowedDataTable columns={[{ label: 'Capability' }, { label: 'State' }, { label: 'Action', align: 'right' }]}>
            <WindowedDataRow
              name="Shell command"
              meta={shellLinkDetail}
              status={
                <WindowedBadge tone={shellLinkStatusTone(shellLink?.status)}>{shellLinkStatusLabel(shellLink?.status)}</WindowedBadge>
              }
              action={
                <span className="flex items-center justify-end gap-2">
                  <WindowedPageButton disabled={shellLinkLoading || installing} onClick={() => void refetchShellLink()}>
                    Refresh
                  </WindowedPageButton>
                  {canInstallShellLink ? (
                    <WindowedPageButton tone="accent" disabled={shellLinkLoading || installing} onClick={() => void installShellLink()}>
                      {installing ? 'Installing' : 'Install'}
                    </WindowedPageButton>
                  ) : null}
                </span>
              }
            />
            <WindowedDataRow
              name="CLI entrypoint"
              meta="Administer Neon Pilot, start delegated tasks, inspect runs, and manage app surfaces."
              status={
                <WindowedBadge tone={settings.cliEnabled ? 'positive' : 'neutral'}>
                  {settings.cliEnabled ? 'Enabled' : 'Paused'}
                </WindowedBadge>
              }
              action={
                <span className="flex items-center justify-end gap-2">
                  <WindowedPageButton disabled={saving} onClick={() => void refetch()}>
                    Refresh
                  </WindowedPageButton>
                  <WindowedToggle
                    checked={settings.cliEnabled}
                    disabled={saving}
                    accent="extensions"
                    label="Toggle CLI entrypoint"
                    onChange={() => void save({ cliEnabled: !settings.cliEnabled })}
                  />
                </span>
              }
            />
          </WindowedDataTable>
        </WindowedPageSection>
        {message || saveError || shellLinkMessage || shellLinkSaveError ? (
          <WindowedPageSection title="Status">
            <div className="grid gap-1 text-[11px] leading-4">
              {message ? <span className="text-success">{message}</span> : null}
              {saveError ? <span className="text-danger">{saveError}</span> : null}
              {shellLinkMessage ? <span className="text-success">{shellLinkMessage}</span> : null}
              {shellLinkSaveError ? <span className="text-danger">{shellLinkSaveError}</span> : null}
            </div>
          </WindowedPageSection>
        ) : null}
      </div>
    );
  }

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
                {shellLinkStatusLabel(shellLink.status)}
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
