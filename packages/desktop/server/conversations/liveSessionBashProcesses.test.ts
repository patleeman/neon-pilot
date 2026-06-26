import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { abortConversationBashProcesses, createConversationBashOperations } from './liveSessionBashProcesses.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processListFor(marker: string): string {
  return execFileSync('sh', ['-lc', `ps -axo command | grep ${JSON.stringify(marker)} | grep -v grep || true`], {
    encoding: 'utf-8',
  });
}

describe('live session bash process tracking', () => {
  it('kills a running conversation bash process when the conversation is aborted', async () => {
    const operations = createConversationBashOperations();
    const marker = `neon-conversation-bash-abort-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const run = operations.exec(`node -e "process.title='${marker}'; setInterval(()=>{}, 1000)"`, process.cwd(), {
      onData: () => undefined,
      env: { ...process.env, NEON_PILOT_SOURCE_CONVERSATION_ID: 'conv-abort-test' },
    });

    await sleep(250);
    expect(processListFor(marker)).toContain(marker);
    expect(abortConversationBashProcesses('conv-abort-test')).toBe(1);

    await expect(run).resolves.toMatchObject({ exitCode: null, cancelled: true });
    await sleep(250);
    expect(processListFor(marker).trim()).toBe('');
  });

  it('kills a running conversation bash process registered by explicit conversation id', async () => {
    const operations = createConversationBashOperations({ conversationId: 'conv-explicit-abort-test' });
    const marker = `neon-conversation-bash-explicit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const run = operations.exec(`node -e "process.title='${marker}'; setInterval(()=>{}, 1000)"`, process.cwd(), {
      onData: () => undefined,
      env: { ...process.env },
    });

    await sleep(250);
    expect(processListFor(marker)).toContain(marker);
    expect(abortConversationBashProcesses('conv-explicit-abort-test')).toBe(1);

    await expect(run).resolves.toMatchObject({ exitCode: null, cancelled: true });
    await sleep(250);
    expect(processListFor(marker).trim()).toBe('');
  });

  it('kills a running conversation bash process when the tool AbortSignal fires', async () => {
    const operations = createConversationBashOperations();
    const controller = new AbortController();
    const marker = `neon-conversation-bash-signal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const run = operations.exec(`node -e "process.title='${marker}'; setInterval(()=>{}, 1000)"`, process.cwd(), {
      onData: () => undefined,
      signal: controller.signal,
      env: { ...process.env, NEON_PILOT_SOURCE_CONVERSATION_ID: 'conv-signal-test' },
    });

    await sleep(250);
    expect(processListFor(marker)).toContain(marker);
    controller.abort();

    await expect(run).resolves.toMatchObject({ exitCode: null, cancelled: true });
    await sleep(250);
    expect(processListFor(marker).trim()).toBe('');
  });
});
