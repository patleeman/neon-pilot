// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MultimediaProbeSettings } from './frontend';

const modelsMock = vi.fn();
const updateModelPreferencesMock = vi.fn();

vi.mock('@neon-pilot/extensions/settings', () => ({
  api: {
    models: () => undefined,
    updateModelPreferences: (input: unknown) => updateModelPreferencesMock(input),
  },
  useApi: () => modelsMock(),
}));

vi.mock('@neon-pilot/extensions/ui', () => ({
  WindowedField: ({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) => (
    <label className="wos-field">
      <span>{label}</span>
      {hint ? <span>{hint}</span> : null}
      {children}
    </label>
  ),
  WindowedPageMain: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main className="wos-page-main">
      <h1>{title}</h1>
      {children}
    </main>
  ),
  WindowedPageSection: ({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) => (
    <section className="wos-page-section" aria-label={title}>
      {meta ? <div>{meta}</div> : null}
      {children}
    </section>
  ),
  WindowedPageShell: ({ children, className, layout }: { children: React.ReactNode; className?: string; layout?: string }) => (
    <div className={['wos-page-shell', className].filter(Boolean).join(' ')} data-layout={layout}>
      {children}
    </div>
  ),
  WindowedSelect: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className="wos-select" {...props} />,
  WindowedStateBlock: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <div className="wos-state-block">
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  ),
}));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

function renderSettings() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<MultimediaProbeSettings settingsContext={{ extensionId: 'system-image-probe' }} />);
  });

  return { container };
}

describe('MultimediaProbeSettings', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders embedded settings content in the canonical windowed surface', () => {
    modelsMock.mockReturnValue({
      loading: false,
      error: null,
      data: {
        currentVisionModel: 'openai/gpt-4.1',
        models: [
          { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', input: ['text', 'image'] },
          { id: 'text-only', name: 'Text only', provider: 'local', input: ['text'] },
        ],
      },
    });

    const { container } = renderSettings();

    expect(container.querySelector('.wos-page-shell')).toBeNull();
    expect(container.querySelector('.image-probe-page-windowed')).not.toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('.wos-page-section')).not.toBeNull();
    expect(container.querySelector('.wos-field')).not.toBeNull();
    expect(container.querySelector('.wos-select')).not.toBeNull();
    expect(container.querySelector('.settings-row')).toBeNull();
    expect([...container.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Not configured', 'GPT-4.1 · openai']);
    expect(container.textContent).toContain('openai/gpt-4.1');
  });

  it('keeps windowed loading state inside the embedded settings panel', () => {
    modelsMock.mockReturnValue({
      loading: true,
      error: null,
      data: null,
    });

    const { container } = renderSettings();

    expect(container.querySelector('.wos-page-shell')).toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.textContent).toContain('Loading models.');
    expect(container.querySelector('.wos-state-block')).not.toBeNull();
  });
});
