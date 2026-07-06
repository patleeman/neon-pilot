import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildPiResourceArgs,
  type DesktopRootLayout,
  installPackageSource,
  listRuntimeScopes,
  materializeRuntimeResourcesToAgentDir,
  mergeJsonFiles,
  readPackageSourceTargetState,
  resolveDesktopRootLayout,
  resolveLocalRuntimeSettingsFilePath,
  resolveRuntimeResources,
} from './index.js';

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

function replaceEnv(nextEnv: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, nextEnv);
}

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), 'neon-pilot-home-'));
  tempDirs.push(home);
  replaceEnv({ ...originalEnv, HOME: home, NEON_PILOT_CONFIG_FILE: join(home, 'config', 'config.json') });
});

afterEach(async () => {
  replaceEnv(originalEnv);
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-resources-'));
  tempDirs.push(dir);
  return dir;
}

function createTempRuntimeConfigRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'neon-pilot-runtime-config-'));
  const runtimeConfigRoot = join(root, 'sync', '_profiles');
  mkdirSync(runtimeConfigRoot, { recursive: true });
  process.env.NEON_PILOT_KNOWLEDGE_ROOT = join(root, 'sync');
  tempDirs.push(root);
  return runtimeConfigRoot;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createDesktopRootLayout(root: string): DesktopRootLayout {
  return resolveDesktopRootLayout({ root });
}

