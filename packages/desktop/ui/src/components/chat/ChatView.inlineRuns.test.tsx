// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext } from '../../app/contexts';
import type { DurableRunRecord, MessageBlock } from '../../shared/types';
import { runStore } from '../../store';
import { ChatView } from './ChatView';
import { INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT, type InlineTraceRunCommandDetail } from './inlineTraceRunCommands';

const apiMocks = vi.hoisted(() => ({
  durableRun: vi.fn(),
  durableRunLog: vi.fn(),
}));

vi.mock('../../client/api', () => ({
  api: apiMocks,
}));

const RUN_ID = 'run-ui-preview-check-2026-03-25T00-53-25-347Z-903aa31b';
const mountedRoots: Root[] = [];

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function createRunRecord(): DurableRunRecord {
  return {
    runId: RUN_ID,
    paths: {
      root: `/tmp/runs/${RUN_ID}`,
      manifestPath: `/tmp/runs/${RUN_ID}/manifest.json`,
      statusPath: `/tmp/runs/${RUN_ID}/status.json`,
      checkpointPath: `/tmp/runs/${RUN_ID}/checkpoint.json`,
      eventsPath: `/tmp/runs/${RUN_ID}/events.jsonl`,
      outputLogPath: `/tmp/runs/${RUN_ID}/output.log`,
      resultPath: `/tmp/runs/${RUN_ID}/result.json`,
    },
    manifest: {
      version: 1,
      id: RUN_ID,
      kind: 'background-run',
      resumePolicy: 'continue',
      createdAt: '2026-04-14T01:23:19.371Z',
      spec: {
        metadata: {
          taskSlug: 'ui-preview-check',
        },
      },
      source: {
        type: 'tool',
        id: 'conv-123',
      },
    },
    status: {
      version: 1,
      runId: RUN_ID,
      status: 'running',
      createdAt: '2026-04-14T01:23:19.371Z',
      updatedAt: '2026-04-14T01:24:01.000Z',
      activeAttempt: 1,
      startedAt: '2026-04-14T01:23:19.900Z',
    },
    problems: [],
    recoveryAction: 'none',
  };
}

function createShellRunRecord(): DurableRunRecord {
  return {
    ...createRunRecord(),
    manifest: {
      version: 1,
      id: RUN_ID,
      kind: 'raw-shell',
      resumePolicy: 'manual',
      createdAt: '2026-04-14T01:23:19.371Z',
      spec: {
        target: {
          type: 'shell',
          command: 'for i in {1..3}; do echo tick-$i; done',
          cwd: '/tmp/worktree',
        },
        metadata: {
          taskSlug: 'ui-preview-check',
          cwd: '/tmp/worktree',
        },
      },
      source: {
        type: 'tool',
        id: 'conv-123',
      },
    },
  };
}

function createCompletedShellRunRecord(): DurableRunRecord {
  return {
    ...createShellRunRecord(),
    status: {
      version: 1,
      runId: RUN_ID,
      status: 'complete',
      createdAt: '2026-04-14T01:23:19.371Z',
      updatedAt: '2026-04-14T01:24:01.000Z',
      activeAttempt: null,
      startedAt: '2026-04-14T01:23:19.900Z',
      completedAt: '2026-04-14T01:24:01.000Z',
    },
  };
}

function renderChatView(messages: MessageBlock[], options?: { listedRuns?: DurableRunRecord[] }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const listedRuns = options?.listedRuns ?? [createRunRecord()];

  // Seed the reactive entity store so ToolBlock's useAllRuns() finds the runs
  runStore.replaceAll(listedRuns);

  act(() => {
    root.render(
      <AppDataContext.Provider
        value={{
          projects: null,
          sessions: null,
          tasks: null,
          runs: {
            scannedAt: '2026-03-11T18:00:10.000Z',
            runsRoot: '/tmp/runs',
            summary: {
              total: listedRuns.length,
              recoveryActions: {},
              statuses: listedRuns.length > 0 ? { running: listedRuns.length } : {},
            },
            runs: listedRuns,
          },
          setProjects: () => {},
          setSessions: () => {},
          setTasks: () => {},
          setRuns: () => {},
        }}
      >
        <ChatView messages={messages} isStreaming={false} />
      </AppDataContext.Provider>,
    );
  });

  mountedRoots.push(root);
  return { container, root };
}

function findInlineRunButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button[aria-expanded]'))
    .filter((button): button is HTMLButtonElement => button instanceof HTMLButtonElement)
    .filter((button) => button.textContent?.includes('ui-preview-check') ?? false);
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function flushAnimationFrames() {
  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
}

describe('ChatView inline run cards', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.durableRun.mockReset();
    apiMocks.durableRunLog.mockReset();
    apiMocks.durableRun.mockResolvedValue({
      scannedAt: '2026-03-11T18:00:10.000Z',
      runsRoot: '/tmp/runs',
      run: createRunRecord(),
    });
    apiMocks.durableRunLog.mockResolvedValue({
      path: `/tmp/runs/${RUN_ID}/output.log`,
      log: 'ok',
    });

    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame;
    }
    if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame = ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
    }
  });

  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
  });

  it('keeps repeated raw linked run cards collapsed until the specific card is expanded', async () => {
    const callbackText = [
      `Durable run ${RUN_ID} has finished.`,
      'taskSlug=ui-preview-check',
      'status=completed',
      `log=/tmp/runs/${RUN_ID}/output.log`,
      'command=npm test',
      '',
      'Recent log tail:',
      'very noisy callback output',
    ].join('\n');
    const { container } = renderChatView([
      {
        type: 'text',
        ts: '2026-03-11T18:00:00.000Z',
        text: callbackText,
      },
      {
        type: 'text',
        ts: '2026-03-11T18:00:01.000Z',
        text: callbackText,
      },
    ]);

    expect(apiMocks.durableRun).not.toHaveBeenCalled();
    expect(apiMocks.durableRunLog).not.toHaveBeenCalled();

    let runButtons = findInlineRunButtons(container);
    expect(runButtons).toHaveLength(2);
    expect(runButtons[0]?.getAttribute('aria-expanded')).toBe('false');
    expect(runButtons[1]?.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Live log updating');

    await act(async () => {
      runButtons[0]?.click();
      await flushAsyncWork();
    });

    runButtons = findInlineRunButtons(container);
    expect(runButtons).toHaveLength(2);
    expect(runButtons[0]?.getAttribute('aria-expanded')).toBe('true');
    expect(runButtons[1]?.getAttribute('aria-expanded')).toBe('false');
    expect(apiMocks.durableRun).toHaveBeenCalledTimes(1);
    expect(apiMocks.durableRun).toHaveBeenCalledWith(RUN_ID);
    expect(apiMocks.durableRunLog).toHaveBeenCalledTimes(1);
    expect(apiMocks.durableRunLog).toHaveBeenCalledWith(RUN_ID, 240);
    expect(container.textContent).toContain('Live log updating');
  });

  it('shows a friendly unavailable state when a raw linked run record cannot be loaded', async () => {
    apiMocks.durableRun.mockRejectedValue(
      new Error("Error invoking remote method 'neon-pilot-desktop:read-durable-run': Error: Run not found"),
    );
    apiMocks.durableRunLog.mockRejectedValue(new Error('Run not found'));

    const { container } = renderChatView([
      {
        type: 'text',
        ts: '2026-03-11T18:00:00.000Z',
        text: [
          `Durable run ${RUN_ID} has finished.`,
          'taskSlug=ui-preview-check',
          'status=completed',
          `log=/tmp/runs/${RUN_ID}/output.log`,
          'command=npm test',
          '',
          'Recent log tail:',
          'very noisy callback output',
        ].join('\n'),
      },
    ]);
    const runButtons = findInlineRunButtons(container);
    expect(runButtons).toHaveLength(1);

    await act(async () => {
      runButtons[0]?.click();
      await flushAsyncWork();
    });

    expect(apiMocks.durableRun).toHaveBeenCalledWith(RUN_ID);
    expect(container.textContent).toContain('Background task unavailable');
    expect(container.textContent).toContain('It may have been cleaned up or belongs to an older dev session.');
    expect(container.textContent).not.toContain('Error invoking remote method');
  });

  it('collapses raw delivered run callbacks into a clickable run card', async () => {
    const { container } = renderChatView([
      {
        type: 'text',
        ts: '2026-03-11T18:00:00.000Z',
        text: [
          `Durable run ${RUN_ID} has finished.`,
          'taskSlug=ui-preview-check',
          'status=completed',
          `log=/tmp/runs/${RUN_ID}/output.log`,
          'command=npm test',
          '',
          'Recent log tail:',
          'very noisy callback output',
        ].join('\n'),
      },
    ]);

    expect(container.textContent).toContain('Background work finished.');
    expect(container.textContent).toContain('ui-preview-check');
    expect(container.textContent).not.toContain('very noisy callback output');
    expect(apiMocks.durableRun).not.toHaveBeenCalled();

    const runButtons = findInlineRunButtons(container);
    expect(runButtons).toHaveLength(1);
    expect(runButtons[0]?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      runButtons[0]?.click();
      await flushAsyncWork();
    });

    expect(apiMocks.durableRun).toHaveBeenCalledWith(RUN_ID);
    expect(apiMocks.durableRunLog).toHaveBeenCalledWith(RUN_ID, 240);
    expect(container.textContent).toContain('Live log updating');
  });

  it('toggles the first inline run card from the shared command event', async () => {
    const { container } = renderChatView([
      {
        type: 'text',
        ts: '2026-03-11T18:00:00.000Z',
        text: [
          `Durable run ${RUN_ID} has finished.`,
          'taskSlug=ui-preview-check',
          'status=completed',
          `log=/tmp/runs/${RUN_ID}/output.log`,
          'command=npm test',
          '',
          'Recent log tail:',
          'very noisy callback output',
        ].join('\n'),
      },
    ]);

    let runButtons = findInlineRunButtons(container);
    expect(runButtons.length).toBeGreaterThan(0);
    expect(runButtons[0]?.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Live log updating');

    await act(async () => {
      window.dispatchEvent(new CustomEvent<InlineTraceRunCommandDetail>(INLINE_TRACE_RUN_TOGGLE_FIRST_COMMAND_EVENT, { detail: {} }));
      await flushAsyncWork();
    });

    runButtons = findInlineRunButtons(container);
    expect(runButtons[0]?.getAttribute('aria-expanded')).toBe('true');
    expect(apiMocks.durableRun).toHaveBeenCalledWith(RUN_ID);
    expect(apiMocks.durableRunLog).toHaveBeenCalledWith(RUN_ID, 240);
    expect(container.textContent).toContain('Live log updating');
  });

  it('collapses raw run callback user messages into a clickable run card', async () => {
    const { container } = renderChatView([
      {
        type: 'user',
        ts: '2026-03-11T18:00:00.000Z',
        text: [
          `Background task ${RUN_ID} has finished.`,
          'taskSlug=ui-preview-check',
          'status=completed',
          `log=/tmp/runs/${RUN_ID}/output.log`,
          'command=npm test',
          '',
          'Recent log tail:',
          'very noisy callback output',
          '',
          'Use run get/logs if you need more detail. Then continue from this point.',
        ].join('\n'),
      },
    ]);

    expect(container.textContent).toContain('Background work finished.');
    expect(container.textContent).toContain('ui-preview-check');
    expect(container.textContent).not.toContain('very noisy callback output');
    expect(container.textContent).not.toContain('/tmp/runs/');

    const runButtons = findInlineRunButtons(container);
    expect(runButtons).toHaveLength(1);

    await act(async () => {
      runButtons[0]?.click();
      await flushAsyncWork();
    });

    expect(apiMocks.durableRun).toHaveBeenCalledWith(RUN_ID);
    expect(apiMocks.durableRunLog).toHaveBeenCalledWith(RUN_ID, 240);
  });

  it('collapses raw run callback context blocks into a clickable run card', async () => {
    const { container } = renderChatView([
      {
        type: 'context',
        ts: '2026-03-11T18:00:00.000Z',
        customType: 'referenced_context',
        text: [
          `Background task ${RUN_ID} has finished.`,
          'taskSlug=ui-preview-check',
          'status=failed',
          `log=/tmp/runs/${RUN_ID}/output.log`,
          'command=npm test',
          '',
          'Recent log tail:',
          'very noisy callback output',
        ].join('\n'),
      },
    ]);

    expect(container.textContent).toContain(`Background task ${RUN_ID} has finished.`);
    expect(container.textContent).toContain('ui-preview-check');
    expect(container.textContent).not.toContain('very noisy callback output');

    const runButtons = findInlineRunButtons(container);
    expect(runButtons).toHaveLength(0);
    expect(apiMocks.durableRun).not.toHaveBeenCalled();
  });

  it('renders background bash output inline with the tool chrome instead of generic JSON', async () => {
    apiMocks.durableRun.mockResolvedValue({
      scannedAt: '2026-03-11T18:00:10.000Z',
      runsRoot: '/tmp/runs',
      run: createShellRunRecord(),
    });
    apiMocks.durableRunLog.mockResolvedValue({
      path: `/tmp/runs/${RUN_ID}/output.log`,
      log: 'tick-1\ntick-2\ntick-3',
    });

    const { container } = renderChatView(
      [
        {
          type: 'tool_use',
          ts: '2026-03-11T18:00:00.000Z',
          tool: 'bash',
          input: {
            command: 'for i in {1..3}; do echo tick-$i; done',
            background: true,
          },
          output: `Started background command ${RUN_ID} for ui-preview-check.`,
          status: 'ok',
          details: { action: 'start', runId: RUN_ID },
        },
      ],
      { listedRuns: [createShellRunRecord()] },
    );

    expect(container.textContent).toContain('bash');
    expect(container.textContent).toContain('background task');
    expect(container.textContent).not.toContain('"background"');
    expect(container.textContent).not.toContain('INPUT');
    expect(container.textContent).not.toContain('OUTPUT');

    const clusterButton = container.querySelector('button[aria-expanded]') as HTMLButtonElement | null;
    expect(clusterButton?.textContent).toContain('Internal work');
    await act(async () => {
      clusterButton?.click();
      await flushAsyncWork();
    });
    const toolButton = container.querySelector('[data-background-run-id]') as HTMLElement | null;
    await act(async () => {
      toolButton?.click();
      await flushAsyncWork();
    });

    expect(apiMocks.durableRun).toHaveBeenCalledWith(RUN_ID);
    expect(apiMocks.durableRunLog).toHaveBeenCalledWith(RUN_ID, 240);
    expect(container.textContent).toContain('$ for i in {1..3}; do echo tick-$i; done');
    expect(container.textContent).toContain('tick-1');
    expect(container.textContent).toContain('tick-3');
  });

  it('does not fetch logs for completed background bash starts in historical transcripts', async () => {
    const { container } = renderChatView(
      [
        {
          type: 'tool_use',
          ts: '2026-03-11T18:00:00.000Z',
          tool: 'bash',
          input: {
            command: 'echo historical',
            background: true,
          },
          output: `Started background command ${RUN_ID} for ui-preview-check.`,
          status: 'ok',
          details: { action: 'start', runId: RUN_ID },
        },
      ],
      { listedRuns: [createCompletedShellRunRecord()] },
    );

    const clusterButton = container.querySelector('button[aria-expanded]') as HTMLButtonElement | null;
    await act(async () => {
      clusterButton?.click();
      await flushAsyncWork();
    });
    const toolButton = container.querySelector('[data-background-run-id]') as HTMLElement | null;
    await act(async () => {
      toolButton?.click();
      await flushAsyncWork();
    });

    expect(apiMocks.durableRun).not.toHaveBeenCalled();
    expect(apiMocks.durableRunLog).not.toHaveBeenCalled();
    expect(container.textContent).toContain('(no output)');
  });

  it('expands subagent tool output when linked work has no viewable conversation', async () => {
    const { container } = renderChatView(
      [
        {
          type: 'tool_use',
          ts: '2026-03-11T18:00:00.000Z',
          tool: 'subagent',
          input: {
            action: 'status',
            taskSlug: 'scout-ui-surface',
          },
          output: `Detailed status for ${RUN_ID}: still running.`,
          status: 'ok',
          details: { action: 'status', runId: RUN_ID },
        },
      ],
      { listedRuns: [] },
    );

    expect(container.textContent).toContain('Internal work');
    expect(container.textContent).toContain('scout-ui-surface');
    expect(container.textContent).not.toContain('Detailed status');

    const toolHeader = Array.from(container.querySelectorAll('[role="button"]')).find((element) =>
      element.textContent?.includes('scout-ui-surface'),
    ) as HTMLElement | undefined;
    await act(async () => {
      toolHeader?.click();
      await flushAsyncWork();
    });

    expect(container.textContent).toContain('Detailed status');
  });

  it('focuses a background bash run event by expanding the trace cluster without opening tool output', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = renderChatView(
      [
        {
          type: 'tool_use',
          ts: '2026-03-11T18:00:00.000Z',
          tool: 'bash',
          input: { command: 'echo background', background: true },
          output: `Started background command ${RUN_ID} for ui-preview-check.`,
          status: 'ok',
          details: { action: 'start', runId: RUN_ID },
        },
      ],
      { listedRuns: [createShellRunRecord()] },
    );

    expect(container.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-trace-cluster-start-index="0"]')).not.toBeNull();

    await act(async () => {
      await flushAsyncWork();
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('pa:focus-background-run', { detail: { runId: RUN_ID } }));
      await flushAsyncWork();
      await flushAnimationFrames();
      await flushAsyncWork();
    });

    expect(scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector(`[data-transcript-target="background_run:${RUN_ID}"]`)).not.toBeNull();
    expect(container.textContent).toContain('echo background');
    expect(container.textContent).not.toContain('$ echo background');
  });

  it('lets background completion tombstones spotlight their originating run card', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = renderChatView(
      [
        {
          type: 'tool_use',
          ts: '2026-03-11T18:00:00.000Z',
          tool: 'bash',
          input: { command: 'echo background', background: true },
          output: `Started background command ${RUN_ID} for ui-preview-check.`,
          status: 'ok',
          details: { action: 'start', runId: RUN_ID },
        },
        {
          type: 'text',
          ts: '2026-03-11T18:00:00.500Z',
          text: 'Background task started.',
        },
        {
          type: 'context',
          ts: '2026-03-11T18:00:01.000Z',
          customType: 'background_auto_resume',
          text: `Background task ui-preview-check completed.\nRun ID: ${RUN_ID}`,
        },
      ],
      { listedRuns: [createShellRunRecord()] },
    );

    const tombstone = container.querySelector('[data-lifecycle-marker="auto-resume"]') as HTMLButtonElement | null;
    expect(tombstone?.tagName).toBe('BUTTON');

    await act(async () => {
      tombstone?.click();
      await flushAsyncWork();
      await flushAnimationFrames();
      await flushAsyncWork();
    });

    expect(scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector(`[data-transcript-target="background_run:${RUN_ID}"]`)).not.toBeNull();
  });
});
