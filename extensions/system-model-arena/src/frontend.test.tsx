// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ModelArenaDuelBlock, ModelArenaPage } from './frontend';

describe('ModelArenaPage', () => {
  it('groups challenger model choices by provider', async () => {
    const invoke = vi.fn().mockResolvedValue({
      settings: {
        automaticDuels: true,
        sampleRate: 0.35,
        rampDownAfterVotes: 60,
        rampedSampleRate: 0.15,
        challengerModels: [],
        minPromptChars: 24,
      },
      stats: { models: {} },
      duels: [],
      models: [
        { id: 'zeta', name: 'Zeta', provider: 'opencode-go' },
        { id: 'spark', name: 'GPT-5.3 Codex Spark', provider: 'openai-codex' },
        { id: 'flash', name: 'DeepSeek V4 Flash', provider: 'opencode-go' },
      ],
    });

    const { container } = render(<ModelArenaPage pa={{ extension: { invoke } } as never} />);

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
