import { describe, expect, it } from 'vitest';

import type { MessageBlock } from '../../shared/types';
import { buildToolPreview, collectTraceClusterLinkedRuns, normalizeRunLabel, readLinkedRuns } from './linkedRuns.js';

function runToolBlock(overrides: Partial<Extract<MessageBlock, { type: 'tool_use' }>>): Extract<MessageBlock, { type: 'tool_use' }> {
  return {
    type: 'tool_use',
    ts: '2026-04-26T00:00:00.000Z',
    tool: 'run',
    input: {},
    output: '',
    ...overrides,
  };
}

describe('linkedRuns', () => {
  it('normalizes labels for stable comparisons', () => {
    expect(normalizeRunLabel('Background_Run  Thing')).toBe('background run thing');
  });

  it('builds compact previews for run tool actions', () => {
    expect(buildToolPreview(runToolBlock({ details: { action: 'list' } }))).toBe('list background work');
    expect(buildToolPreview(runToolBlock({ details: { action: 'logs', runId: 'run-debug-router-abc123' } }))).toBe('logs Debug router');
    expect(buildToolPreview(runToolBlock({ details: { action: 'start_agent', prompt: '# Fix architecture\n\nPlease do it' } }))).toBe(
      'start_agent Fix architecture',
    );
  });

  it('builds useful previews for object-valued tool commands', () => {
    expect(
      buildToolPreview({
        type: 'tool_use',
        ts: '2026-04-26T00:00:00.000Z',
        tool: 'browser_cdp',
        input: { command: { method: 'Page.navigate', params: { url: 'https://excalidraw.com/' } } },
        output: '',
      }),
    ).toBe('Page.navigate excalidraw.com/');

    expect(
      buildToolPreview({
        type: 'tool_use',
        ts: '2026-04-26T00:00:00.000Z',
        tool: 'browser_cdp',
        input: { command: [{ method: 'Runtime.evaluate' }, { method: 'DOM.getDocument' }] },
        output: '',
      }),
    ).toBe('Runtime.evaluate, DOM.getDocument');
  });

  it('builds compact previews for common non-rendered tools', () => {
    const base = {
      type: 'tool_use' as const,
      ts: '2026-04-26T00:00:00.000Z',
      output: '',
    };

    expect(buildToolPreview({ ...base, tool: 'goal', input: { objective: 'Ship the improved tool previews.' } })).toBe(
      'Ship the improved tool previews.',
    );
    expect(
      buildToolPreview({ ...base, tool: 'scheduled_task', input: { action: 'save', title: 'Daily inbox sweep', cron: '0 9 * * *' } }),
    ).toBe('save Daily inbox sweep · 0 9 * * *');
    expect(
      buildToolPreview({ ...base, tool: 'deferred_resume', input: { action: 'add', delay: '30m', prompt: 'Check build status' } }),
    ).toBe('add 30m · Check build status');
    expect(
      buildToolPreview({
        ...base,
        tool: 'conversation_queue',
        input: { action: 'add', title: 'Deferred resume smoke test', delay: '1 minute', prompt: 'Confirm the queued continuation fired.' },
      }),
    ).toBe('add Deferred resume smoke test · 1 minute · Confirm the queued continuation fired.');
    expect(buildToolPreview({ ...base, tool: 'artifact', input: { action: 'save', title: 'Architecture diagram' } })).toBe(
      'save Architecture diagram',
    );
    expect(buildToolPreview({ ...base, tool: 'checkpoint', input: { action: 'save', message: 'fix goal tool preview' } })).toBe(
      'save fix goal tool preview',
    );
    expect(buildToolPreview({ ...base, tool: 'ask_user_question', input: { question: 'Which deployment target?' } })).toBe(
      'Which deployment target?',
    );
    expect(buildToolPreview({ ...base, tool: 'set_conversation_title', input: { title: 'Tool Preview Polish' } })).toBe(
      'Tool Preview Polish',
    );
    expect(buildToolPreview({ ...base, tool: 'mcp', input: { server: 'github', tool: 'create_issue' } })).toBe('github.create_issue');
    expect(buildToolPreview({ ...base, tool: 'background_bash', input: { action: 'start', command: 'pnpm test' } })).toBe(
      'start pnpm test',
    );
    expect(buildToolPreview({ ...base, tool: 'conversation', input: { action: 'ask', question: 'Which target?' } })).toBe(
      'ask Which target?',
    );
    expect(buildToolPreview({ ...base, tool: 'browser_snapshot', input: {} })).toBe('snapshot active tab');
    expect(buildToolPreview({ ...base, tool: 'browser_screenshot', input: { tabId: 'tab-1' } })).toBe('tab tab-1');
  });

  it('presents listed durable runs with kind and status detail', () => {
    const linkedRuns = readLinkedRuns(
      runToolBlock({
        details: {
          action: 'list',
          runs: [
            { runId: 'run-chat-cleanup-abc123', status: 'running', kind: 'background-run' },
            { runId: 'task-nightly-review', status: 'queued', source: 'scheduled-task' },
            { runId: 'run-chat-cleanup-abc123', status: 'running', kind: 'background-run' },
          ],
        },
      }),
    );

    expect(linkedRuns).toEqual({
      scope: 'listed',
      runs: [
        { runId: 'run-chat-cleanup-abc123', title: 'Chat cleanup', detail: 'running · background task' },
        { runId: 'task-nightly-review', title: 'Nightly review', detail: 'queued · automation execution' },
      ],
    });
  });

  it('presents non-list run actions from detail fields', () => {
    const linkedRuns = readLinkedRuns(
      runToolBlock({
        status: 'running',
        details: {
          action: 'start_agent',
          runId: 'run-architecture-pass-abc123',
          prompt: 'Improve the chat architecture by extracting linked runs.',
          taskSlug: 'architecture-pass',
          cwd: '/Users/patrick/workingdir/neon-pilot',
          model: 'openai/gpt-5.1',
        },
      }),
    );

    expect(linkedRuns.scope).toBe('mentioned');
    expect(linkedRuns.runs).toEqual([
      {
        runId: 'run-architecture-pass-abc123',
        title: 'Improve the chat architecture by extracting linked runs.',
        detail: 'running · agent task · architecture-pass · cwd neon-pilot · gpt-5.1',
      },
    ]);
  });

  it('ignores durable run ids mentioned in generic tool blocks', () => {
    const linkedRuns = readLinkedRuns({
      type: 'tool_use',
      ts: '2026-04-26T00:00:00.000Z',
      tool: 'bash',
      input: { command: 'echo run-foo-bar-abc123' },
      output: 'started run-foo-bar-abc123',
    });

    expect(linkedRuns).toEqual({
      scope: 'mentioned',
      runs: [],
    });
  });

  it('links background shell starts to their inline run card', () => {
    const startBlock: Extract<MessageBlock, { type: 'tool_use' }> = {
      type: 'tool_use',
      ts: '2026-04-26T00:00:00.000Z',
      tool: 'bash',
      input: { command: 'npm run desktop:dev', background: true },
      output: 'Started background command run-desktop-dev-abc123 for desktop-dev.',
      details: { action: 'start', runId: 'run-desktop-dev-abc123' },
    };
    const inspectBlock: Extract<MessageBlock, { type: 'tool_use' }> = {
      type: 'tool_use',
      ts: '2026-04-26T00:00:00.000Z',
      tool: 'background_command',
      input: { action: 'logs', runId: 'run-desktop-dev-abc123' },
      output: 'Run logs: run-desktop-dev-abc123',
      details: { action: 'logs', runId: 'run-desktop-dev-abc123' },
    };

    expect(readLinkedRuns(startBlock)).toEqual({
      scope: 'mentioned',
      runs: [{ runId: 'run-desktop-dev-abc123', title: 'Desktop dev', detail: 'background task' }],
    });
    expect(readLinkedRuns(inspectBlock)).toEqual({ scope: 'mentioned', runs: [] });
    expect(collectTraceClusterLinkedRuns([startBlock, inspectBlock])).toEqual([
      { runId: 'run-desktop-dev-abc123', title: 'Desktop dev', detail: 'background task' },
    ]);
  });

  it('collects trace cluster linked runs from newest to oldest without duplicates', () => {
    const older = runToolBlock({ details: { action: 'logs', runId: 'run-old-cleanup-abc123' } });
    const newer = runToolBlock({ details: { action: 'logs', runId: 'run-new-cleanup-def456' } });
    const duplicateOlder = runToolBlock({ details: { action: 'logs', runId: 'run-old-cleanup-abc123' } });

    expect(
      collectTraceClusterLinkedRuns([older, { type: 'thinking', ts: '2026-04-26T00:00:00.000Z', text: 'thinking' }, newer, duplicateOlder]),
    ).toEqual([
      { runId: 'run-old-cleanup-abc123', title: 'Old cleanup', detail: 'log view' },
      { runId: 'run-new-cleanup-def456', title: 'New cleanup', detail: 'log view' },
    ]);
  });

  it('does not promote bulk run list results to trace cluster linked cards', () => {
    const listRuns = runToolBlock({
      details: {
        action: 'list',
        runs: [
          { runId: 'run-old-cleanup-abc123', status: 'completed', kind: 'background-run' },
          { runId: 'run-new-cleanup-def456', status: 'running', kind: 'background-run' },
        ],
      },
    });
    const activeRun = runToolBlock({ details: { action: 'logs', runId: 'run-new-cleanup-def456' } });

    expect(collectTraceClusterLinkedRuns([listRuns, activeRun])).toEqual([
      { runId: 'run-new-cleanup-def456', title: 'New cleanup', detail: 'log view' },
    ]);
  });
});
