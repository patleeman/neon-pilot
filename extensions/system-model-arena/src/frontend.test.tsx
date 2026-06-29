// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ModelArenaDuelBlock } from './frontend';

describe('ModelArenaDuelBlock', () => {
  it('renders markdown answers with per-side preference actions', () => {
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
});
