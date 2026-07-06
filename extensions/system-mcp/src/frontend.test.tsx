// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpSettingsPanel } from './frontend';

const mocks = vi.hoisted(() => ({
  api: { invokeExtensionAction: vi.fn() },
  useApi: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/settings', () => ({
  api: mocks.api,
  cx: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  Field: ({ label, children }: { label?: React.ReactNode; children: React.ReactNode }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Notice: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pill: ({ children }: { children: React.ReactNode }) => children,
  RailSubsection: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <h4>{title}</h4>
      {children}
    </section>
  ),
  Select: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props}>{children}</select>,
  SupportingText: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  SettingsSection: ({
    title,
    description,
    children,
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  ),
  SettingsRow: ({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  ),
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  TextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  ToolbarButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  useApi: mocks.useApi,
}));

function buildUseApiResult<T>(data: T) {
  return {
    data,
    loading: false,
    refreshing: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(data),
    replaceData: vi.fn(),
  };
}

beforeEach(() => {
  mocks.api.invokeExtensionAction.mockReset();
  mocks.useApi.mockReset();
});

describe('McpSettingsPanel', () => {
  it('renders MCP wrapper and effective server state inside the windowed shell', () => {
    mocks.useApi.mockReturnValue(
      buildUseApiResult({
        configPath: '/tmp/mcp_servers.json',
        configExists: true,
        searchedPaths: ['/tmp/mcp_servers.json'],
        explicitConfigJson:
          '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["@mcp/github"]\n    }\n  }\n}\n',
        servers: [
          {
            name: 'atlassian',
            transport: 'remote',
            args: [],
            url: 'https://mcp.atlassian.com/v1/mcp',
            source: 'skill',
            sourcePath: '/knowledge/skills/dd-atlassian-mcp/mcp.json',
            skillName: 'dd-atlassian-mcp',
            skillPath: '/knowledge/skills/dd-atlassian-mcp',
            manifestPath: '/knowledge/skills/dd-atlassian-mcp/mcp.json',
            hasOAuth: true,
            callbackUrl: 'http://localhost:3118/callback',
            authorizeResource: 'https://datadoghq.atlassian.net/',
            raw: {},
          },
          {
            name: 'github',
            transport: 'stdio',
            command: 'npx',
            args: ['@mcp/github'],
            source: 'config',
            sourcePath: '/tmp/mcp_servers.json',
            hasOAuth: false,
            raw: {},
          },
        ],
        bundledSkills: [
          {
            skillName: 'dd-atlassian-mcp',
            skillPath: '/knowledge/skills/dd-atlassian-mcp',
            manifestPath: '/knowledge/skills/dd-atlassian-mcp/mcp.json',
            serverNames: ['atlassian'],
            overriddenServerNames: [],
          },
        ],
      }),
    );

    const html = renderToString(<McpSettingsPanel />);

    expect(mocks.useApi).toHaveBeenCalledWith(expect.any(Function), 'system-mcp-settings');
    expect(html).toContain('Explicit config');
    expect(html).toContain('Add server');
    expect(html).toContain('Explicit servers');
    expect(html).toContain('Skill-bundled servers');
    expect(html).toContain('dd-atlassian-mcp');
    expect(html).toContain('npx @mcp/github');
  });

  it('autosaves edits from the dialog editor', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.useApi.mockReturnValue({
      ...buildUseApiResult({
        configPath: '/tmp/mcp_servers.json',
        configExists: true,
        searchedPaths: ['/tmp/mcp_servers.json'],
        explicitConfigJson:
          '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["@mcp/github"]\n    }\n  }\n}\n',
        servers: [
          {
            name: 'github',
            transport: 'stdio',
            command: 'npx',
            args: ['@mcp/github'],
            source: 'config',
            sourcePath: '/tmp/mcp_servers.json',
            hasOAuth: false,
            raw: {},
          },
        ],
        bundledSkills: [],
      }),
      refetch,
    });
    mocks.api.invokeExtensionAction.mockResolvedValue({ result: {} });

    render(<McpSettingsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Open MCP server details for github' }));
    await waitFor(() => expect(screen.getByDisplayValue('npx')).toBeTruthy());

    fireEvent.change(screen.getByDisplayValue('npx'), { target: { value: 'bunx' } });

    await waitFor(
      () => expect(mocks.api.invokeExtensionAction).toHaveBeenCalledWith('system-mcp', 'saveExplicitConfig', expect.any(Object)),
      { timeout: 1400 },
    );
    const payload = mocks.api.invokeExtensionAction.mock.calls[0]?.[2] as { json: string };
    expect(JSON.parse(payload.json)).toEqual({
      mcpServers: {
        github: {
          command: 'bunx',
          args: ['@mcp/github'],
        },
      },
    });
    expect(refetch).toHaveBeenCalled();
  });

  it('renders MCP servers as tables with details in a dialog', () => {
    mocks.useApi.mockReturnValue(
      buildUseApiResult({
        configPath: '/tmp/mcp_servers.json',
        configExists: true,
        searchedPaths: ['/tmp/mcp_servers.json'],
        explicitConfigJson:
          '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["@mcp/github"]\n    }\n  }\n}\n',
        servers: [
          {
            name: 'github',
            transport: 'stdio',
            command: 'npx',
            args: ['@mcp/github'],
            source: 'config',
            sourcePath: '/tmp/mcp_servers.json',
            hasOAuth: false,
            raw: {},
          },
        ],
        bundledSkills: [
          {
            skillName: 'dd-atlassian-mcp',
            skillPath: '/knowledge/skills/dd-atlassian-mcp',
            manifestPath: '/knowledge/skills/dd-atlassian-mcp/mcp.json',
            serverNames: ['atlassian'],
            overriddenServerNames: [],
          },
        ],
      }),
    );

    render(<McpSettingsPanel />);

    expect(document.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(screen.getByRole('heading', { name: 'MCP Servers' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Explicit config' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Explicit servers' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Skill-bundled servers' })).toBeTruthy();
    const windowedTables = Array.from(document.querySelectorAll<HTMLElement>('.wos-data-table'));
    expect(windowedTables.map((table) => table.style.getPropertyValue('--wos-data-column-template'))).toEqual([
      'minmax(14rem, 1fr) minmax(7rem, 0.4fr) minmax(6rem, 0.34fr) minmax(16rem, 0.82fr) minmax(6rem, 0.34fr)',
      'minmax(14rem, 1fr) minmax(10rem, 0.55fr) minmax(10rem, 0.55fr) minmax(16rem, 0.82fr)',
    ]);
    expect(screen.getByRole('button', { name: 'Open MCP server details for github' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Server details: github' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open MCP server details for github' }));

    expect(screen.getByRole('dialog', { name: 'Server details: github' })).toBeTruthy();
    expect(document.querySelector('[data-windowed-subwindow="mcp-server-details"]')).toBeTruthy();
    expect(document.querySelector('[data-parent-window-title="Settings"]')).toBeTruthy();
    expect(screen.getByDisplayValue('npx')).toBeTruthy();
    expect(screen.getByDisplayValue('@mcp/github')).toBeTruthy();
    const actionRemoveButton = document.querySelector('.wos-dialog__actions button[data-tone="danger"]');
    expect(actionRemoveButton?.textContent).toBe('Remove');
  });

  it('keeps loading and error states inside the canonical windowed shell', () => {
    mocks.useApi.mockReturnValueOnce({ data: null, loading: true, error: null, refetch: vi.fn() });

    const { container, rerender } = render(<McpSettingsPanel />);

    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(screen.getByText('Loading MCP servers').closest('.wos-state-block__title')).toBeTruthy();
    expect(screen.getByText('Reading explicit config and skill-bundled server wrappers.').closest('.wos-state-block__body')).toBeTruthy();

    mocks.useApi.mockReturnValueOnce({ data: null, loading: false, error: 'load failed', refetch: vi.fn() });
    rerender(<McpSettingsPanel />);

    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(screen.getByText('MCP servers unavailable')).toBeTruthy();
    expect(screen.getByText('load failed').closest('.wos-state-block')?.getAttribute('data-tone')).toBe('danger');
  });

  it('renders structured save and server action feedback', async () => {
    mocks.useApi.mockReturnValue(
      buildUseApiResult({
        configPath: '/tmp/mcp_servers.json',
        configExists: true,
        searchedPaths: ['/tmp/mcp_servers.json'],
        explicitConfigJson:
          '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["@mcp/github"]\n    }\n  }\n}\n',
        servers: [
          {
            name: 'github',
            transport: 'stdio',
            command: 'npx',
            args: ['@mcp/github'],
            source: 'config',
            sourcePath: '/tmp/mcp_servers.json',
            hasOAuth: false,
            raw: {},
          },
        ],
        bundledSkills: [],
      }),
    );
    mocks.api.invokeExtensionAction.mockImplementation(async (_extensionId: string, action: string) => {
      if (action === 'saveExplicitConfig') return { result: {} };
      if (action === 'testServer') return { result: { ok: false, message: 'Server did not respond.' } };
      throw new Error(`Unexpected action ${action}`);
    });

    render(<McpSettingsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Open MCP server details for github' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => expect(screen.getByText('MCP config saved')).toBeTruthy());
    expect(screen.getByText('github disabled.').closest('.wos-state-block__body')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => expect(screen.getByText('Server action failed')).toBeTruthy());
    expect(screen.getByText('Server did not respond.').closest('.wos-state-block__body')).toBeTruthy();
  });
});
