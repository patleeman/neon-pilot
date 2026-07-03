// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: { invokeExtensionAction: vi.fn(), pickFolder: vi.fn() },
  refetch: vi.fn(),
  useApi: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/settings', () => ({
  api: mocks.api,
  SettingToggleRow: ({
    title,
    description,
    checked,
    onCheckedChange,
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <section>
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      <button type="button" role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)}>
        {checked ? 'On' : 'Off'}
      </button>
    </section>
  ),
  useApi: mocks.useApi,
}));

vi.mock('@neon-pilot/extensions/ui', () => ({
  Field: ({ label, children }: { label?: React.ReactNode; children: React.ReactNode }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Notice: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  QuietLoadingState: ({ label }: { label?: string }) => <div role="status" aria-label={label ?? 'Loading'} />,
  RailSubsection: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <h4>{title}</h4>
      {children}
    </section>
  ),
  RowButton: ({ children, selected: _selected, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) => (
    <button {...props}>{children}</button>
  ),
  Select: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props}>{children}</select>,
  SupportingText: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) => (
    <button type="button" aria-pressed={checked} onClick={() => onCheckedChange(!checked)}>
      {checked ? 'On' : 'Off'}
    </button>
  ),
  TextLink: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
  TextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  ToolbarButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  WindowedBadge: ({ children }: { children: React.ReactNode }) => <span className="wos-badge">{children}</span>,
  WindowedDataRow: ({
    name,
    meta,
    cells,
    action,
    enabled,
    onToggle,
  }: {
    name: React.ReactNode;
    meta?: React.ReactNode;
    cells?: React.ReactNode[];
    action?: React.ReactNode;
    enabled?: boolean;
    onToggle?: (checked: boolean) => void;
  }) => (
    <div className="wos-data-row">
      <div>{name}</div>
      {meta ? <div>{meta}</div> : null}
      {cells?.map((cell, index) => (
        <div key={index}>{cell}</div>
      ))}
      {onToggle ? (
        <button type="button" role="switch" aria-checked={enabled} onClick={() => onToggle(!enabled)}>
          {enabled ? 'On' : 'Off'}
        </button>
      ) : null}
      {action}
    </div>
  ),
  WindowedDataTable: ({ children }: { children: React.ReactNode }) => <div className="wos-data-table">{children}</div>,
  WindowedDialog: ({
    title,
    actions,
    children,
    onClose,
  }: {
    title: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <section className="wos-dialog" role="dialog" aria-label={String(title)}>
      <h3>{title}</h3>
      <button type="button" aria-label={`Close ${String(title)}`} onClick={onClose} />
      {actions}
      {children}
    </section>
  ),
  WindowedDialogCopy: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  WindowedDialogStack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  WindowedField: ({ label, children }: { label?: React.ReactNode; children: React.ReactNode }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  WindowedFormActions: ({ children }: { children: React.ReactNode }) => <div className="wos-form-actions">{children}</div>,
  WindowedFormGrid: ({ children, columns, className }: { children: React.ReactNode; columns?: number; className?: string }) => (
    <div className={['wos-form-grid', className].filter(Boolean).join(' ')} data-columns={columns}>
      {children}
    </div>
  ),
  WindowedKeyValueGrid: ({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) => (
    <div className="wos-key-value-grid">
      {items.map((item) => (
        <div key={item.label}>
          {item.label}: {item.value}
        </div>
      ))}
    </div>
  ),
  WindowedPageButton: ({ children, tone, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: string }) => (
    <button data-tone={tone} {...props}>
      {children}
    </button>
  ),
  WindowedPageMain: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main className="wos-page-main">
      <h2>{title}</h2>
      {children}
    </main>
  ),
  WindowedPageSection: ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => (
    <section className="wos-page-section">
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  ),
  WindowedPageShell: ({ children, className, layout }: { children: React.ReactNode; className?: string; layout?: string }) => (
    <div className={['wos-page-shell', className].filter(Boolean).join(' ')} data-layout={layout}>
      {children}
    </div>
  ),
  WindowedSelect: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props}>{children}</select>,
  WindowedTextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

import { AgentPluginsSettingsPanel } from './frontend';

function buildUseApiResult(data: unknown) {
  return {
    data,
    loading: false,
    refreshing: false,
    error: null,
    refetch: mocks.refetch,
    replaceData: vi.fn(),
  };
}

const plugin = {
  id: 'codex-review-pack-1234',
  displayName: 'Review Pack',
  ecosystem: 'codex',
  enabled: true,
  autoUpdate: false,
  status: 'enabled',
  source: { kind: 'local', path: '/plugins/review-pack', resolvedCommit: undefined },
  capabilities: {
    skills: [{ id: 'review', path: 'skills/review/SKILL.md' }],
    mcp: [{ path: 'skills/review/mcp.json' }],
    hooks: [{ kind: 'hooks', path: 'hooks/before_agent_start.md' }],
    docs: [{ path: 'AGENTS.md' }],
  },
  compatibility: {
    detectedEcosystem: 'codex',
    supported: ['1 skill file'],
    ignored: ['hooks hook: hooks/before_agent_start.md'],
    warnings: ['Hook files are indexed but not executed until mapped to Neon Pilot lifecycle boundaries.'],
    blockers: [],
  },
};

beforeEach(() => {
  mocks.api.invokeExtensionAction.mockReset();
  mocks.api.pickFolder.mockReset();
  mocks.refetch.mockReset().mockResolvedValue(undefined);
  mocks.useApi.mockReset();
});

describe('AgentPluginsSettingsPanel', () => {
  it('keeps initial loading chrome visually quiet', () => {
    mocks.useApi.mockReturnValue({ ...buildUseApiResult(null), loading: true });

    render(<AgentPluginsSettingsPanel />);

    expect(screen.getByRole('status', { name: 'Loading agent plugins' })).toBeTruthy();
    expect(screen.queryByText('Loading agent plugins...')).toBeNull();
  });

  it('renders installed plugin with capability summary and warnings', () => {
    mocks.useApi.mockReturnValue(buildUseApiResult({ storageRoot: '/runtime/plugins', plugins: [plugin] }));

    render(<AgentPluginsSettingsPanel />);

    expect(screen.getAllByText('Review Pack').length).toBeGreaterThan(0);
    expect(screen.getByText('Plugin is on')).toBeTruthy();
    expect(screen.getByText('1 skill · 1 MCP server · 1 doc')).toBeTruthy();
    expect(screen.getByText('Skills (1)')).toBeTruthy();
    expect(screen.getByText('Instructions and docs (1)')).toBeTruthy();
    expect(screen.getByText('MCP servers (1)')).toBeTruthy();
    expect(screen.getByText('Ignored hooks (1)')).toBeTruthy();
    expect(screen.getByText('Hook files are indexed but not executed until mapped to Neon Pilot lifecycle boundaries.')).toBeTruthy();
    // Raw file paths should not be shown
    expect(screen.queryByText('review - skills/review/SKILL.md')).toBeNull();
    expect(screen.queryByText('Compatibility')).toBeNull();
  });

  it('adds a Git plugin through the backend action without ecosystem or ref', async () => {
    mocks.useApi.mockReturnValue(buildUseApiResult({ storageRoot: '/runtime/plugins', plugins: [] }));
    mocks.api.invokeExtensionAction.mockResolvedValue({ result: { plugin } });

    render(<AgentPluginsSettingsPanel />);

    fireEvent.change(screen.getByPlaceholderText('https://github.com/owner/agent-plugin'), {
      target: { value: 'https://github.com/example/review-pack' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() =>
      expect(mocks.api.invokeExtensionAction).toHaveBeenCalledWith('system-agent-plugins', 'addPlugin', {
        sourceKind: 'git',
        source: 'https://github.com/example/review-pack',
      }),
    );
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('toggles plugin availability and auto update through backend actions', async () => {
    mocks.useApi.mockReturnValue(buildUseApiResult({ storageRoot: '/runtime/plugins', plugins: [plugin] }));
    mocks.api.invokeExtensionAction.mockResolvedValue({ result: { plugin } });

    render(<AgentPluginsSettingsPanel />);

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    await waitFor(() =>
      expect(mocks.api.invokeExtensionAction).toHaveBeenCalledWith('system-agent-plugins', 'setPluginEnabled', {
        id: 'codex-review-pack-1234',
        enabled: false,
      }),
    );
    expect(mocks.refetch).toHaveBeenCalled();

    fireEvent.click(switches[1]);

    await waitFor(() =>
      expect(mocks.api.invokeExtensionAction).toHaveBeenCalledWith('system-agent-plugins', 'setPluginAutoUpdate', {
        id: 'codex-review-pack-1234',
        autoUpdate: true,
      }),
    );
  });

  it('renders windowed plugin details in a dialog instead of a selected settings pane', () => {
    mocks.useApi.mockReturnValue(buildUseApiResult({ storageRoot: '/runtime/plugins', plugins: [plugin] }));

    const { container } = render(<AgentPluginsSettingsPanel settingsContext={{ shellPresentation: 'windowed' }} />);

    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(container.querySelector('.agent-plugins-page-windowed')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Agent Plugins' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Install agent plugin' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Installed agent plugins' })).toBeTruthy();
    expect(container.querySelector('.wos-form-grid[data-columns="2"]')).toBeTruthy();
    expect(container.querySelector('.wos-form-actions')).toBeTruthy();
    expect(document.querySelector('.wos-data-table')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open details for Review Pack' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Plugin is on' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open details for Review Pack' }));

    expect(screen.getByRole('dialog', { name: 'Review Pack' })).toBeTruthy();
    expect(screen.getByText('Plugin is on')).toBeTruthy();
    expect(screen.getByText('Auto update')).toBeTruthy();
    expect(container.querySelector('.wos-agent-plugin-capabilities')).toBeTruthy();
    expect(screen.getByText('Skills (1)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' }).getAttribute('data-tone')).toBe('danger');
  });
});
