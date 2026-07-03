// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ModelArenaContextRail, ModelArenaDuelBlock, ModelArenaPage } from './frontend';

const arenaState = {
  settings: {
    automaticDuels: true,
    sampleRate: 0.35,
    rampDownAfterVotes: 60,
    rampedSampleRate: 0.15,
    challengerModels: [],
    minPromptChars: 24,
  },
  stats: {
    models: {
      'openai/gpt-5': {
        modelRef: 'openai/gpt-5',
        rating: 1532,
        wins: 6,
        losses: 2,
        ties: 1,
        neither: 0,
        votes: 9,
        byTask: { frontend: { wins: 6, losses: 2, ties: 1, neither: 0, votes: 9 } },
      },
    },
  },
  duels: [{ id: 'duel-1' }],
  models: [
    { id: 'zeta', name: 'Zeta', provider: 'opencode-go' },
    { id: 'spark', name: 'GPT-5.3 Codex Spark', provider: 'openai-codex' },
    { id: 'flash', name: 'DeepSeek V4 Flash', provider: 'opencode-go' },
  ],
};

describe('ModelArenaPage', () => {
  it('renders rankings through the shared table page pattern', async () => {
    const invoke = vi.fn().mockResolvedValue(arenaState);

    render(<ModelArenaPage pa={{ extension: { invoke } } as never} />);

    expect(await screen.findByLabelText('Model Arena rankings')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh Model Arena' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Task type' })).toBeTruthy();
    expect(screen.getByText('openai/gpt-5')).toBeTruthy();
    expect(screen.getByText('frontend 6W/2L/1T')).toBeTruthy();
    expect(document.body.textContent).toContain('1 recent duels');
    expect(document.body.textContent).toContain('sample 35%');
  });

  it('renders the native windowed arena surface when hosted by the windowed shell', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ...arenaState,
      settings: { ...arenaState.settings, challengerModels: ['opencode-go/flash'] },
    });

    const { container } = render(
      <ModelArenaPage pa={{ extension: { invoke } } as never} context={{ shellPresentation: 'windowed' } as never} />,
    );

    await waitFor(() => expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard'));
    expect(container.querySelector('.wos-page-rail')).toBeNull();
    expect(container.querySelector('.wos-page-inspector')).toBeNull();
    expect(container.querySelector('.wos-page-main__header .wos-page-eyebrow')).toBeNull();
    expect(container.querySelector('.wos-arena-ranking-table')).toBeTruthy();
    expect(container.querySelector('.wos-arena-ranking-table .wos-data-row[data-cells="3"]')).toBeTruthy();
    expect(container.querySelector('.wos-arena-ranking-row')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Task type' })).toBeTruthy();
    expect(screen.queryByText('Combined rankings')).toBeNull();
    expect(screen.queryByText('Filtered duel history')).toBeNull();
    expect(screen.getAllByText('openai/gpt-5').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('frontend 6W/2L/1T')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Disable Model Arena' })).toBeTruthy();
    expect(container.querySelector('.wos-toggle[data-accent="model-arena"]')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Challenger model' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add opencode-go/zeta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove DeepSeek V4 Flash · opencode-go' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.getByText('opencode-go/flash')).toBeTruthy();
    expect(screen.queryByText('Arena setup')).toBeNull();
    expect(screen.queryByText('Blind model duels')).toBeNull();
  });

  it('uses shared windowed states for setup, rankings, and errors', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ...arenaState,
        stats: { models: {} },
        duels: [],
        settings: { ...arenaState.settings, challengerModels: [] },
      })
      .mockRejectedValueOnce(new Error('Arena settings could not be saved.'));

    const { container } = render(
      <ModelArenaPage pa={{ extension: { invoke } } as never} context={{ shellPresentation: 'windowed' } as never} />,
    );

    await waitFor(() => expect(screen.getByText('No challenger models selected.')).toBeTruthy());
    expect(screen.getByText('No challenger models selected.').closest('.wos-empty-state')).toBeTruthy();
    expect(screen.getByText('Add challenger models and vote on duels to build rankings.').closest('.wos-empty-state')).toBeTruthy();
    expect(container.querySelector('.wos-arena-empty')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add opencode-go/zeta' }));

    await waitFor(() => expect(screen.getByText('Arena settings could not be saved.')).toBeTruthy());
    expect(screen.getByText('Arena settings could not be saved.').closest('.wos-state-block')?.getAttribute('data-tone')).toBe('danger');
    expect(container.querySelector('.wos-arena-error')).toBeNull();
    expect(container.querySelector('.ui-error-state')).toBeNull();
  });

  it('uses windowed state blocks while arena setup is loading', async () => {
    const invoke = vi.fn(() => new Promise(() => undefined));

    const { container } = render(
      <ModelArenaPage pa={{ extension: { invoke } } as never} context={{ shellPresentation: 'windowed' } as never} />,
    );

    await waitFor(() => expect(screen.getByText('Reading arena setup.')).toBeTruthy());
    expect(screen.getByText('Reading arena setup.').closest('.wos-state-block')).toBeTruthy();
    expect(screen.getByText('Loading Model Arena rankings.').closest('.wos-state-block')).toBeTruthy();
    expect(container.querySelector('.wos-empty-state')).toBeNull();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
    expect(container.querySelector('.ui-error-state')).toBeNull();
  });
});

