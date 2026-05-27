import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getDefaultMachineInstructionFiles,
  getDefaultMachineSkillDirs,
  getMachineConfigFilePath,
  readMachineConfigSection,
  readMachineInstructionFiles,
  readMachineSkillDirs,
  readMachineSystemPromptTemplate,
  updateMachineConfigSection,
  writeMachineInstructionFiles,
  writeMachineSkillDirs,
  writeMachineSystemPromptTemplate,
} from './machine-config.js';

const originalEnv = process.env;
const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('machine config', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    process.env = originalEnv;
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('uses only NEON_PILOT_CONFIG_FILE for the shared machine config path', () => {
    const configDir = createTempDir('pa-machine-config-');
    const daemonConfigPath = join(configDir, 'daemon.json');
    process.env.NEON_PILOT_DAEMON_CONFIG = daemonConfigPath;

    const resolvedPath = getMachineConfigFilePath();
    expect(resolvedPath).not.toBe(daemonConfigPath);
    expect(resolvedPath.endsWith('/config.json')).toBe(true);

    process.env.NEON_PILOT_CONFIG_FILE = join(configDir, 'custom-config.json');
    expect(getMachineConfigFilePath()).toBe(join(configDir, 'custom-config.json'));
  });

  it('still honors legacy section-specific env overrides', () => {
    const configDir = createTempDir('pa-machine-config-');
    const daemonConfigPath = join(configDir, 'daemon.json');
    process.env.NEON_PILOT_DAEMON_CONFIG = daemonConfigPath;

    updateMachineConfigSection('daemon', () => ({ modules: { tasks: { pollIntervalMs: 5000 } } }));

    expect(readMachineConfigSection('daemon')).toEqual({ modules: { tasks: { pollIntervalMs: 5000 } } });
    expect(JSON.parse(readFileSync(daemonConfigPath, 'utf-8'))).toEqual({ modules: { tasks: { pollIntervalMs: 5000 } } });
  });

  it('ignores dangerous merge keys in machine config sections', () => {
    const configDir = createTempDir('pa-machine-config-');
    const raw = '{"daemon":{"__proto__":{"polluted":true},"constructor":{"polluted":true},"modules":{"tasks":true}}}';
    // Use raw JSON so __proto__ is an own parsed key, not an object literal prototype setter.
    writeFileSync(join(configDir, 'config.json'), raw);

    const section = readMachineConfigSection('daemon', { configRoot: configDir }) as Record<string, unknown>;
    expect(section.modules).toEqual({ tasks: true });
    expect('polluted' in section).toBe(false);
    expect(section).not.toHaveProperty('constructor');
  });

  it('reads and writes instruction files in config.json', () => {
    const configDir = createTempDir('pa-machine-config-');

    writeMachineInstructionFiles(
      [
        '/Users/patrick/Documents/neon-pilot/AGENTS.md',
        '  /Users/patrick/Documents/neon-pilot/skills/checkpoint/SKILL.md  ',
        '/Users/patrick/Documents/neon-pilot/AGENTS.md',
        '',
      ],
      { configRoot: configDir },
    );

    expect(readMachineInstructionFiles({ configRoot: configDir })).toEqual([
      ...getDefaultMachineInstructionFiles(),
      '/Users/patrick/Documents/neon-pilot/AGENTS.md',
      '/Users/patrick/Documents/neon-pilot/skills/checkpoint/SKILL.md',
    ]);
    expect(JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf-8'))).toEqual({
      instructionFiles: ['/Users/patrick/Documents/neon-pilot/AGENTS.md', '/Users/patrick/Documents/neon-pilot/skills/checkpoint/SKILL.md'],
    });

    writeMachineInstructionFiles([], { configRoot: configDir });
    expect(readMachineInstructionFiles({ configRoot: configDir })).toEqual(getDefaultMachineInstructionFiles());
    expect(JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf-8'))).toEqual({});
  });

  it('reads and writes skill directories in config.json', () => {
    const configDir = createTempDir('pa-machine-config-');

    writeMachineSkillDirs(
      [
        '/Users/patrick/Documents/neon-pilot/skills',
        '  /Users/patrick/Documents/shared-skills  ',
        '/Users/patrick/Documents/neon-pilot/skills',
        '',
      ],
      { configRoot: configDir },
    );

    expect(readMachineSkillDirs({ configRoot: configDir })).toEqual([
      ...getDefaultMachineSkillDirs(),
      '/Users/patrick/Documents/neon-pilot/skills',
      '/Users/patrick/Documents/shared-skills',
    ]);
    expect(JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf-8'))).toEqual({
      skillDirs: ['/Users/patrick/Documents/neon-pilot/skills', '/Users/patrick/Documents/shared-skills'],
    });

    writeMachineSkillDirs([], { configRoot: configDir });
    expect(readMachineSkillDirs({ configRoot: configDir })).toEqual(getDefaultMachineSkillDirs());
    expect(JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf-8'))).toEqual({});
  });

  it('reads and writes the system prompt template in config.json', () => {
    const configDir = createTempDir('pa-machine-config-');
    const customTemplate = '# Custom runtime\n\nKnowledge: {{ knowledge_root }}\n';

    writeMachineSystemPromptTemplate(customTemplate, { configRoot: configDir });

    expect(readMachineSystemPromptTemplate({ configRoot: configDir })).toBe(customTemplate);
    expect(JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf-8'))).toEqual({
      systemPromptTemplate: customTemplate,
    });

    writeMachineSystemPromptTemplate('', { configRoot: configDir });
    expect(readMachineSystemPromptTemplate({ configRoot: configDir })).toContain('# Neon Pilot defaults');
    expect(JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf-8'))).toEqual({});
  });
});