describe('runtime resource loader', () => {
  it('exposes a single shared runtime scope', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(runtimeConfigRoot, 'datadog', 'settings.json'), JSON.stringify({}));

    const profiles = listRuntimeScopes({ repoRoot: repo, runtimeConfigRoot });
    expect(profiles).toEqual(['shared']);
  });

  it('resolves durable resources plus local overlays', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const syncRoot = join(runtimeConfigRoot, '..');
    const local = mkdtempSync(join(tmpdir(), 'neon-pilot-local-'));
    tempDirs.push(local);

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(syncRoot, 'AGENTS.md'), '# Durable shared\n');
    writeFile(join(runtimeConfigRoot, 'shared', 'settings.json'), JSON.stringify({ nested: { two: true } }));
    writeFile(join(runtimeConfigRoot, 'datadog', 'settings.json'), JSON.stringify({ datadog: true }));
    writeFile(
      join(syncRoot, 'skills', 'shared-skill', 'SKILL.md'),
      '---\nname: shared-skill\ndescription: Shared\nprofiles:\n  - shared\n---\n',
    );
    writeFile(
      join(syncRoot, 'skills', 'datadog-skill', 'SKILL.md'),
      '---\nname: datadog-skill\ndescription: Datadog\nprofiles:\n  - datadog\n---\n',
    );
    writeFile(join(local, 'agent/AGENTS.md'), '# Local\n');
    writeFile(join(local, 'agent/settings.json'), JSON.stringify({ localOnly: true }));

    const resolved = resolveRuntimeResources('datadog', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: local,
    });

    expect(resolved.layers.map((layer) => layer.name)).toEqual(['defaults', 'durable', 'local']);
    expect(resolved.agentsFiles).toEqual([
      join(repo, 'defaults/agent/AGENTS.md'),
      join(syncRoot, 'AGENTS.md'),
      join(local, 'agent', 'AGENTS.md'),
    ]);
    expect(resolved.settingsFiles).toEqual([join(runtimeConfigRoot, 'shared', 'settings.json'), join(local, 'agent', 'settings.json')]);
    expect(resolved.skillDirs).toEqual(
      expect.arrayContaining([join(syncRoot, 'skills', 'datadog-skill'), join(syncRoot, 'skills', 'shared-skill')]),
    );
    expect(resolved.extensionEntries).toEqual([]);
  });

  it('includes configured machine instruction files in the materialized AGENTS stack', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const syncRoot = join(runtimeConfigRoot, '..');
    const configRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-config-'));
    tempDirs.push(configRoot);

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(syncRoot, 'AGENTS.md'), '# Knowledge Root\n');
    writeFile(join(repo, 'custom-instructions.md'), '# Custom Instructions\n');
    writeFile(
      join(configRoot, 'config.json'),
      JSON.stringify({
        instructionFiles: [join(repo, 'custom-instructions.md')],
      }),
    );
    process.env.NEON_PILOT_CONFIG_FILE = join(configRoot, 'config.json');

    const resolved = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
    });

    expect(resolved.agentsFiles).toEqual([
      join(repo, 'defaults/agent/AGENTS.md'),
      join(syncRoot, 'AGENTS.md'),
      join(repo, 'custom-instructions.md'),
    ]);
  });

  it('loads shared agent instructions from the configured desktop root agents directory', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const desktopRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-desktop-root-'));
    const configRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-config-'));
    tempDirs.push(desktopRoot, configRoot);

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(desktopRoot, 'agents', 'AGENTS.md'), '# Shared desktop agents\n');
    writeFile(
      join(configRoot, 'config.json'),
      JSON.stringify({
        desktopRoot,
      }),
    );
    process.env.NEON_PILOT_CONFIG_FILE = join(configRoot, 'config.json');

    const resolved = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
    });

    expect(resolved.agentsFiles).toEqual([join(repo, 'defaults/agent/AGENTS.md'), join(desktopRoot, 'agents', 'AGENTS.md')]);
  });

  it('discovers project instruction files from repo root to cwd', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const cwd = join(repo, 'packages', 'app');

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(repo, 'AGENTS.md'), '# Repo agents\n');
    writeFile(join(repo, 'CLAUDE.md'), '# Repo claude\n');
    writeFile(join(repo, 'GEMINI.md'), '# Repo gemini\n');
    writeFile(join(repo, '.cursorrules'), 'Cursor rules\n');
    writeFile(join(repo, '.windsurfrules'), 'Windsurf rules\n');
    writeFile(join(repo, '.github', 'copilot-instructions.md'), '# Copilot\n');
    writeFile(join(repo, 'packages', 'AGENTS.md'), '# Packages agents\n');
    writeFile(join(cwd, 'CLAUDE.md'), '# App claude\n');

    const resolved = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
      cwd,
    });

    expect(resolved.agentsFiles).toEqual([
      join(repo, 'defaults/agent/AGENTS.md'),
      join(repo, '.github', 'copilot-instructions.md'),
      join(repo, 'AGENTS.md'),
      join(repo, 'CLAUDE.md'),
      join(repo, 'GEMINI.md'),
      join(repo, '.cursorrules'),
      join(repo, '.windsurfrules'),
      join(repo, 'packages', 'AGENTS.md'),
      join(cwd, 'CLAUDE.md'),
    ]);
  });

  it('includes configured machine skill directories alongside durable skills', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const syncRoot = join(runtimeConfigRoot, '..');
    const configRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-config-'));
    const externalSkillsDir = mkdtempSync(join(tmpdir(), 'neon-pilot-extra-skills-'));
    tempDirs.push(configRoot, externalSkillsDir);

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(
      join(syncRoot, 'skills', 'knowledge-skill', 'SKILL.md'),
      '---\nname: knowledge-skill\ndescription: Knowledge skill\n---\n# Knowledge Skill\n',
    );
    writeFile(
      join(externalSkillsDir, 'machine-skill', 'SKILL.md'),
      '---\nname: machine-skill\ndescription: Machine skill\n---\n# Machine Skill\n',
    );
    writeFile(
      join(configRoot, 'config.json'),
      JSON.stringify({
        skillDirs: [externalSkillsDir],
      }),
    );
    process.env.NEON_PILOT_CONFIG_FILE = join(configRoot, 'config.json');

    const resolved = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
    });

    expect(resolved.skillDirs).toEqual(
      expect.arrayContaining([join(syncRoot, 'skills', 'knowledge-skill'), join(externalSkillsDir, 'machine-skill')]),
    );
  });

  it('includes skill dirs regardless of profile metadata', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const syncRoot = join(runtimeConfigRoot, '..');

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(
      join(syncRoot, 'skills', 'datadog-helper', 'SKILL.md'),
      `---
name: datadog-helper
description: Use for Datadog helper workflows.
metadata:
  profile: datadog
---
# Datadog Helper
`,
    );

    const resolved = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
    });

    expect(resolved.skillDirs).toEqual(expect.arrayContaining([join(syncRoot, 'skills', 'datadog-helper')]));
  });

  it('merges json files in layer order', () => {
    const repo = createTempRepo();
    const fileA = join(repo, 'a.json');
    const fileB = join(repo, 'b.json');

    writeFile(fileA, JSON.stringify({ one: 1, nested: { a: true }, array: [1, 2] }));
    writeFile(fileB, JSON.stringify({ two: 2, nested: { b: true }, array: [3] }));

    const merged = mergeJsonFiles([fileA, fileB]);
    expect(merged).toEqual({
      one: 1,
      two: 2,
      nested: { a: true, b: true },
      array: [3],
    });
  });

  it('materializes merged files into runtime agent dir', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const syncRoot = join(runtimeConfigRoot, '..');
    const runtime = mkdtempSync(join(tmpdir(), 'neon-pilot-runtime-'));
    const localRuntimeConfigDir = mkdtempSync(join(tmpdir(), 'neon-pilot-local-'));
    tempDirs.push(runtime);
    tempDirs.push(localRuntimeConfigDir);
    process.env.NEON_PILOT_KNOWLEDGE_ROOT = syncRoot;

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(repo, 'defaults/agent/APPEND_SYSTEM.md'), 'shared append\n');
    writeFile(join(repo, 'defaults/agent/models.json'), JSON.stringify({ providers: { a: {} } }));
    writeFile(join(syncRoot, 'AGENTS.md'), '# Durable shared\n');
    writeFile(
      join(runtimeConfigRoot, 'shared', 'settings.json'),
      JSON.stringify({
        datadog: true,
        defaultProvider: 'openai-codex',
        defaultModel: 'gpt-5.4',
        defaultThinkingLevel: 'high',
      }),
    );
    writeFile(
      join(syncRoot, 'skills', 'checkpoint', 'SKILL.md'),
      `---
name: checkpoint
description: Commit and push the agent's current work.
---
# Checkpoint
`,
    );

    const resolved = resolveRuntimeResources('datadog', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir,
    });
    const result = materializeRuntimeResourcesToAgentDir(resolved, runtime);
    const runtimeSettings = JSON.parse(readFileSync(join(runtime, 'settings.json'), 'utf-8')) as Record<string, unknown>;
    const runtimePrompt = readFileSync(join(runtime, 'APPEND_SYSTEM.md'), 'utf-8');

    expect(result.writtenFiles.some((path) => path.endsWith('/AGENTS.md'))).toBe(true);
    expect(result.writtenFiles.some((path) => path.endsWith('/APPEND_SYSTEM.md'))).toBe(true);
    expect(result.writtenFiles.some((path) => path.endsWith('/settings.json'))).toBe(true);
    expect(result.writtenFiles.some((path) => path.endsWith('/models.json'))).toBe(true);
    expect(runtimePrompt).toContain('# Agent Instructions');
    expect(runtimePrompt).not.toContain(`Docs index: ${join(repo, 'docs', 'README.md')}`);
    expect(runtimePrompt).not.toContain(`Extension authoring docs: ${join(repo, 'docs', 'extensions.md')}`);
    expect(runtimePrompt).toContain('shared append');
    expect(runtimePrompt).not.toContain('<available_skills>');
    expect(runtimePrompt).not.toContain(join(syncRoot, 'skills', 'checkpoint', 'SKILL.md'));
    expect(runtimePrompt).not.toContain("Commit and push the agent's current work.");
    expect(runtimePrompt).not.toContain(`Primary knowledge path: ${syncRoot}`);
    expect(readFileSync(join(runtime, 'AGENTS.md'), 'utf-8')).toContain('# Durable shared');
    expect(runtimeSettings.defaultModel).toBe('gpt-5.4');
    expect(runtimeSettings.defaultProvider).toBe('openai-codex');
    expect(runtimeSettings.defaultThinkingLevel).toBe('high');
  });

  it('does not feed materialized runtime files back into themselves', () => {
    const repo = createTempRepo();
    const runtime = mkdtempSync(join(tmpdir(), 'neon-pilot-runtime-'));
    tempDirs.push(runtime);

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(repo, 'defaults/agent/APPEND_SYSTEM.md'), 'shared append\n');
    writeFile(join(runtime, 'AGENTS.md'), '# Stale materialized copy\n');
    writeFile(join(runtime, 'APPEND_SYSTEM.md'), 'stale append\n');

    const resolved = resolveRuntimeResources('shared', { repoRoot: repo });
    const result = materializeRuntimeResourcesToAgentDir(
      {
        ...resolved,
        agentsFiles: [join(runtime, 'AGENTS.md'), ...resolved.agentsFiles],
        appendSystemFiles: [join(runtime, 'APPEND_SYSTEM.md'), ...resolved.appendSystemFiles],
      },
      runtime,
    );

    const agentsContent = readFileSync(join(runtime, 'AGENTS.md'), 'utf-8');
    const appendContent = readFileSync(join(runtime, 'APPEND_SYSTEM.md'), 'utf-8');
    expect(result.writtenFiles.some((path) => path.endsWith('/AGENTS.md'))).toBe(true);
    expect(agentsContent).toContain('# Shared');
    expect(agentsContent).not.toContain('Stale materialized copy');
    expect(appendContent).toContain('shared append');
    expect(appendContent).not.toContain('stale append');
  });

  it('installs package sources into local settings', () => {
    const repo = createTempRepo();
    const local = mkdtempSync(join(tmpdir(), 'neon-pilot-local-'));
    tempDirs.push(local);

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(local, 'settings.json'), JSON.stringify({ packages: ['/existing-package'] }));

    const localInstall = installPackageSource({
      repoRoot: repo,
      localRuntimeConfigDir: local,
      source: './local-package',
      target: 'local',
      sourceBaseDir: repo,
    });

    expect(localInstall.installed).toBe(true);
    expect(localInstall.settingsPath).toBe(resolveLocalRuntimeSettingsFilePath({ localRuntimeConfigDir: local }));
    expect(readPackageSourceTargetState('local', { repoRoot: repo, localRuntimeConfigDir: local }).packages).toEqual([
      { source: '/existing-package', filtered: false },
      { source: join(repo, 'local-package'), filtered: false },
    ]);
  });

  it('uses supplied DesktopRootLayout to resolve agents path', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const customRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-custom-root-'));
    tempDirs.push(customRoot);
    const customLayout = createDesktopRootLayout(customRoot);
    const defaultLayout = resolveDesktopRootLayout();

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(customLayout.agents, 'AGENTS.md'), '# Custom desktop agents\n');
    writeFile(join(defaultLayout.agents, 'AGENTS.md'), '# Default desktop agents\n');

    const resolved = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
      desktopRootLayout: customLayout,
    });

    expect(resolved.agentsFiles).toContain(join(customLayout.agents, 'AGENTS.md'));
    expect(resolved.agentsFiles).not.toContain(join(defaultLayout.agents, 'AGENTS.md'));
  });

  it('omitting desktopRootLayout falls back to default layout resolution', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const customRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-custom-root-'));
    tempDirs.push(customRoot);
    const customLayout = createDesktopRootLayout(customRoot);
    const defaultLayout = resolveDesktopRootLayout();

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(customLayout.agents, 'AGENTS.md'), '# Custom desktop agents\n');
    writeFile(join(defaultLayout.agents, 'AGENTS.md'), '# Default desktop agents\n');

    const withoutOption = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
    });

    expect(withoutOption.agentsFiles).toContain(join(defaultLayout.agents, 'AGENTS.md'));
    expect(withoutOption.agentsFiles).not.toContain(join(customLayout.agents, 'AGENTS.md'));
  });

  it('builds pi args from resource directories', () => {
    const repo = createTempRepo();
    const runtimeConfigRoot = createTempRuntimeConfigRoot();
    const syncRoot = join(runtimeConfigRoot, '..');
    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(syncRoot, 'skills', 'test', 'SKILL.md'), '---\nname: test\ndescription: Skill\n---\n# Test\n');

    const resolved = resolveRuntimeResources('shared', {
      repoRoot: repo,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
    });
    const args = buildPiResourceArgs(resolved);

    expect(args).toContain('--no-extensions');
    expect(args).toContain('--skill');
    expect(args).toContain(join(syncRoot, 'skills', 'test'));
  });

  it('loads shared resources from canonical durable directories', () => {
    const repo = createTempRepo();
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-legacy-sync-'));
    const syncRoot = join(root, 'sync');
    const runtimeConfigRoot = join(syncRoot, '_profiles');
    tempDirs.push(root);

    writeFile(join(repo, 'defaults/agent/AGENTS.md'), '# Shared\n');
    writeFile(join(runtimeConfigRoot, 'shared', 'settings.json'), JSON.stringify({ defaultModel: 'gpt-5.4' }));
    writeFile(
      join(syncRoot, 'skills', 'checkpoint', 'SKILL.md'),
      `---
name: checkpoint
description: Commit your work.
---
# Checkpoint
`,
    );

    const profiles = listRuntimeScopes({ repoRoot: repo, runtimeConfigRoot });
    expect(profiles).toEqual(['shared']);

    const resolved = resolveRuntimeResources('default', {
      repoRoot: repo,
      knowledgeRoot: syncRoot,
      runtimeConfigRoot,
      localRuntimeConfigDir: join(repo, '.local-profile'),
    });

    expect(resolved.agentsFiles).toEqual([join(repo, 'defaults/agent/AGENTS.md')]);
    expect(resolved.settingsFiles).toContain(join(runtimeConfigRoot, 'shared', 'settings.json'));
    expect(resolved.skillDirs).toEqual(expect.arrayContaining([join(syncRoot, 'skills', 'checkpoint')]));
  });
});
