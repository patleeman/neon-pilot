import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { readBundledSkillMcpManifests } from './mcp-bundled-config.js';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pa-mcp-bundled-config-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('mcp bundled config', () => {
  it('skips corrupt bundled skill mcp manifests', () => {
    const root = createTempDir();
    const good = join(root, 'good-skill');
    const bad = join(root, 'bad-skill');
    mkdirSync(good, { recursive: true });
    mkdirSync(bad, { recursive: true });
    writeFileSync(join(good, 'mcp.json'), JSON.stringify({ mcpServers: { filesystem: { command: 'npx' } } }));
    writeFileSync(join(bad, 'mcp.json'), '{ nope');

    expect(readBundledSkillMcpManifests([good, bad]).map((manifest) => manifest.skillName)).toEqual(['good-skill']);
  });

  it('auto-discovers mcp manifests in skill parent directories without naming conventions', () => {
    const root = createTempDir();
    const plainSkill = join(root, 'jira-helper');
    const nonMcpSkill = join(root, 'notes');
    mkdirSync(plainSkill, { recursive: true });
    mkdirSync(nonMcpSkill, { recursive: true });
    writeFileSync(join(plainSkill, 'SKILL.md'), '# Jira Helper');
    writeFileSync(
      join(plainSkill, 'mcp.json'),
      JSON.stringify({ mcpServers: { jira: { type: 'remote', url: 'https://example.test/mcp' } } }),
    );
    writeFileSync(join(nonMcpSkill, 'SKILL.md'), '# Notes');

    expect(readBundledSkillMcpManifests([root])).toEqual([
      {
        skillName: 'jira-helper',
        skillDir: plainSkill,
        manifestPath: join(plainSkill, 'mcp.json'),
        serverNames: ['jira'],
      },
    ]);
  });
});
