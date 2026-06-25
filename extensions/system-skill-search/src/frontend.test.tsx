// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SkillSearchSettingsPanel, SkillSearchSettingsView, type SkillSearchState } from './frontend';

const LOADED_STATE: SkillSearchState = {
  sources: [
    { id: 'hermes-index', label: 'Hermes Skills Index', kind: 'hermes-index', trustLevel: 'community', enabled: true },
    { id: 'openai-skills-curated', label: 'OpenAI Skills', kind: 'github', trustLevel: 'trusted', enabled: true },
  ],
  previews: [
    {
      candidate: {
        id: 'reviewer',
        title: 'Reviewer',
        description: 'Review pull requests.',
        sourceLabel: 'OpenAI Skills',
        trustLevel: 'trusted',
        identifier: 'openai/skills/skills/.curated/reviewer',
      },
      vetting: {
        verdict: 'safe',
        allowed: true,
        summary: 'Vetting found no blocking issues.',
        reviewedAt: '2026-06-25T10:00:00.000Z',
      },
      files: ['SKILL.md'],
      totalBytes: 200,
      contentHash: 'hash',
      previewedAt: '2026-06-25T10:00:00.000Z',
    },
  ],
  installed: [
    {
      id: 'upstream:reviewer',
      title: 'Reviewer',
      description: 'Review pull requests.',
      sourceLabel: 'OpenAI Skills',
      trustLevel: 'trusted',
      identifier: 'openai/skills/skills/.curated/reviewer',
      installedAt: '2026-06-25T10:05:00.000Z',
      vetting: {
        verdict: 'safe',
        allowed: true,
        summary: 'Vetting found no blocking issues.',
        reviewedAt: '2026-06-25T10:00:00.000Z',
      },
    },
  ],
};

describe('SkillSearchSettingsPanel', () => {
  it('renders the loading state before backend state resolves', () => {
    const pa = { extension: { invoke: vi.fn(async () => LOADED_STATE) } };

    const html = renderToStaticMarkup(<SkillSearchSettingsPanel pa={pa as never} />);

    expect(html).toContain('Loading Skill Search');
  });

  it('renders sources, vetted previews, and installed skills', () => {
    const html = renderToStaticMarkup(<SkillSearchSettingsView state={LOADED_STATE} />);

    expect(html).toContain('Sources');
    expect(html).toContain('Hermes Skills Index');
    expect(html).toContain('Community');
    expect(html).toContain('Recent Previews');
    expect(html).toContain('Installed Upstream Skills');
    expect(html).toContain('Reviewer');
  });

  it('loads state through the extension backend action', async () => {
    const pa = { extension: { invoke: vi.fn(async () => LOADED_STATE) } };

    render(<SkillSearchSettingsPanel pa={pa as never} />);

    await waitFor(() => expect(screen.getByText('Hermes Skills Index')).toBeTruthy());
    expect(pa.extension.invoke).toHaveBeenCalledWith('listState', {});
    expect(screen.getByText('Installed Upstream Skills')).toBeTruthy();
  });
});
