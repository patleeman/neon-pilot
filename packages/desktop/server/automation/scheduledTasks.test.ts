import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { closeAutomationDbs } from '@neon-pilot/daemon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getScheduledTaskStateFilePath,
  loadScheduledTaskRuntimeState,
  loadScheduledTasksForProfile,
  resolveScheduledTaskForProfile,
  taskDirForProfile,
  toScheduledTaskMetadata,
} from './scheduledTasks.js';
import { createStoredAutomation } from './store.js';

const tempDirs: string[] = [];
const originalEnv = process.env;

beforeEach(() => {
  const stateRoot = createTempDir('neon-pilot-web-scheduled-tasks-state-');
  process.env = {
    ...originalEnv,
    NEON_PILOT_STATE_ROOT: stateRoot,
    NEON_PILOT_DAEMON_SOCKET_PATH: join(stateRoot, 'd.sock'),
  };
});

afterEach(async () => {
  closeAutomationDbs();
  process.env = originalEnv;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createTempDir(prefix = 'neon-pilot-web-scheduled-tasks-'): string {
  const dir = mkdtempSync(join('/tmp', prefix));
  tempDirs.push(dir);
  return dir;
}

describe('scheduledTasks', () => {
  it('exposes runtime state from the automation database', () => {
    expect(getScheduledTaskStateFilePath()).toMatch(/runtime\.db$/);
    expect(loadScheduledTaskRuntimeState()).toEqual({});
  });

  it('loads stored automations and hydrates scheduled task metadata', () => {
    const validTaskId = `unit-daily-${randomUUID()}`;
    const task = createStoredAutomation({
      id: validTaskId,
      title: 'Daily task',
      enabled: true,
      cron: '0 9 * * *',
      prompt: 'Daily task\nInclude blockers.',
      modelRef: 'openai-codex/gpt-5.4',
      thinkingLevel: 'medium',
      allowedTools: ['read', 'bash'],
      cwd: '/tmp/workspace',
      timeoutSeconds: 900,
    });

    const loaded = loadScheduledTasksForProfile('assistant');

    expect(loaded.taskDir).toBe(taskDirForProfile('assistant'));
    expect(loaded.tasks.map((task) => task.id)).toContain(validTaskId);
    expect(loaded.parseErrors).toEqual([]);
    expect(loaded.runtimeEntries).toEqual([]);
    expect(toScheduledTaskMetadata(task)).toEqual({
      id: validTaskId,
      title: 'Daily task',
      enabled: true,
      targetType: 'background-agent',
      scheduleType: 'cron',
      cron: '0 9 * * *',
      at: undefined,
      profile: 'shared',
      model: 'openai-codex/gpt-5.4',
      thinkingLevel: 'medium',
      allowedTools: ['read', 'bash'],
      cwd: '/tmp/workspace',
      timeoutSeconds: 900,
      catchUpWindowSeconds: 900,
      prompt: 'Daily task',
      promptBody: 'Daily task\nInclude blockers.',
    });

    const resolved = resolveScheduledTaskForProfile('assistant', validTaskId);
    expect(resolved.task.id).toBe(validTaskId);
    expect(resolved.runtime).toBeUndefined();
  });

  it('throws when resolving a missing scheduled task', () => {
    expect(() => resolveScheduledTaskForProfile('assistant', 'missing-task')).toThrow('Task not found: missing-task');
  });
});
