// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AlertsSettingsPanel } from './frontend.js';

vi.mock('@neon-pilot/extensions/ui', () => ({
  Notice: ({ children }: { children: React.ReactNode }) => <div role="note">{children}</div>,
  QuietLoadingState: ({ label }: { label: string }) => <div role="status">{label}</div>,
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
  SettingsRow: ({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) => (
    <section aria-label={title}>
      <div>{description}</div>
      {children}
    </section>
  ),
  Switch: ({ checked, label, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean; label?: string }) => (
    <button type="button" aria-pressed={checked} onClick={onClick} {...props}>
      {label}
    </button>
  ),
  ToolbarButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props} />,
  WindowedDataRow: ({
    name,
    meta,
    cells,
    action,
  }: {
    name: string;
    meta?: string;
    cells?: Array<React.ReactNode | { value: React.ReactNode }>;
    action?: React.ReactNode;
  }) => (
    <div className="wos-data-row" aria-label={name}>
      <div>{name}</div>
      {meta ? <div>{meta}</div> : null}
      {cells?.map((cell, index) => (
        <div key={index}>{cell && typeof cell === 'object' && 'value' in cell ? cell.value : cell}</div>
      ))}
      {action}
    </div>
  ),
  WindowedDataTable: ({ children }: { children: React.ReactNode }) => <div className="wos-data-table">{children}</div>,
  WindowedPageMain: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main className="wos-page-main">
      <h1>{title}</h1>
      {children}
    </main>
  ),
  WindowedPageButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props} />,
  WindowedPageSection: ({ title, meta, children }: { title?: string; meta?: string; children: React.ReactNode }) => (
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
  WindowedSelect: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
  WindowedStateBlock: ({ children }: { children: React.ReactNode }) => <div className="wos-state-block">{children}</div>,
  WindowedToggle: ({
    checked,
    label,
    onChange,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean; label?: string; onChange?: (checked: boolean) => void }) => (
    <button
      type="button"
      className="wos-toggle"
      aria-pressed={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      {...props}
    />
  ),
}));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function renderPanel(invoke = vi.fn(), shellPresentation?: 'stable' | 'windowed') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<AlertsSettingsPanel pa={{ extension: { invoke } } as never} settingsContext={{ shellPresentation }} />);
  });

  return { container, invoke };
}

describe('AlertsSettingsPanel', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = '';
  });

  it('renders settings and saves toggle changes', async () => {
    const invoke = vi.fn(async (action: string, input?: unknown) => {
      if (action === 'readSettings') {
        return {
          settings: {
            enabled: true,
            nativeNotifications: true,
            soundEnabled: true,
            severity: 'disruptive',
            sound: 'pop',
          },
          systemNotificationsAvailable: true,
        };
      }
      if (action === 'updateSettings') {
        return {
          settings: {
            enabled: false,
            nativeNotifications: true,
            soundEnabled: true,
            severity: 'disruptive',
            sound: 'pop',
            ...(input as Record<string, unknown>),
          },
          systemNotificationsAvailable: true,
        };
      }
      return { ok: true };
    });

    const { container } = renderPanel(invoke);
    await act(async () => flush());

    expect(container.querySelector('[aria-label="Attention alerts"]')).not.toBeNull();
    expect([...container.querySelectorAll('select[aria-label="Alert sound"] option')].map((option) => option.textContent)).toEqual([
      'Basso',
      'Blow',
      'Bottle',
      'Frog',
      'Funk',
      'Glass',
      'Hero',
      'Morse',
      'Ping',
      'Pop',
      'Purr',
      'Sosumi',
      'Submarine',
      'Tink',
    ]);
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="Disable attention alerts"]');
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.click();
      await flush();
    });

    expect(invoke).toHaveBeenCalledWith('updateSettings', { enabled: false });
  });

  it('sends a test alert', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'readSettings') {
        return {
          settings: {
            enabled: true,
            nativeNotifications: true,
            soundEnabled: true,
            severity: 'disruptive',
            sound: 'pop',
          },
          systemNotificationsAvailable: false,
        };
      }
      return { ok: true };
    });

    const { container } = renderPanel(invoke);
    await act(async () => flush());

    const button = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === 'Send test');
    await act(async () => {
      button?.click();
      await flush();
    });

    expect(invoke).toHaveBeenCalledWith('sendTestAlert');
    expect(container.textContent).toContain('Test alert sent.');
  });

  it('renders embedded windowed rows in the desktop shell', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'readSettings') {
        return {
          settings: {
            enabled: true,
            nativeNotifications: true,
            soundEnabled: true,
            severity: 'all',
            sound: 'ping',
          },
          systemNotificationsAvailable: true,
        };
      }
      return { ok: true };
    });

    const { container } = renderPanel(invoke, 'windowed');
    await act(async () => flush());

    expect(container.querySelector('.wos-page-shell')).toBeNull();
    expect(container.querySelector('.alerts-page-windowed')).not.toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('.wos-page-section')).not.toBeNull();
    expect(container.querySelectorAll('.wos-data-row')).toHaveLength(4);
    expect(container.querySelector('.wos-toggle')).not.toBeNull();
    expect(container.textContent).toContain('macOS notifications');
    expect(container.querySelector('[aria-label="Attention alerts"]')?.classList.contains('wos-data-row')).toBe(true);
  });

  it('keeps windowed loading state inside the embedded settings panel', async () => {
    const invoke = vi.fn(() => new Promise(() => undefined));

    const { container } = renderPanel(invoke, 'windowed');
    await act(async () => flush());

    expect(container.querySelector('.wos-page-shell')).toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('.alerts-page-windowed')).not.toBeNull();
    expect(container.textContent).toContain('Loading alert settings.');
    expect(container.querySelector('.wos-state-block')).not.toBeNull();
  });

  it('shows a windowed error state when alert settings fail to load', async () => {
    const invoke = vi.fn(async () => {
      throw new Error('settings action unavailable');
    });

    const { container } = renderPanel(invoke, 'windowed');
    await act(async () => flush());

    expect(invoke).toHaveBeenCalledWith('readSettings', {});
    expect(container.querySelector('.wos-page-shell')).toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('.alerts-page-windowed')).not.toBeNull();
    expect(container.textContent).toContain('Alert settings failed to load: settings action unavailable');
  });
});
