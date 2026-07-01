// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AlertsSettingsPanel } from './frontend.js';

vi.mock('@neon-pilot/extensions/ui', () => ({
  Notice: ({ children }: { children: React.ReactNode }) => <div role="note">{children}</div>,
  QuietLoadingState: ({ label }: { label: string }) => <div role="status">{label}</div>,
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
  SettingsRow: ({
    title,
    description,
    children,
  }: {
    title: string;
    description?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section aria-label={title}>
      <div>{description}</div>
      {children}
    </section>
  ),
  Switch: ({
    checked,
    label,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean; label?: string }) => (
    <button type="button" aria-pressed={checked} onClick={onClick} {...props}>
      {label}
    </button>
  ),
  ToolbarButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props} />,
}));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function renderPanel(invoke = vi.fn()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<AlertsSettingsPanel pa={{ extension: { invoke } } as never} />);
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
});
