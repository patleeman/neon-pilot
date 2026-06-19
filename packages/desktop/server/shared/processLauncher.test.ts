import { afterEach, describe, expect, it } from 'vitest';

import { clearProcessWrappers, execFileProcess, execGitProcessSync, registerProcessWrapper } from './processLauncher.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('processLauncher', () => {
  afterEach(() => {
    clearProcessWrappers();
  });

  it('terminates shell command descendants on abort', async () => {
    const controller = new AbortController();
    const marker = `pa-process-abort-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const run = execFileProcess({
      command: 'sh',
      args: ['-lc', `node -e "process.title='${marker}'; setInterval(()=>{}, 1000)"`],
      signal: controller.signal,
    });

    await sleep(250);
    controller.abort();
    await expect(run).rejects.toThrow(/aborted/i);
    await sleep(250);

    const ps = await execFileProcess({ command: 'sh', args: ['-lc', `ps -axo command | grep ${marker} | grep -v grep || true`] });
    expect(ps.stdout.trim()).toBe('');
  });

  it('applies registered wrappers to synchronous git commands', () => {
    registerProcessWrapper('git-wrapper-test', (context) => ({
      ...context,
      args: [...context.args, 'wrapped-value'],
    }));

    const result = execGitProcessSync({
      args: ['rev-parse', '--show-prefix', '--'],
      cwd: process.cwd(),
    });

    expect(result.launch.command).toBe('git');
    expect(result.launch.args).toEqual(['-c', 'core.fsmonitor=false', 'rev-parse', '--show-prefix', '--', 'wrapped-value']);
    expect(result.launch.wrappers).toEqual([{ id: 'git-wrapper-test', label: undefined }]);
    expect(result.stdout).toContain('wrapped-value');
  });
});
