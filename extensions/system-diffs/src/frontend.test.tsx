import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const readCheckpointPresentationMock = vi.hoisted(() => vi.fn());

vi.mock('@neon-pilot/extensions/data', () => ({
  timeAgo: () => 'just now',
}));

vi.mock('@neon-pilot/extensions/ui', () => ({
  CheckpointInlineDiff: ({ checkpointId }: { checkpointId: string }) => <div>inline diff {checkpointId}</div>,
  SurfacePanel: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  RowButton: ({ children, compact: _compact, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) => (
    <button {...props}>{children}</button>
  ),
  CardBody: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
  CardMeta: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  InlineMeta: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Pill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Spinner: () => <span>loading</span>,
  cx: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@neon-pilot/extensions/workbench', () => ({
  ConversationCheckpointWorkbenchPane: () => null,
  ConversationDiffRailContent: () => null,
  getConversationCheckpointIdFromSearch: () => null,
  setConversationCheckpointIdInSearch: () => '',
  useConversationCheckpointSummaries: () => ({ checkpoints: [], loading: false, error: null }),
}));

vi.mock('@neon-pilot/extensions/workbench-diffs', () => ({
  readCheckpointPresentation: readCheckpointPresentationMock,
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

import { CheckpointTranscriptRenderer } from './panels.js';

describe('CheckpointTranscriptRenderer', () => {
  it('renders an unsupported checkpoint tool block instead of disappearing', () => {
    readCheckpointPresentationMock.mockReturnValueOnce(null);

    const html = renderToStaticMarkup(
      <CheckpointTranscriptRenderer
        block={{ status: 'ok', input: { action: 'list' }, output: 'Commit checkpoints for conversation conv-1:' }}
        context={{}}
      />,
    );

    expect(html).toContain('Listed checkpoints');
    expect(html).toContain('Commit checkpoints for conversation conv-1:');
  });

  it('strips ANSI escapes from fallback checkpoint output', () => {
    readCheckpointPresentationMock.mockReturnValueOnce(null);

    const html = renderToStaticMarkup(
      <CheckpointTranscriptRenderer
        block={{ status: 'ok', input: { action: 'save' }, output: '\u001B[32m✓\u001B[0m formatting passed' }}
        context={{}}
      />,
    );

    expect(html).toContain('✓ formatting passed');
    expect(html).not.toContain('[32m');
  });

  it('renders the checkpoint-specific card when presentation data is available', () => {
    readCheckpointPresentationMock.mockReturnValueOnce({
      action: 'save',
      conversationId: 'conv-1',
      checkpointId: 'abc1234',
      commitSha: 'abc123456789',
      shortSha: 'abc1234',
      title: 'fix: checkpoint cards',
      subject: 'fix: checkpoint cards',
      routineHooks: [],
    });

    const html = renderToStaticMarkup(<CheckpointTranscriptRenderer block={{ status: 'ok', input: { action: 'save' } }} context={{}} />);

    expect(html).toContain('fix: checkpoint cards');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('inline diff abc1234');
  });

  it('renders routine activity attached to the checkpoint card', () => {
    readCheckpointPresentationMock.mockReturnValueOnce({
      action: 'save',
      conversationId: 'conv-1',
      checkpointId: 'abc1234',
      commitSha: 'abc123456789',
      shortSha: 'abc1234',
      title: 'fix: checkpoint cards',
      subject: 'fix: checkpoint cards',
      routineHooks: [
        {
          id: 'before-run',
          hookId: 'checkpoint',
          position: 'before',
          status: 'passed',
          steps: [
            { routineId: 'review', routineName: 'Review smoke changes', status: 'passed', outcome: 'pass' },
            { routineId: 'smoke', routineName: 'Smoke temporary routine', status: 'warned', message: 'Needs QA.' },
          ],
        },
        {
          id: 'after-run',
          hookId: 'checkpoint',
          position: 'after',
          status: 'passed',
          steps: [{ routineId: 'report', routineName: 'Report checkpoint', status: 'passed' }],
        },
      ],
    });

    const html = renderToStaticMarkup(<CheckpointTranscriptRenderer block={{ status: 'ok', input: { action: 'save' } }} context={{}} />);

    expect(html).toContain('Routine activity');
    expect(html).toContain('Before checkpoint');
    expect(html).toContain('After checkpoint');
    expect(html).toContain('Review smoke changes');
    expect(html).toContain('Report checkpoint');
    expect(html).toContain('p-0');
    expect(html).not.toContain('Before checkpoint routines');
    expect(html).not.toContain('routines</span>');
  });

  it('treats semantic checkpoint failures as danger cards even when the tool status is ok', () => {
    readCheckpointPresentationMock.mockReturnValueOnce(null);

    const html = renderToStaticMarkup(
      <CheckpointTranscriptRenderer
        block={{
          status: 'ok',
          input: { action: 'save', message: 'fix: retry checkpoint' },
          output: 'Refusing to checkpoint unrelated staged changes: package.json',
        }}
        context={{}}
      />,
    );

    expect(html).toContain('Checkpoint failed');
    expect(html).toContain('ui-surface-danger-soft');
    expect(html).toContain('text-danger/85');
  });
});
