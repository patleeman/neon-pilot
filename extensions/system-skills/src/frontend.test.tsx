// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

beforeEach(() => {
  window.sessionStorage.clear();
});

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
  selection,
}: {
  invoke?: ReturnType<typeof vi.fn>;
  callAction?: ReturnType<typeof vi.fn>;
  selection?: { subscribe: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
} = {}) {
  return {
    extension: { invoke },
    extensions: { callAction },
    selection,
  };
}

describe('SkillsPage', () => {
  it('renders the native windowed skills layout without the stable table chrome', async () => {
    const pa = createPa({
      selection: {
        subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        set: vi.fn(),
      },
    });

    const { container } = render(<SkillsPage pa={pa as never} context={{ shellPresentation: 'windowed' } as never} />);

    await screen.findByText('PDF');
    expect(container.querySelector('.wos-page-shell')?.getAttribute('data-layout')).toBe('standard');
    expect(container.querySelector('.wos-page-rail')).toBeNull();
    expect(container.querySelector('.wos-page-inspector')).toBeNull();
    expect(container.querySelector('.wos-page-main__header .wos-page-eyebrow')).toBeNull();
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('Sources')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Skills view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Search marketplace skills' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Install PDF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Details for PDF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Details for Release QA' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
    expect(document.body.textContent).not.toContain('Skill context');
    expect(screen.queryByRole('dialog', { name: 'PDF' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details for PDF' }));

    expect(await screen.findByRole('dialog', { name: 'PDF' })).toBeTruthy();
    expect(screen.getByText('Read and verify PDF files.')).toBeTruthy();
    expect(screen.getByText('Marketplace skill')).toBeTruthy();
    expect(screen.getByText('Identifier')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Installed/ }));
    expect(await screen.findByText('Build iOS Apps')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Enable Build iOS Apps' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Details for Build iOS Apps' })).toBeTruthy();
  });

  it('uses windowed empty and status primitives for empty desktop skill views', async () => {
    const pa = createPa({
      invoke: vi.fn(async (action: string) => {
        if (action === 'listSkills') return { ok: true, skills: [] };
        return { ok: true };
      }),
      callAction: vi.fn(async (_extensionId: string, action: string) => {
        if (action === 'browseSkills') return { ...allBrowse, candidates: [], installed: [] };
        return { ok: true };
      }),
    });

    const { container } = render(<SkillsPage pa={pa as never} context={{ shellPresentation: 'windowed' } as never} />);

    await screen.findByText('No installable skills returned.');
    expect(container.querySelector('.wos-empty-state')).toBeTruthy();
    expect(container.querySelector('.ui-empty-state')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /Installed/ }));

    await screen.findByText('Skills give agents reusable instructions for focused work.');
    expect(container.querySelectorAll('.wos-empty-state').length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('.ui-empty-state')).toBeNull();
  });

  it('uses windowed fatal-state chrome when skills and marketplace fail', async () => {
    const pa = createPa({
      invoke: vi.fn(async () => {
        throw new Error('Installed skills unavailable');
      }),
      callAction: vi.fn(async () => {
        throw new Error('Marketplace unavailable');
      }),
    });

    const { container } = render(<SkillsPage pa={pa as never} context={{ shellPresentation: 'windowed' } as never} />);

    expect(await screen.findByText('Installed skills unavailable Marketplace unavailable')).toBeTruthy();
    expect(container.querySelector('.wos-state-block[data-tone="danger"]')).toBeTruthy();
    expect(container.querySelector('.ui-error-state')).toBeNull();
    expect(container.querySelector('.ui-empty-state')).toBeNull();
  });

  it('renders unified marketplace search results from Skill Search', async () => {
    const pa = createPa();

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    expect(screen.getByText('Browse')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skill ↑' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Capability' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'State' })).toBeTruthy();
    expect(document.body.textContent).toContain('Searching 2 marketplace sources · 2 results');
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
    expect(screen.getAllByText('Hermes Skills Index').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Approval required').length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole('button', { name: 'Search skills' }));

    await screen.findByText('No marketplace skills match the current search.');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await screen.findByText('PDF');
    expect((screen.getByPlaceholderText('Search marketplace skills') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('tab', { name: /Installed/ }));
    expect(screen.getByText('Documents')).toBeTruthy();
  });

  it('clears a marketplace search back to all skills', async () => {
    const pa = createPa();

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    fireEvent.change(screen.getByPlaceholderText('Search marketplace skills'), { target: { value: 'release' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search skills' }));

    expect(screen.getByRole('button', { name: 'Clear search' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() =>
      expect(pa.extensions.callAction).toHaveBeenLastCalledWith('system-skill-search', 'browseSkills', {
        sourceId: 'all',
        query: '',
        limit: 60,
      }),
    );
    expect((screen.getByPlaceholderText('Search marketplace skills') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('Release QA')).toBeTruthy();
  });

  it('filters and sorts marketplace results without switching sources', async () => {
    const pa = createPa();

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    fireEvent.change(screen.getByLabelText('Filter by capability'), { target: { value: 'Coding' } });

    expect(screen.getByText('Release QA')).toBeTruthy();
    expect(screen.queryByText('PDF')).toBeNull();
    expect(document.body.textContent).toContain('1 of 2 results');

    fireEvent.change(screen.getByLabelText('Filter by source'), { target: { value: 'Hermes Skills Index' } });
    expect(screen.getByText('Release QA')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Filter by state'), { target: { value: 'available' } });
    expect(screen.getByText('No marketplace skills match the current filters.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('Release QA')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Capability' }));
    expect(screen.getByRole('button', { name: 'Capability ↑' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Capability ↑' }));
    expect(screen.getByRole('button', { name: 'Capability ↓' })).toBeTruthy();
  });

  it('forces a background marketplace refresh from the toolbar', async () => {
    const pa = createPa();

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh skills' }));

    await waitFor(() =>
      expect(pa.extensions.callAction).toHaveBeenLastCalledWith('system-skill-search', 'browseSkills', {
        sourceId: 'all',
        query: '',
        limit: 60,
        refresh: 'force',
      }),
    );
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  it('hydrates marketplace rows from the session snapshot on page revisit', async () => {
    const pa = createPa();
    const { unmount } = render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    unmount();

    const slowPa = createPa({
      invoke: vi.fn(async (action: string) => {
        if (action === 'listSkills') return new Promise(() => undefined);
        return { ok: true };
      }),
      callAction: vi.fn(async (_extensionId: string, action: string) => {
        if (action === 'browseSkills') return new Promise(() => undefined);
        return { ok: true };
      }),
    });
    render(<SkillsPage pa={slowPa as never} context={{} as never} />);

    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.queryByText('Loading marketplace skills...')).toBeNull();
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

  it('opens marketplace skill details through the route right sidebar selection', async () => {
    const selectionSet = vi.fn();
    const pa = createPa({
      selection: {
        subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        set: selectionSet,
      },
    });

    render(<SkillsPage pa={pa as never} context={{} as never} />);

    await screen.findByText('PDF');
    fireEvent.click(screen.getByRole('button', { name: 'Details for PDF' }));

    expect(selectionSet).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'resource',
        resource: expect.objectContaining({
          type: 'skill',
          id: 'marketplace:pdf-candidate',
          label: 'PDF',
          source: 'marketplace',
        }),
      }),
    );
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
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
