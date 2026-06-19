import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  installMarketplacePackageAsExtension: vi.fn(),
  invalidateExtensionRegistryReadCaches: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/extensions', () => ({
  installMarketplacePackageAsExtension: mocks.installMarketplacePackageAsExtension,
  invalidateExtensionRegistryReadCaches: mocks.invalidateExtensionRegistryReadCaches,
}));

import { addPlugin, listPlugins, setPluginEnabled } from './backend.js';

function createContext(runtimeDir: string) {
  return {
    extensionId: 'system-agent-plugins',
    runtimeScope: 'default',
    runtimeDir,
    runtimeSettingsFilePath: join(runtimeDir, 'settings.json'),
    runtime: {
      getLiveSessionResourceOptions: vi.fn(),
      getRepoRoot: vi.fn(() => runtimeDir),
      refreshSkillMcpConfig: vi.fn(async () => ({ ok: true })),
    },
    shell: {
      exec: vi.fn(),
    },
    extensions: {
      setEnabled: vi.fn(),
    },
  } as never;
}

function createLocalPlugin() {
  const root = mkdtempSync(join(tmpdir(), 'np-agent-plugin-source-'));
  mkdirSync(join(root, '.codex-plugin'), { recursive: true });
  mkdirSync(join(root, 'skills', 'review'), { recursive: true });
  mkdirSync(join(root, 'hooks'), { recursive: true });
  writeFileSync(join(root, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'Review Pack' }));
  writeFileSync(join(root, 'skills', 'review', 'SKILL.md'), '# Review\n');
  writeFileSync(join(root, 'skills', 'review', 'mcp.json'), '{"mcpServers":{}}\n');
  writeFileSync(join(root, 'hooks', 'before_agent_start.md'), '# Hook\n');
  writeFileSync(join(root, 'AGENTS.md'), '# Agent docs\n');
  return root;
}

beforeEach(() => {
  mocks.installMarketplacePackageAsExtension.mockReset();
  mocks.invalidateExtensionRegistryReadCaches.mockReset();
  mocks.installMarketplacePackageAsExtension.mockImplementation(async ({ ecosystem, source, runtimeDir }) => ({
    installed: true,
    alreadyPresent: false,
    source,
    target: 'local',
    settingsPath: join(runtimeDir, 'settings.json'),
    extension: {
      id: `imported-${ecosystem}-agent-review-pack`,
      packageRoot: join(runtimeDir, 'extensions', `imported-${ecosystem}-agent-review-pack`),
      skillCount: 1,
      copiedSource: true,
    },
  }));
});

describe('system-agent-plugins backend', () => {
  it('adds a local plugin, scans capabilities, and records a wrapper extension', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-agent-plugin-runtime-'));
    const ctx = createContext(runtimeDir);
    const source = createLocalPlugin();

    const result = await addPlugin({ sourceKind: 'local', source, ecosystem: 'auto' }, ctx);

    expect(result.plugin).toMatchObject({
      displayName: 'Review Pack',
      ecosystem: 'codex',
      enabled: false,
      source: { kind: 'local', path: source },
      wrapperExtensionId: 'imported-codex-agent-review-pack',
      capabilities: {
        skills: [{ id: 'review', path: 'skills/review/SKILL.md' }],
        mcp: [{ path: 'skills/review/mcp.json' }],
        docs: [{ path: 'AGENTS.md' }],
      },
    });
    expect(result.plugin.capabilities.hooks).toEqual([{ kind: 'hooks', path: 'hooks/before_agent_start.md' }]);
    expect(result.plugin.compatibility.warnings).toContain(
      'Hook files are indexed but not executed until mapped to Neon Pilot lifecycle boundaries.',
    );
    expect(mocks.installMarketplacePackageAsExtension).toHaveBeenCalledWith(
      expect.objectContaining({ ecosystem: 'codex', packageType: 'agent', source, runtimeDir }),
    );
    expect(ctx.extensions.setEnabled).toHaveBeenCalledWith('imported-codex-agent-review-pack', false);
    expect(mocks.invalidateExtensionRegistryReadCaches).toHaveBeenCalled();
    expect(ctx.runtime.refreshSkillMcpConfig).toHaveBeenCalled();

    const registry = JSON.parse(readFileSync(join(runtimeDir, 'plugins', 'registry.json'), 'utf-8'));
    expect(registry.plugins).toHaveLength(1);
  });

  it('enables an installed plugin without losing scan metadata', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-agent-plugin-runtime-'));
    const ctx = createContext(runtimeDir);
    const source = createLocalPlugin();
    const added = await addPlugin({ sourceKind: 'local', source, ecosystem: 'codex' }, ctx);

    const result = await setPluginEnabled({ id: added.plugin.id, enabled: true }, ctx);
    const listed = await listPlugins({}, ctx);

    expect(result.plugin).toMatchObject({ id: added.plugin.id, enabled: true, status: 'enabled' });
    expect(listed.plugins[0]).toMatchObject({ id: added.plugin.id, enabled: true, capabilities: added.plugin.capabilities });
    expect(ctx.extensions.setEnabled).toHaveBeenCalledWith('imported-codex-agent-review-pack', true);
  });

  it('rejects missing local plugin directories', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'np-agent-plugin-runtime-'));
    const ctx = createContext(runtimeDir);

    await expect(addPlugin({ sourceKind: 'local', source: join(runtimeDir, 'missing') }, ctx)).rejects.toThrow(
      'Local plugin source must be an existing directory.',
    );
  });
});
