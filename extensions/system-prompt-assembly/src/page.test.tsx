// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptAssemblyPage } from './page';

const settingsMocks = vi.hoisted(() => ({
  systemPromptTemplate: vi.fn(),
  updateSystemPromptTemplate: vi.fn(),
  useApiState: {
    data: { configFile: '/state/system-prompt.njk', template: 'Template' },
    loading: false,
    error: null as string | null,
  },
}));

vi.mock('@neon-pilot/extensions/settings', () => ({
  api: {
    systemPromptTemplate: settingsMocks.systemPromptTemplate,
    updateSystemPromptTemplate: settingsMocks.updateSystemPromptTemplate,
  },
  useApi: () => settingsMocks.useApiState,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function runtimeResult(cwd: string, capabilities: unknown[] = []) {
  return {
    repoRoot: '/repo',
    cwd,
    capabilities,
    counts: {},
  };
}

function renderPage({
  cwd,
  invoke,
  callAction,
  shellPresentation,
}: {
  cwd: string;
  invoke: ReturnType<typeof vi.fn>;
  callAction?: ReturnType<typeof vi.fn>;
  shellPresentation?: 'stable' | 'windowed';
}) {
  return (
    <PromptAssemblyPage
      pa={{ extension: { invoke }, extensions: callAction ? { callAction } : undefined } as never}
      context={{ cwd, pathname: '', search: '', hash: '', shellPresentation }}
      surface={
        {
          id: 'prompt-assembly',
          extensionId: 'system-prompt-assembly',
          title: 'Prompt Assembly',
          location: 'main',
          component: 'PromptAssemblyPage',
        } as never
      }
      params={{}}
    />
  );
}

describe('PromptAssemblyPage', () => {
  beforeEach(() => {
    settingsMocks.systemPromptTemplate.mockReset();
    settingsMocks.updateSystemPromptTemplate.mockReset();
    settingsMocks.useApiState = {
      data: { configFile: '/state/system-prompt.njk', template: 'Template' },
      loading: false,
      error: null,
    };
  });

  it('ignores stale runtime inspections after cwd changes', async () => {
    const firstLoad = deferred<ReturnType<typeof runtimeResult>>();
    const secondLoad = deferred<ReturnType<typeof runtimeResult>>();
    const invoke = vi.fn().mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise);

    const { rerender } = render(renderPage({ cwd: '/repo/one', invoke }));

    rerender(renderPage({ cwd: '/repo/two', invoke }));

    secondLoad.resolve(runtimeResult('/repo/two'));
    await waitFor(() => expect(screen.getByText('Working directory: .')).toBeTruthy());

    firstLoad.resolve(runtimeResult('/repo/one'));
    await Promise.resolve();

    expect(screen.getByText('Working directory: .')).toBeTruthy();
    expect(screen.queryByText(/\/repo\/one/)).toBeNull();
  });

  it('keeps the initial Prompt Assembly loading state visually quiet', () => {
    const load = deferred<ReturnType<typeof runtimeResult>>();
    const callAction = vi.fn().mockReturnValue(load.promise);

    render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction }));

    expect(screen.getByRole('status', { name: 'Loading prompt assembly' })).toBeTruthy();
    expect(screen.queryByText('Loading prompt assembly…')).toBeNull();
  });

  it('renders a native windowed settings surface without stable page chrome', async () => {
    const callAction = vi.fn().mockResolvedValue(
      runtimeResult('/repo', [
        {
          id: 'instruction-a',
          kind: 'instruction',
          title: 'Repo instructions',
          description: 'Project instructions',
          enabled: true,
          status: 'active',
          source: { label: '/repo/AGENTS.md' },
        },
        {
          id: 'tool-a',
          kind: 'tool',
          title: 'Tool A',
          description: 'Useful tool',
          enabled: true,
          status: 'active',
          source: { label: 'system-tools' },
        },
      ]),
    );

    const { container } = render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction, shellPresentation: 'windowed' }));

    expect(await screen.findByRole('heading', { name: 'Prompt Assembly' })).toBeTruthy();
    expect(container.querySelector('.prompt-assembly-page-windowed')).toBeTruthy();
    expect(container.querySelector('.ui-app-page-shell')).toBeNull();
    expect(container.querySelector('.ui-app-page-toc')).toBeNull();
    expect(screen.queryByText('Review the instructions, tools, MCP servers, templates, and context available to the agent.')).toBeNull();
    expect(screen.getByDisplayValue('Template')).toBeTruthy();
    expect(screen.getByText('Repo instructions')).toBeTruthy();
    expect(screen.getByText('Tool A')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search agent context...')).toBeTruthy();
    expect(screen.getByText('No MCP servers found.').closest('.wos-empty-state')).toBeTruthy();
    expect(screen.getByText('No issues found.').closest('.wos-empty-state')).toBeTruthy();
    expect(container.querySelector('.wos-windowed-empty')).toBeNull();
  });

  it('does not render or toggle skills from Prompt Assembly settings', async () => {
    const callAction = vi.fn().mockResolvedValue(
      runtimeResult('/repo', [
        {
          id: 'skill-a',
          kind: 'skill',
          title: 'Skill A',
          description: 'Useful skill',
          enabled: true,
          status: 'active',
          source: { label: 'system-skills' },
        },
        {
          id: 'tool-a',
          kind: 'tool',
          title: 'Tool A',
          description: 'Useful tool',
          enabled: true,
          status: 'active',
          source: { label: 'system-tools' },
        },
      ]),
    );

    render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction }));

    expect(await screen.findByText('Tool A')).toBeTruthy();
    expect(screen.queryByText('Skill A')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Disable Skill A' })).toBeNull();
    expect(callAction).toHaveBeenCalledTimes(1);
  });

  it('does not render raw local paths in Prompt Assembly labels', async () => {
    settingsMocks.useApiState = {
      data: {
        configFile: '/tmp/neon-pilot-qa/row-prompt-reply-actions-gpt55/state/config/config.json',
        template: 'Template',
      },
      loading: false,
      error: null,
    };
    const callAction = vi.fn().mockResolvedValue(
      runtimeResult('/Users/patrick/workingdir/neon-pilot', [
        {
          id: 'repo-agents',
          kind: 'instruction',
          title: 'Repo instructions',
          description: 'Project instructions',
          enabled: true,
          status: 'active',
          scope: 'workspace',
          source: { label: '/Users/patrick/workingdir/neon-pilot/AGENTS.md' },
        },
        {
          id: 'twitter-bird-cli',
          kind: 'skill',
          title: 'Twitter Bird CLI',
          description: 'X account tasks',
          enabled: true,
          status: 'active',
          source: { label: '/Users/patrick/.codex/skills/twitter-bird-cli' },
        },
        {
          id: 'mcp-explicit',
          kind: 'mcp-server',
          title: 'Explicit MCP',
          enabled: true,
          status: 'active',
          metadata: { transport: 'stdio', command: '/Users/patrick/.config/mcp/mcp_servers.json' },
          source: { label: '/Users/patrick/.config/mcp/mcp_servers.json' },
        },
      ]),
    );

    render(renderPage({ cwd: '/Users/patrick/workingdir/neon-pilot', invoke: vi.fn(), callAction }));

    expect(await screen.findByText('config.json')).toBeTruthy();
    expect(screen.getByText('Working directory: .')).toBeTruthy();
    expect(screen.getByText('./AGENTS.md')).toBeTruthy();
    expect(screen.queryByText('Twitter Bird CLI')).toBeNull();
    expect(screen.queryByText('skills/twitter-bird-cli')).toBeNull();
    expect(screen.getAllByText('MCP config').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('/Users/patrick');
    expect(document.body.textContent).not.toContain('/tmp/neon-pilot-qa');
  });

  it('lets users edit and revert the instruction template before auto-save runs', async () => {
    const callAction = vi.fn().mockResolvedValue(runtimeResult('/repo'));

    render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction }));

    const textarea = (await screen.findByDisplayValue('Template')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Template\nQA marker' } });

    expect(screen.getByText('Auto-save pending...')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revert edits' }));

    expect(screen.getByDisplayValue('Template')).toBeTruthy();
    expect(screen.getByText('Auto-saved')).toBeTruthy();
    await act(async () => {
      await sleep(1000);
    });
    expect(settingsMocks.updateSystemPromptTemplate).not.toHaveBeenCalled();
  });

  it('sanitizes internal instruction template save failures', async () => {
    const callAction = vi.fn().mockResolvedValue(runtimeResult('/repo'));
    settingsMocks.updateSystemPromptTemplate.mockRejectedValue(
      new Error('Local API route did not complete for PATCH /api/system-prompt-template at Module.ep'),
    );

    render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction }));

    const textarea = (await screen.findByDisplayValue('Template')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Template\nQA marker' } });

    await waitFor(() => expect(settingsMocks.updateSystemPromptTemplate).toHaveBeenCalledWith('Template\nQA marker'), { timeout: 2000 });
    expect(await screen.findByText('Could not save the instruction template. Revert edits or try again.')).toBeTruthy();
    expect(screen.queryByText(/\/api\/system-prompt-template/)).toBeNull();
    expect(screen.queryByText(/Module\.ep/)).toBeNull();
  });

  it('marks the instruction template as saved after autosave succeeds', async () => {
    const callAction = vi.fn().mockResolvedValue(runtimeResult('/repo'));
    settingsMocks.updateSystemPromptTemplate.mockResolvedValue({
      configFile: '/state/system-prompt.njk',
      template: 'Template\nSaved',
    });

    render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction }));

    const textarea = (await screen.findByDisplayValue('Template')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Template\nSaved' } });

    await waitFor(() => expect(settingsMocks.updateSystemPromptTemplate).toHaveBeenCalledWith('Template\nSaved'), { timeout: 2000 });
    await waitFor(() => expect(screen.getByText('Auto-saved')).toBeTruthy());
    expect(screen.queryByText('Auto-save pending...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Revert edits' }).hasAttribute('disabled')).toBe(true);
  });

  it('reverts edits to the last successfully saved instruction template', async () => {
    const callAction = vi.fn().mockResolvedValue(runtimeResult('/repo'));
    settingsMocks.updateSystemPromptTemplate.mockResolvedValue({
      configFile: '/state/system-prompt.njk',
      template: 'Template\nSaved',
    });

    render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction }));

    const textarea = (await screen.findByDisplayValue('Template')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Template\nSaved' } });
    await waitFor(() => expect(screen.getByText('Auto-saved')).toBeTruthy(), { timeout: 2000 });

    fireEvent.change(document.querySelector('#agent-runtime-system-prompt-template') as HTMLTextAreaElement, {
      target: { value: 'Template\nUnsaved' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Revert edits' }));

    expect((document.querySelector('#agent-runtime-system-prompt-template') as HTMLTextAreaElement).value).toBe('Template\nSaved');
    expect(screen.getByRole('button', { name: 'Revert edits' }).hasAttribute('disabled')).toBe(true);
  });

  it('sanitizes internal Prompt Assembly load failures', async () => {
    const callAction = vi
      .fn()
      .mockRejectedValue(new Error('Local API route did not complete for POST /api/extensions/action at Module.ep'));

    render(renderPage({ cwd: '/repo', invoke: vi.fn(), callAction }));

    expect(await screen.findByText('Could not load Prompt Assembly. Refresh this page or reopen Settings.')).toBeTruthy();
    expect(screen.queryByText(/\/api\/extensions\/action/)).toBeNull();
    expect(screen.queryByText(/Module\.ep/)).toBeNull();
  });
});