describe('ModelArenaContextRail', () => {
  it('groups challenger model choices by provider', async () => {
    const invoke = vi.fn().mockResolvedValue({ ...arenaState, stats: { models: {} }, duels: [] });

    const { container } = render(<ModelArenaContextRail pa={{ extension: { invoke } } as never} />);

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Challenger model' })).toBeTruthy());

    const groups = [...container.querySelectorAll('select[aria-label="Challenger model"] optgroup')];
    expect(groups.map((group) => group.getAttribute('label'))).toEqual(['openai-codex', 'opencode-go']);
    expect([...groups[1]!.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['DeepSeek V4 Flash', 'Zeta']);
  });
});

describe('ModelArenaDuelBlock', () => {
  it('renders markdown answers as per-side preference actions', () => {
    const renderMarkdown = vi.fn((markdown: string) => <div data-testid="rendered-markdown">{markdown}</div>);

    render(
      <ModelArenaDuelBlock
        pa={{ extension: { invoke: vi.fn() } }}
        block={{
          details: {
            duelId: 'duel-1',
            status: 'ready',
            taskType: 'frontend',
            sideA: { text: '**A**\n\n- one' },
            sideB: { text: '## B\n\n| x | y |\n|---|---|\n| 1 | 2 |' },
            revealed: false,
            vote: null,
            error: null,
          },
        }}
        context={{ renderMarkdown }}
      />,
    );

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(within(articles[0]!).getByRole('button', { name: 'Prefer A' })).toBeTruthy();
    expect(within(articles[1]!).getByRole('button', { name: 'Prefer B' })).toBeTruthy();
    expect(screen.getByText('Model Arena duel')).toBeTruthy();
    expect(screen.queryByText('Blind model duel')).toBeNull();
    expect(screen.queryByText('frontend')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tie' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neither' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(renderMarkdown).toHaveBeenCalledWith('**A**\n\n- one');
    expect(renderMarkdown).toHaveBeenCalledWith('## B\n\n| x | y |\n|---|---|\n| 1 | 2 |');
    expect(screen.getAllByTestId('rendered-markdown')).toHaveLength(2);
  });

  it('shows challenger errors in the missing answer pane', () => {
    render(
      <ModelArenaDuelBlock
        pa={{ extension: { invoke: vi.fn() } }}
        block={{
          details: {
            duelId: 'duel-1',
            status: 'failed',
            taskType: 'debugging',
            sideA: { text: 'Primary answer' },
            sideB: { text: '' },
            revealed: false,
            vote: null,
            error: 'No API key for provider: openai-codex',
          },
        }}
      />,
    );

    const articles = screen.getAllByRole('article');
    expect(within(articles[1]!).getByText('No API key for provider: openai-codex')).toBeTruthy();
  });

  it.each([
    ['Prefer A', 'a'],
    ['Prefer B', 'b'],
    ['Tie', 'tie'],
    ['Neither', 'neither'],
  ] as const)('records %s and lets the host render the collapsed assistant message', async (buttonName, choice) => {
    const invoke = vi.fn().mockResolvedValue({
      duel: {
        duelId: 'duel-1',
        conversationId: 'conversation-1',
        status: 'voted',
        taskType: 'frontend',
        sideA: { role: 'primary', text: 'Primary answer' },
        sideB: { role: 'challenger', text: 'Challenger answer' },
        vote: choice,
        revealed: true,
      },
    });

    const initialBlock = {
      details: {
        duelId: 'duel-1',
        conversationId: 'conversation-1',
        status: 'ready',
        taskType: 'frontend',
        sideA: { role: 'primary', text: 'Primary answer' },
        sideB: { role: 'challenger', text: 'Challenger answer' },
        revealed: false,
        vote: null,
        error: null,
      },
    };
    const votedBlock = {
      details: {
        duelId: 'duel-1',
        status: 'voted',
        taskType: 'frontend',
        sideA: { role: 'primary', text: 'Primary answer' },
        sideB: { role: 'challenger', text: 'Challenger answer' },
        vote: choice,
        revealed: true,
      },
    };
    const { container, rerender } = render(<ModelArenaDuelBlock pa={{ extension: { invoke } }} block={initialBlock} />);
    const refreshListener = vi.fn();
    window.addEventListener('neon-pilot:desktop-conversation-state-refresh', refreshListener);

    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('voteDuel', { duelId: 'duel-1', choice }));
    await waitFor(() =>
      expect(refreshListener).toHaveBeenCalledWith(expect.objectContaining({ detail: { conversationId: 'conversation-1' } })),
    );
    expect(screen.getByText('Primary answer')).toBeTruthy();

    rerender(<ModelArenaDuelBlock pa={{ extension: { invoke } }} block={votedBlock} />);

    expect(screen.queryByText('Vote recorded')).toBeNull();
    expect(screen.queryByText('Primary answer')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(container.querySelector('[data-model-arena-duel]')).toBeNull();
    window.removeEventListener('neon-pilot:desktop-conversation-state-refresh', refreshListener);
  });

  it('keeps the duel visible when a vote response is not confirmed', async () => {
    const invoke = vi.fn().mockResolvedValue({});

    render(
      <ModelArenaDuelBlock
        pa={{ extension: { invoke } }}
        block={{
          details: {
            duelId: 'duel-1',
            status: 'ready',
            taskType: 'frontend',
            sideA: { role: 'primary', text: 'Primary answer' },
            sideB: { role: 'challenger', text: 'Challenger answer' },
            revealed: false,
            vote: null,
            error: null,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Prefer A' }));

    await waitFor(() => expect(screen.getByText('Vote was not recorded. The duel is still open.')).toBeTruthy());
    expect(screen.getByText('Model Arena duel')).toBeTruthy();
    expect(screen.getByText('Primary answer')).toBeTruthy();
    expect(screen.getByText('Challenger answer')).toBeTruthy();
  });

  it('does not allow voting while a side is still missing an answer', () => {
    const invoke = vi.fn();

    render(
      <ModelArenaDuelBlock
        pa={{ extension: { invoke } }}
        block={{
          details: {
            duelId: 'duel-1',
            status: 'ready',
            taskType: 'frontend',
            sideA: { role: 'primary', text: 'Primary answer' },
            sideB: { role: 'challenger', text: '' },
            revealed: false,
            vote: null,
            error: null,
          },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Prefer A' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Prefer B' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Tie' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Neither' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Prefer A' }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('keeps rendered answers stable when an older running duel payload arrives', () => {
    const populatedBlock = {
      details: {
        duelId: 'duel-1',
        status: 'ready',
        taskType: 'debugging',
        sideA: { text: 'Primary answer' },
        sideB: { text: 'Challenger answer' },
        revealed: false,
        vote: null,
        error: null,
      },
    };
    const staleBlock = {
      details: {
        duelId: 'duel-1',
        status: 'running',
        taskType: 'debugging',
        sideA: { text: '' },
        sideB: { text: 'Challenger answer' },
        revealed: false,
        vote: null,
        error: null,
      },
    };

    const { rerender } = render(<ModelArenaDuelBlock pa={{ extension: { invoke: vi.fn() } }} block={populatedBlock} />);

    expect(screen.getByText('Primary answer')).toBeTruthy();

    rerender(<ModelArenaDuelBlock pa={{ extension: { invoke: vi.fn() } }} block={staleBlock} />);

    expect(screen.getByText('Primary answer')).toBeTruthy();
    expect(screen.queryByText('Waiting for answer...')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Prefer A' }).disabled).toBe(false);
  });

  it('treats a running duel with both answers as stable and does not keep refreshing it', async () => {
    const invoke = vi.fn();

    render(
      <ModelArenaDuelBlock
        pa={{ extension: { invoke } }}
        block={{
          details: {
            duelId: 'duel-1',
            status: 'running',
            taskType: 'debugging',
            sideA: { text: 'Primary answer' },
            sideB: { text: 'Challenger answer' },
            revealed: false,
            vote: null,
            error: null,
          },
        }}
      />,
    );

    expect(screen.getByText('Primary answer')).toBeTruthy();
    expect(screen.getByText('Challenger answer')).toBeTruthy();
    expect(screen.queryByText('Waiting for answer...')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Prefer A' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Prefer B' }).disabled).toBe(false);

    await Promise.resolve();

    expect(invoke).not.toHaveBeenCalledWith('refreshDuel', expect.anything());
  });

  it('closes a duel block by unmounting so the host can restore the source message', async () => {
    const invoke = vi.fn().mockResolvedValue({
      duel: {
        duelId: 'duel-1',
        status: 'cancelled',
        taskType: 'frontend',
        sideA: { role: 'primary', text: 'Primary answer' },
        sideB: { role: 'challenger', text: 'Challenger answer' },
      },
    });

    const originalBlock = {
      details: {
        duelId: 'duel-1',
        status: 'ready',
        taskType: 'frontend',
        sideA: { role: 'primary', text: 'Primary answer' },
        sideB: { role: 'challenger', text: 'Challenger answer' },
        revealed: false,
        vote: null,
        error: null,
      },
    };
    const { container, rerender } = render(<ModelArenaDuelBlock pa={{ extension: { invoke } }} block={originalBlock} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('cancelDuel', { duelId: 'duel-1' }));
    expect(screen.getByText('Primary answer')).toBeTruthy();

    rerender(
      <ModelArenaDuelBlock
        pa={{ extension: { invoke } }}
        block={{
          details: {
            duelId: 'duel-1',
            status: 'cancelled',
            taskType: 'frontend',
            sideA: { role: 'primary', text: 'Primary answer' },
            sideB: { role: 'challenger', text: 'Challenger answer' },
          },
        }}
      />,
    );

    expect(screen.queryByText('Comparison closed')).toBeNull();
    expect(screen.queryByText('Primary answer')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(container.querySelector('[data-model-arena-duel]')).toBeNull();

    rerender(
      <ModelArenaDuelBlock
        pa={{ extension: { invoke } }}
        block={{
          details: {
            duelId: 'duel-1',
            status: 'cancelled',
            taskType: 'frontend',
            sideA: { role: 'primary', text: 'Primary answer' },
            sideB: { role: 'challenger', text: 'Challenger answer' },
          },
        }}
      />,
    );

    expect(screen.queryByText('Comparison closed')).toBeNull();
    expect(screen.queryByText('Primary answer')).toBeNull();
    expect(container.querySelector('[data-model-arena-duel]')).toBeNull();
  });
});
