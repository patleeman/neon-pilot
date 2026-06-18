// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PromptAssemblyPage } from './page';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function runtimeResult(cwd: string) {
  return {
    repoRoot: '/repo',
    cwd,
    capabilities: [],
    counts: {},
  };
}

function renderPage({ cwd, invoke }: { cwd: string; invoke: ReturnType<typeof vi.fn> }) {
  return (
    <PromptAssemblyPage
      pa={{ extension: { invoke } } as never}
      context={{ cwd, pathname: '', search: '', hash: '' }}
      surface={{ id: 'prompt-assembly', extensionId: 'system-prompt-assembly', title: 'Prompt Assembly', location: 'main', component: 'PromptAssemblyPage' } as never}
      params={{}}
    />
  );
}

describe('PromptAssemblyPage', () => {
  it('ignores stale runtime inspections after cwd changes', async () => {
    const firstLoad = deferred<ReturnType<typeof runtimeResult>>();
    const secondLoad = deferred<ReturnType<typeof runtimeResult>>();
    const invoke = vi.fn().mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise);

    const { rerender } = render(renderPage({ cwd: '/repo/one', invoke }));

    rerender(renderPage({ cwd: '/repo/two', invoke }));

    secondLoad.resolve(runtimeResult('/repo/two'));
    await waitFor(() => expect(screen.getByText(/CWD \/repo\/two/)).toBeTruthy());

    firstLoad.resolve(runtimeResult('/repo/one'));
    await Promise.resolve();

    expect(screen.getByText(/CWD \/repo\/two/)).toBeTruthy();
    expect(screen.queryByText(/CWD \/repo\/one/)).toBeNull();
  });
});
