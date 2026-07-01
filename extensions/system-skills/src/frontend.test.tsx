// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SkillsPage } from './SkillsPage';

const skills = [
  {
    id: 'documents',
    name: 'Documents',
    description: 'Create and edit document artifacts.',
    path: '/skills/documents/SKILL.md',
    source: 'extension',
    sourceLabel: 'OpenAI Skills',
    extensionId: 'system-skill-search',
    enabled: true,
  },
  {
    id: 'ios',
    name: 'Build iOS Apps',
    description: 'Build and debug iOS apps.',
    path: '/skills/ios/SKILL.md',
    source: 'extension',
    sourceLabel: 'NVIDIA Skills',
    extensionId: 'system-skill-search',
    enabled: false,
  },
];

const openAiBrowse = {
  ok: true,
  sourceId: 'openai',
  sources: [
    {
      id: 'openai',
      label: 'OpenAI',
      kind: 'github',
      trustLevel: 'trusted',
      enabled: true,
      sourceIds: ['openai-skills-curated'],
      installPolicy: 'direct-after-vetting',
    },
    {
      id: 'hermes',
      label: 'Hermes',
      kind: 'hermes-index',
      trustLevel: 'community',
      enabled: true,
      sourceIds: ['hermes-index'],
      installPolicy: 'approval-after-vetting',
    },
  ],
  candidates: [
    {
      candidateId: 'pdf-candidate',
      title: 'PDF',
      description: 'Read and verify PDF files.',
      sourceId: 'openai-skills-curated',
      sourceLabel: 'OpenAI Skills',
      sourceKind: 'github',
      trustLevel: 'trusted',
      identifier: 'openai/skills/skills/.curated/pdf',
      url: 'https://github.com/openai/skills/tree/main/skills/.curated/pdf',
      tags: ['documents'],
      requiresApproval: false,
    },
  ],
  installed: [],
};

const hermesBrowse = {
  ...openAiBrowse,
  sourceId: 'hermes',
  candidates: [
    {
      candidateId: 'qa-candidate',
      title: 'Release QA',
      description: 'Community release QA checklist.',
      sourceId: 'hermes-index',
      sourceLabel: 'Hermes Skills Index',
      sourceKind: 'hermes-index',
      trustLevel: 'community',
      identifier: 'community/skills/skills/release-qa',
      url: 'https://github.com/community/skills/tree/main/skills/release-qa',
      tags: ['qa'],
      requiresApproval: true,
    },
  ],
  installed: [],
};

const allBrowse = {
  ...openAiBrowse,
  sourceId: 'all',
  candidates: [...openAiBrowse.candidates, ...hermesBrowse.candidates],
};

function createPa({
  invoke = vi.fn(async (action: string) => {
    if (action === 'listSkills') return { ok: true, skills };
    return { ok: true };
  }),
  callAction = vi.fn(async (_extensionId: string, action: string, input?: unknown) => {
    if (action === 'browseSkills') {
      const sourceId = (input as { sourceId?: string } | undefined)?.sourceId;
      if (sourceId === 'all') return allBrowse;
      return sourceId === 'hermes' ? hermesBrowse : openAiBrowse;
    }
    if (action === 'installSkill') return { ok: true, message: 'Installed PDF.' };
    return { ok: true };
  }),
}: {
  invoke?: ReturnType<typeof vi.fn>;
  callAction?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    extension: { invoke },
    extensions: { callAction },
  };
}

describe('SkillsPage', () => {
  it('renders unified marketplace search results from Skill Search', async () => {
    const pa = createPa();

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    expect(screen.getByText('Browse')).toBeTruthy();
    expect(screen.getByText('Skill')).toBeTruthy();
    expect(screen.getByText('Capability')).toBeTruthy();
    expect(screen.getByText('State')).toBeTruthy();
    expect(
      screen.getByText('Searching 2 marketplace sources. Trusted skills install after vetting; community skills require approval.'),
    ).toBeTruthy();
    expect(screen.getByText('Read and verify PDF files.')).toBeTruthy();
    expect(pa.extensions.callAction).toHaveBeenCalledWith('system-skill-search', 'browseSkills', {
      sourceId: 'all',
      query: '',
      limit: 60,
    });
  });

  it('shows community approval state inside unified marketplace results', async () => {
    const pa = createPa();

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('Release QA');
    expect(screen.getByText('Community release QA checklist.')).toBeTruthy();
    expect(screen.getByText('Hermes Skills Index')).toBeTruthy();
    expect(screen.getByText('Approval required')).toBeTruthy();
    expect(pa.extensions.callAction).toHaveBeenCalledWith('system-skill-search', 'browseSkills', {
      sourceId: 'all',
      query: '',
      limit: 60,
    });
  });

  it('shows an empty state when marketplace search has no matches', async () => {
    const pa = createPa({
      callAction: vi.fn(async (_extensionId: string, action: string, input?: unknown) => {
        if (action === 'browseSkills') {
          return (input as { query?: string } | undefined)?.query ? { ...allBrowse, candidates: [] } : allBrowse;
        }
        return { ok: true };
      }),
    });

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    fireEvent.change(screen.getByPlaceholderText('Search marketplace skills'), { target: { value: 'zzzz-no-such-skill-ga' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText('No marketplace skills match the current search.');
    fireEvent.click(screen.getByRole('tab', { name: /Installed/ }));
    expect(screen.getByText('Documents')).toBeTruthy();
  });

  it('installs a marketplace candidate and refreshes both data sources', async () => {
    const pa = createPa();

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' })[0]);

    await screen.findByText('Installed PDF.');
    expect(pa.extensions.callAction).toHaveBeenCalledWith('system-skill-search', 'installSkill', { candidateId: 'pdf-candidate' });
    expect(pa.extension.invoke).toHaveBeenCalledWith('listSkills', {});
  });

  it('keeps installed skill management usable when marketplace browsing fails', async () => {
    const pa = createPa({
      callAction: vi.fn(async () => {
        throw new Error('Marketplace unavailable');
      }),
    });

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findAllByText('Marketplace unavailable');
    fireEvent.click(screen.getByRole('tab', { name: /Installed/ }));

    expect(screen.getByText('Documents')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Disable Documents' })).toBeTruthy();
  });

  it('toggles installed skills through the system-skills backend', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'listSkills') return { ok: true, skills };
      return { ok: true };
    });
    const pa = createPa({ invoke });

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    fireEvent.click(screen.getByRole('tab', { name: /Installed/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Build iOS Apps' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('updateSkillEnabled', { id: 'ios', enabled: true }));
  });
});
