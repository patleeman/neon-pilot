// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NeonPilotAgentSettingsPanel } from './frontend';

const mocks = vi.hoisted(() => ({
  api: { invokeExtensionAction: vi.fn() },
  refetchSettings: vi.fn(),
  refetchShellLink: vi.fn(),
  useApi: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/settings', () => ({
  api: mocks.api,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  ErrorState: ({ title, body }: { title: string; body?: React.ReactNode }) => (
    <section role="alert">
      <h3>{title}</h3>
      {body}
    </section>
  ),
  MetaLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SettingsRow: ({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  ),
  Switch: ({ checked, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean }) => (
    <button type="button" aria-pressed={checked} {...props} />
  ),
  useApi: mocks.useApi,
}));

vi.mock('@neon-pilot/extensions/ui', () => ({
  QuietLoadingState: ({ label }: { label: string }) => <div role="status">{label}</div>,
  WindowedBadge: ({ children, tone }: { children: React.ReactNode; tone?: string }) => <span data-tone={tone}>{children}</span>,
  WindowedDataRow: ({
    name,
    meta,
    status,
    action,
  }: {
    name: string;
    meta?: React.ReactNode;
    status?: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div role="row">
      <span>{name}</span>
      {meta ? <span>{meta}</span> : null}
      {status}
      {action}
    </div>
  ),
  WindowedDataTable: ({ children }: { columns: unknown[]; children: React.ReactNode }) => <div role="table">{children}</div>,
  WindowedPageMain: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main className="wos-page-main">
      <h1>{title}</h1>
      {children}
    </main>
  ),
  WindowedPageButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  WindowedPageSection: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  WindowedPageShell: ({ children, className, layout }: { children: React.ReactNode; className?: string; layout?: string }) => (
    <div className={['wos-page-shell', className].filter(Boolean).join(' ')} data-layout={layout}>
      {children}
    </div>
  ),
  WindowedStateBlock: ({ children, tone }: { children: React.ReactNode; tone?: string }) => (
    <div className="wos-state-block" data-tone={tone}>
      {children}
    </div>
  ),
  WindowedToggle: ({
    checked,
    label,
    onChange,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean; label: string; onChange: () => void }) => (
    <button type="button" aria-label={label} aria-pressed={checked} onClick={onChange} {...props} />
  ),
}));

function buildUseApiResult<T>(data: T, refetch: () => Promise<T>) {
  return {
    data,
    loading: false,
    refreshing: false,
    error: null,
    refetch,
  };
}

beforeEach(() => {
  const settingsResult = buildUseApiResult({ settings: { cliEnabled: true } }, mocks.refetchSettings);
  const shellLinkResult = buildUseApiResult(
    { status: 'needs_setup', detail: 'Install the shell command.', actions: ['install'] },
    mocks.refetchShellLink,
  );
  mocks.api.invokeExtensionAction.mockReset();
  mocks.refetchSettings.mockReset();
  mocks.refetchShellLink.mockReset();
  mocks.useApi.mockReset();
  mocks.refetchSettings.mockResolvedValue({ settings: { cliEnabled: true } });
  mocks.refetchShellLink.mockResolvedValue({ status: 'ready', detail: 'Command is linked.' });
  mocks.useApi.mockImplementation((_loader: unknown, key: string) => {
    if (key === 'system-neon-pilot-cli-shell-link-setup') {
      return shellLinkResult;
    }
    return settingsResult;
  });
});

describe('NeonPilotAgentSettingsPanel', () => {
  it('renders a windowed settings table and saves CLI toggle changes', async () => {
    mocks.api.invokeExtensionAction.mockResolvedValue({ result: { settings: { cliEnabled: false } } });

    const { container } = render(<NeonPilotAgentSettingsPanel />);

    expect(container.querySelector('.admin-cli-page-windowed')).not.toBeNull();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Shell command')).toBeTruthy();
    expect(screen.getByText('CLI entrypoint')).toBeTruthy();
    expect(screen.getByText('Needs setup')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle CLI entrypoint' }));

    await waitFor(() => {
      expect(mocks.api.invokeExtensionAction).toHaveBeenCalledWith('system-neon-pilot-admin-cli', 'updateSettings', {
        cliEnabled: false,
      });
    });
  });

  it('uses shared windowed state-block chrome when settings fail to load', () => {
    mocks.useApi.mockImplementation((_loader: unknown, key: string) => {
      if (key === 'system-neon-pilot-cli-shell-link-setup') {
        return buildUseApiResult(
          { status: 'needs_setup', detail: 'Install the shell command.', actions: ['install'] },
          mocks.refetchShellLink,
        );
      }
      return {
        data: null,
        loading: false,
        refreshing: false,
        error: new Error('CLI settings unavailable.'),
        refetch: mocks.refetchSettings,
      };
    });

    const { container } = render(<NeonPilotAgentSettingsPanel />);

    expect(screen.getByText('CLI settings unavailable.').closest('.wos-state-block')?.getAttribute('data-tone')).toBe('danger');
    expect(container.querySelector('.wos-empty-state')).toBeNull();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
    expect(container.querySelector('.ui-error-state')).toBeNull();
  });

  it('keeps windowed loading state inside the settings panel', () => {
    mocks.useApi.mockImplementation((_loader: unknown, key: string) => {
      if (key === 'system-neon-pilot-cli-shell-link-setup') {
        return buildUseApiResult(
          { status: 'needs_setup', detail: 'Install the shell command.', actions: ['install'] },
          mocks.refetchShellLink,
        );
      }
      return {
        data: null,
        loading: true,
        refreshing: false,
        error: null,
        refetch: mocks.refetchSettings,
      };
    });

    const { container } = render(<NeonPilotAgentSettingsPanel />);

    expect(container.querySelector('.wos-page-shell')).toBeNull();
    expect(screen.getByText('Loading settings.').closest('.wos-state-block')).toBeTruthy();
  });

  it('renders windowed data rows as the canonical settings surface', () => {
    render(<NeonPilotAgentSettingsPanel />);

    expect(screen.getByText('CLI entrypoint')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Toggle CLI entrypoint' }).getAttribute('aria-pressed')).toBe('true');
  });
});
