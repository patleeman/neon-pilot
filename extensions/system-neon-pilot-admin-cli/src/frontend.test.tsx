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
  WindowedEmptyState: ({ children, tone }: { children: React.ReactNode; tone?: string }) => <div data-tone={tone}>{children}</div>,
  WindowedPageButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  WindowedPageSection: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
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

    render(<NeonPilotAgentSettingsPanel settingsContext={{ shellPresentation: 'windowed' }} />);

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

  it('keeps the stable settings row presentation outside windowed mode', () => {
    render(<NeonPilotAgentSettingsPanel />);

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('CLI entrypoint')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CLI entrypoint' }).getAttribute('aria-pressed')).toBe('true');
  });
});
