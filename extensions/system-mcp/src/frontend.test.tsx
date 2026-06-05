import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { McpSettingsPanel } from './frontend';

const mocks = vi.hoisted(() => ({
  api: { invokeExtensionAction: vi.fn() },
  useApi: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/settings', () => ({
  api: mocks.api,
  cx: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  Field: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  Notice: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pill: ({ children }: { children: React.ReactNode }) => children,
  Select: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props}>{children}</select>,
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

describe('McpSettingsPanel', () => {
  it('renders MCP wrapper and effective server state', () => {
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
    expect(html).toContain('MCP servers');
    expect(html).toContain('Add server');
    expect(html).toContain('Explicit servers');
    expect(html).toContain('Skill-bundled servers');
    expect(html).toContain('dd-atlassian-mcp');
    expect(html).toContain('Test');
    expect(html).toContain('Remove');
    expect(html).toContain('npx @mcp/github');
  });
});
