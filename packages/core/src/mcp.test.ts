import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  callMcpTool,
  callMcpToolDirect,
  grepMcpTools,
  inspectMcpServer,
  inspectMcpTool,
  listMcpCatalog,
  readMcpConfig,
  readMcpConfigDocument,
  resolveMcpConfig,
} from './mcp.js';
import { buildMergedMcpConfigDocument, readBundledSkillMcpManifests } from './mcp-bundled-config.js';

function makeTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('mcp config helpers', () => {
  it('reads configured servers from mcp_servers.json', () => {
    const cwd = makeTempDir('pa-mcp-config');
    writeFileSync(
      join(cwd, 'mcp_servers.json'),
      JSON.stringify(
        {
          mcpServers: {
            atlassian: {
              command: 'npx',
              args: ['-y', 'mcp-remote@latest', 'https://mcp.atlassian.com/v1/mcp', '--resource', 'https://datadoghq.atlassian.net/'],
            },
            slack: {
              type: 'remote',
              url: 'https://mcp.slack.com/mcp',
              callback: { host: 'localhost', port: 3118, path: '/callback' },
              oauth: { clientId: 'client-123' },
            },
            local: {
              command: 'node',
              args: ['server.mjs'],
              cwd: '/tmp/mcp',
              env: { TOKEN: 'secret', NUMBER: 1 },
              ignoreTools: ['dangerous_write', 42, 'delete_all'],
            },
          },
        },
        null,
        2,
      ),
    );

    const result = readMcpConfig({ cwd });
    expect(result.exists).toBe(true);
    expect(result.path).toBe(join(cwd, 'mcp_servers.json'));
    expect(result.servers).toHaveLength(3);
    expect(result.servers[0]).toMatchObject({
      name: 'atlassian',
      transport: 'remote',
      url: 'https://mcp.atlassian.com/v1/mcp',
      authorizeResource: 'https://datadoghq.atlassian.net/',
    });
    expect(result.servers[1]).toMatchObject({
      name: 'local',
      transport: 'stdio',
      command: 'node',
      args: ['server.mjs'],
      cwd: '/tmp/mcp',
      env: { TOKEN: 'secret' },
      ignoreTools: ['dangerous_write', 'delete_all'],
    });
    expect(result.servers[2]).toMatchObject({
      name: 'slack',
      transport: 'remote',
      url: 'https://mcp.slack.com/mcp',
      callbackHost: 'localhost',
      callbackPort: 3118,
      callbackPath: '/callback',
    });
  });

  it('resolves an explicit config path relative to cwd', () => {
    const cwd = makeTempDir('pa-mcp-explicit');
    mkdirSync(join(cwd, 'config'), { recursive: true });
    writeFileSync(join(cwd, 'config', 'servers.json'), JSON.stringify({ mcpServers: {} }));

    const result = resolveMcpConfig({ cwd, configPath: './config/servers.json' });
    expect(result.path).toBe(join(cwd, 'config', 'servers.json'));
    expect(result.exists).toBe(true);
  });

  it('lists configured servers without probing by default', async () => {
    const cwd = makeTempDir('pa-mcp-list');
    writeFileSync(
      join(cwd, 'mcp_servers.json'),
      JSON.stringify(
        {
          mcpServers: {
            broken: {
              command: '/definitely/not/a/real/command',
              args: [],
            },
          },
        },
        null,
        2,
      ),
    );

    const catalog = await listMcpCatalog({ cwd });
    expect(catalog.probed).toBe(false);
    expect(catalog.servers).toEqual([{ name: 'broken' }]);
  });

  it('merges skill-bundled mcp manifests ahead of explicit config discovery', () => {
    const cwd = makeTempDir('pa-mcp-bundled');
    const skillDir = join(cwd, 'skills', 'jira-helper');
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(
      join(skillDir, 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            atlassian: {
              command: 'pa',
              args: ['mcp', 'serve', 'atlassian'],
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(cwd, 'mcp_servers.json'),
      JSON.stringify(
        {
          mcpServers: {
            github: {
              command: 'gh',
              args: ['mcp', 'serve'],
            },
            atlassian: {
              command: 'override',
              args: ['explicit'],
            },
          },
        },
        null,
        2,
      ),
    );

    const manifests = readBundledSkillMcpManifests([skillDir]);
    expect(manifests).toEqual([
      {
        skillName: 'jira-helper',
        skillDir,
        manifestPath: join(skillDir, 'mcp.json'),
        serverNames: ['atlassian'],
      },
    ]);

    const merged = buildMergedMcpConfigDocument({ cwd, skillDirs: [skillDir] });
    expect(merged.baseServerNames).toEqual(['atlassian', 'github']);
    expect(merged.searchedPaths).toEqual([
      join(cwd, 'mcp_servers.json'),
      join(homedir(), '.mcp_servers.json'),
      join(homedir(), '.config', 'mcp', 'mcp_servers.json'),
    ]);
    expect(merged.bundledServerCount).toBe(1);
    expect(merged.manifestPaths).toEqual([join(skillDir, 'mcp.json')]);
    expect(merged.document).toEqual({
      mcpServers: {
        atlassian: {
          command: 'override',
          args: ['explicit'],
        },
        github: {
          command: 'gh',
          args: ['mcp', 'serve'],
        },
      },
    });

    const parsed = readMcpConfigDocument({
      path: merged.baseConfigPath,
      exists: true,
      searchedPaths: merged.searchedPaths,
      document: merged.document,
    });
    expect(parsed.servers.map((server) => server.name)).toEqual(['atlassian', 'github']);
  });
});

function sdkEsmRoot(): string {
  return pathToFileURL(
    join(
      repoRoot,
      'node_modules',
      '.pnpm',
      '@modelcontextprotocol+sdk@1.27.1_zod@4.3.6',
      'node_modules',
      '@modelcontextprotocol',
      'sdk',
      'dist',
      'esm',
    ),
  ).href;
}

function zodUrl(): string {
  return pathToFileURL(join(repoRoot, 'node_modules', '.pnpm', 'zod@4.3.6', 'node_modules', 'zod', 'v4', 'index.js')).href;
}

function writeFixtureMcpServer(cwd: string): string {
  const serverPath = join(cwd, 'server.mjs');
  writeFileSync(
    serverPath,
    `
import { McpServer } from '${sdkEsmRoot()}/server/mcp.js';
import { StdioServerTransport } from '${sdkEsmRoot()}/server/stdio.js';
import * as z from '${zodUrl()}';

const server = new McpServer({ name: 'fixture-server', version: '1.0.0' });
server.registerTool('echo', {
  description: 'Echo text back to the caller.',
  inputSchema: { text: z.string() },
}, async ({ text }) => ({
  content: [{ type: 'text', text: String(text) }],
}));
server.registerTool('multi_content', {
  description: 'Return text, image, and resource content blocks.',
  inputSchema: {},
}, async () => ({
  content: [
    { type: 'text', text: 'hello text' },
    { type: 'image', data: Buffer.from('fake-image').toString('base64'), mimeType: 'image/png' },
    { type: 'resource', resource: { uri: 'fixture://note', mimeType: 'text/plain', text: 'resource text' } },
  ],
}));
server.registerTool('structured', {
  description: 'Return structured content.',
  inputSchema: { value: z.number().optional() },
}, async ({ value = 1 }) => ({
  content: [{ type: 'text', text: 'structured result' }],
  structuredContent: { doubled: value * 2 },
}));
server.registerTool('tool_error', {
  description: 'Return a tool-level error result.',
  inputSchema: {},
}, async () => ({
  isError: true,
  content: [{ type: 'text', text: 'fixture tool error' }],
}));

await server.connect(new StdioServerTransport());
`,
    'utf-8',
  );
  return serverPath;
}

function writeFixtureMcpConfig(cwd: string, serverPath: string, extraServerConfig: Record<string, unknown> = {}): void {
  writeFileSync(
    join(cwd, 'mcp_servers.json'),
    JSON.stringify(
      {
        mcpServers: {
          fixture: {
            command: process.execPath,
            args: [serverPath],
            ...extraServerConfig,
          },
        },
      },
      null,
      2,
    ),
  );
}

describe('native MCP client', () => {
  it('inspects and calls a stdio server', async () => {
    const cwd = makeTempDir('pa-mcp-server');
    const serverPath = writeFixtureMcpServer(cwd);
    writeFixtureMcpConfig(cwd, serverPath);

    const serverInfo = await inspectMcpServer('fixture', { cwd, withDescriptions: true });
    expect(serverInfo.exitCode).toBe(0);
    expect(serverInfo.data?.toolCount).toBe(4);
    expect(serverInfo.data?.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'echo', description: 'Echo text back to the caller.' }),
        expect.objectContaining({ name: 'multi_content', description: 'Return text, image, and resource content blocks.' }),
        expect.objectContaining({ name: 'structured', description: 'Return structured content.' }),
        expect.objectContaining({ name: 'tool_error', description: 'Return a tool-level error result.' }),
      ]),
    );

    const toolInfo = await inspectMcpTool('fixture', 'echo', { cwd });
    expect(toolInfo.exitCode).toBe(0);
    expect(toolInfo.data?.schema).toMatchObject({
      type: 'object',
      required: ['text'],
    });

    const toolResult = await callMcpTool('fixture', 'echo', { text: 'hello' }, { cwd });
    expect(toolResult.exitCode).toBe(0);
    expect(toolResult.data?.parsed).toMatchObject({
      content: [{ type: 'text', text: 'hello' }],
    });
  });

  it('preserves MCP call result content block and structured content shapes', async () => {
    const cwd = makeTempDir('pa-mcp-content-types');
    const serverPath = writeFixtureMcpServer(cwd);
    writeFixtureMcpConfig(cwd, serverPath);

    const multi = await callMcpTool('fixture', 'multi_content', {}, { cwd });
    expect(multi.exitCode).toBe(0);
    expect(multi.data?.parsed).toMatchObject({
      content: [
        { type: 'text', text: 'hello text' },
        { type: 'image', mimeType: 'image/png' },
        { type: 'resource', resource: { uri: 'fixture://note', mimeType: 'text/plain', text: 'resource text' } },
      ],
    });

    const structured = await callMcpTool('fixture', 'structured', { value: 21 }, { cwd });
    expect(structured.exitCode).toBe(0);
    expect(structured.data?.parsed).toMatchObject({
      content: [{ type: 'text', text: 'structured result' }],
      structuredContent: { doubled: 42 },
    });
  });

  it('preserves MCP tool-level error results without converting them to protocol errors', async () => {
    const cwd = makeTempDir('pa-mcp-tool-error');
    const serverPath = writeFixtureMcpServer(cwd);
    writeFixtureMcpConfig(cwd, serverPath);

    const result = await callMcpTool('fixture', 'tool_error', {}, { cwd });
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.data?.parsed).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'fixture tool error' }],
    });
  });

  it('sanitizes non-object tool call inputs to an empty argument object', async () => {
    const cwd = makeTempDir('pa-mcp-non-object-input');
    const serverPath = writeFixtureMcpServer(cwd);
    writeFixtureMcpConfig(cwd, serverPath);

    const result = await callMcpTool('fixture', 'structured', 'not-an-object', { cwd });
    expect(result.exitCode).toBe(0);
    expect(result.data?.parsed).toMatchObject({ structuredContent: { doubled: 2 } });
  });

  it('supports direct server calls without config lookup', async () => {
    const cwd = makeTempDir('pa-mcp-direct');
    const serverPath = writeFixtureMcpServer(cwd);

    const result = await callMcpToolDirect(
      { name: 'fixture', transport: 'stdio', command: process.execPath, args: [serverPath], raw: {} },
      'echo',
      { text: 'direct hello' },
      { cwd },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data?.parsed).toMatchObject({ content: [{ type: 'text', text: 'direct hello' }] });
  });

  it('lists and greps probed MCP tools including server-qualified patterns', async () => {
    const cwd = makeTempDir('pa-mcp-catalog-grep');
    const serverPath = writeFixtureMcpServer(cwd);
    writeFixtureMcpConfig(cwd, serverPath);

    const listed = await listMcpCatalog({ cwd, probe: false });
    expect(listed.probed).toBe(false);
    expect(listed.servers).toEqual([{ name: 'fixture' }]);

    const probed = await listMcpCatalog({ cwd, probe: true, withDescriptions: true });
    expect(probed.probed).toBe(true);
    expect(probed.servers[0].info?.toolCount).toBe(4);

    const matches = await grepMcpTools('fixture/structured', { cwd });
    expect(matches.matches).toEqual([{ server: 'fixture', tool: { name: 'structured', description: 'Return structured content.' } }]);
    expect(matches.errors).toEqual([]);
  });

  it('honors server ignoreTools filters for inspect, info, and grep', async () => {
    const cwd = makeTempDir('pa-mcp-ignore-tools');
    const serverPath = writeFixtureMcpServer(cwd);
    writeFixtureMcpConfig(cwd, serverPath, { ignoreTools: ['structured', 'tool_error'] });

    const serverInfo = await inspectMcpServer('fixture', { cwd });
    expect(serverInfo.data?.tools.map((tool) => tool.name)).toEqual(['echo', 'multi_content']);

    const hiddenTool = await inspectMcpTool('fixture', 'structured', { cwd });
    expect(hiddenTool.exitCode).not.toBe(0);
    expect(hiddenTool.error).toContain('Tool not found: fixture/structured');

    const grep = await grepMcpTools('*', { cwd });
    expect(grep.matches.map((match) => match.tool.name)).toEqual(['echo', 'multi_content']);
  });
});
