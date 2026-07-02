// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PromptAssemblySettingsPanel } from './frontend';

vi.mock('@neon-pilot/extensions/settings', () => ({
  api: {
    systemPromptTemplate: vi.fn(),
    updateSystemPromptTemplate: vi.fn(),
  },
  useApi: () => ({
    data: { configFile: '/state/system-prompt.njk', template: 'Template' },
    loading: false,
    error: null,
  }),
}));

describe('PromptAssemblySettingsPanel', () => {
  it('mounts prompt assembly diagnostics from the Settings extension host', async () => {
    const callAction = vi.fn().mockResolvedValue({
      repoRoot: '/repo',
      cwd: '/repo',
      capabilities: [
        {
          id: 'instruction-a',
          kind: 'instruction',
          title: 'Repo instructions',
          enabled: true,
          status: 'active',
          source: { label: 'AGENTS.md' },
        },
      ],
      counts: { instruction: 1 },
    });

    render(
      <PromptAssemblySettingsPanel
        pa={{ extensions: { callAction }, extension: { invoke: vi.fn() } } as never}
        settingsContext={{ sectionId: 'settings-prompt-assembly' }}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Prompt Assembly' })).toBeTruthy();
    expect(await screen.findByText('Repo instructions')).toBeTruthy();
    await waitFor(() => expect(callAction).toHaveBeenCalledWith('system-prompt-assembly', 'inspectAgentRuntime', { cwd: undefined }));
  });

  it('renders native windowed chrome when embedded by windowed Settings', async () => {
    const callAction = vi.fn().mockResolvedValue({
      repoRoot: '/repo',
      cwd: '/repo',
      capabilities: [
        {
          id: 'instruction-a',
          kind: 'instruction',
          title: 'Repo instructions',
          enabled: true,
          status: 'active',
          source: { label: 'AGENTS.md' },
        },
      ],
      counts: { instruction: 1 },
    });

    const { container } = render(
      <PromptAssemblySettingsPanel
        pa={{ extensions: { callAction }, extension: { invoke: vi.fn() } } as never}
        settingsContext={{ sectionId: 'settings-prompt-assembly', shellPresentation: 'windowed' }}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Prompt Assembly' })).toBeTruthy();
    expect(await screen.findByText('Repo instructions')).toBeTruthy();
    expect(container.querySelector('.prompt-assembly-page-windowed')).toBeTruthy();
    expect(container.querySelector('.ui-app-page-shell')).toBeNull();
  });
});
