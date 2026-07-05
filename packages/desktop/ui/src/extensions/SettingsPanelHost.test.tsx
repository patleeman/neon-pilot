// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsPanelHost } from './SettingsPanelHost';

vi.mock('./extensionFrontendReactGlobals', () => ({
  ensureExtensionFrontendReactGlobals: vi.fn(),
}));

vi.mock('./extensionRegistryEvents', () => ({
  getExtensionRegistryRevision: () => 1,
}));

vi.mock('./nativePaClient', () => ({
  createNativeExtensionClient: vi.fn(() => ({})),
}));

vi.mock('./systemExtensionModules', () => ({
  systemExtensionModules: new Map([
    [
      'system-context-panel',
      async () => ({
        ContextPanel: ({ settingsContext }: { settingsContext: { shellPresentation?: string } }) => (
          <div>{`shell:${settingsContext.shellPresentation}`}</div>
        ),
      }),
    ],
    ['system-test-panel', async () => ({ OtherPanel: () => null })],
    ['system-pending-panel', () => new Promise(() => {})],
    [
      'system-error-panel',
      async () => {
        throw new Error(
          'Failed to fetch dynamically imported module: /api/extensions/system-error-panel/files/dist/frontend.js?v=1 at file:///Users/patrick/app/localApi.js',
        );
      },
    ],
  ]),
}));

describe('SettingsPanelHost', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('passes shell presentation to extension settings components', async () => {
    render(
      <SettingsPanelHost
        shellPresentation="windowed"
        registration={{
          extensionId: 'system-context-panel',
          id: 'context-panel',
          component: 'ContextPanel',
          sectionId: 'settings-context-panel',
          label: 'Context Panel',
        }}
      />,
    );

    expect(await screen.findByText('shell:windowed')).toBeTruthy();
  });

  it('shows a visible error when a declared settings component export is missing', async () => {
    render(
      <SettingsPanelHost
        registration={{
          extensionId: 'system-test-panel',
          id: 'test-panel',
          component: 'MissingPanel',
          sectionId: 'settings-test-panel',
          label: 'Test Panel',
        }}
      />,
    );

    expect(await screen.findByText('App settings failed to render.')).toBeTruthy();
    expect(screen.getByText(/The settings panel for Test Panel could not load/)).toBeTruthy();
    expect(screen.queryByText(/system-test-panel:test-panel/)).toBeNull();
    expect(screen.queryByText(/MissingPanel/)).toBeNull();
  });

  it('keeps extension settings loading visually quiet', () => {
    render(
      <SettingsPanelHost
        registration={{
          extensionId: 'system-pending-panel',
          id: 'pending-panel',
          component: 'PendingPanel',
          sectionId: 'settings-pending-panel',
          label: 'Pending Panel',
        }}
      />,
    );

    expect(screen.getByRole('status', { name: 'Loading app settings' })).toBeTruthy();
    expect(screen.queryByText('Loading app settings…')).toBeNull();
  });

  it('does not expose raw import or module details when a settings panel fails to load', async () => {
    render(
      <SettingsPanelHost
        registration={{
          extensionId: 'system-error-panel',
          id: 'error-panel',
          component: 'ErrorPanel',
          sectionId: 'settings-error-panel',
          label: 'Error Panel',
        }}
      />,
    );

    expect(await screen.findByText('App settings failed to render.')).toBeTruthy();
    expect(screen.getByText(/The settings panel for Error Panel could not load/)).toBeTruthy();
    expect(screen.queryByText(/\/api\/extensions/)).toBeNull();
    expect(screen.queryByText(/localApi/)).toBeNull();
    expect(screen.queryByText(/file:\/\//)).toBeNull();
  });
});
