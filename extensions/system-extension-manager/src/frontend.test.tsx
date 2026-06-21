// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildExtension: vi.fn(),
  deleteExtension: vi.fn(),
  exportExtension: vi.fn(),
  extensionInstallations: vi.fn(),
  notifyExtensionRegistryChanged: vi.fn(),
  openPath: vi.fn(),
  reloadExtension: vi.fn(),
  updateExtension: vi.fn(),
  validateExtension: vi.fn(),
  extensionKeybindings: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/data', () => ({
  api: {
    buildExtension: mocks.buildExtension,
    deleteExtension: mocks.deleteExtension,
    exportExtension: mocks.exportExtension,
    extensionInstallations: mocks.extensionInstallations,
    reloadExtension: mocks.reloadExtension,
    updateExtension: mocks.updateExtension,
    validateExtension: mocks.validateExtension,
    extensionKeybindings: mocks.extensionKeybindings,
  },
  EXTENSION_REGISTRY_CHANGED_EVENT: 'neon-pilot-extension-registry-changed',
  notifyExtensionRegistryChanged: mocks.notifyExtensionRegistryChanged,
}));

vi.mock('@neon-pilot/extensions/workbench', () => ({
  getDesktopBridge: () => ({
    openPath: mocks.openPath,
  }),
}));

vi.mock('@neon-pilot/extensions/workbench-browser', () => ({
  getDesktopBridge: () => ({
    openPath: mocks.openPath,
  }),
}));

import { ExtensionManagerPage, ExtensionRepositoriesSettingsPanel } from './frontend';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createExtension() {
  return {
    id: 'menu-test',
    name: 'Menu Test',
    description: 'Extension menu feedback test.',
    enabled: true,
    status: 'enabled',
    packageType: 'user',
    packageRoot: '/tmp/menu-test',
    uninstallable: true,
    routes: [],
    manifest: { contributes: { views: [] } },
    diagnostics: [],
    errors: [],
    skills: [],
    tools: [],
    backendActions: [],
    permissions: [],
  } as never;
}

function createConfigurableExtension() {
  return {
    ...createExtension(),
    id: 'configurable-test',
    name: 'Configurable Test',
    manifest: {
      contributes: {
        views: [],
        settings: {
          'configurableTest.enabled': {
            type: 'boolean',
            default: true,
            description: 'Toggle a test setting.',
          },
        },
      },
    },
  } as never;
}

function createSystemExtension() {
  return {
    ...createExtension(),
    id: 'system-menu-test',
    name: 'System Menu Test',
    packageType: 'system',
    uninstallable: false,
  } as never;
}

function createRequiredSystemExtension() {
  return {
    ...createSystemExtension(),
    id: 'system-settings',
    name: 'Settings panels',
    description: 'Native extension routes for first-party settings panels.',
    required: true,
  } as never;
}

function createSystemExtensionWithoutRowActions() {
  return {
    ...createSystemExtension(),
    id: 'system-menu-test-empty-actions',
    packageRoot: undefined,
  } as never;
}

function renderPage(options?: { toast?: ReturnType<typeof vi.fn>; notify?: ReturnType<typeof vi.fn> }) {
  const toast = options?.toast ?? vi.fn();
  const notify = options?.notify ?? vi.fn();

  return render(
    <MemoryRouter>
      <ExtensionManagerPage
        pa={{ ui: { toast, notify }, commands: { list: vi.fn().mockResolvedValue([]) } } as never}
        context={{} as never}
        surface={{} as never}
        params={{}}
      />
    </MemoryRouter>,
  );

  return { toast, notify };
}

function renderPageWithPa(pa: Record<string, unknown>) {
  render(
    <MemoryRouter>
      <ExtensionManagerPage pa={pa as never} context={{} as never} surface={{} as never} params={{}} />
    </MemoryRouter>,
  );
}

function renderRepositoriesSettingsPanel(pa: Record<string, unknown>) {
  render(<ExtensionRepositoriesSettingsPanel pa={pa as never} context={{} as never} surface={{} as never} params={{}} />);
}

describe('ExtensionManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extensionInstallations.mockResolvedValue([createExtension()]);
    mocks.extensionKeybindings.mockResolvedValue([]);
    mocks.deleteExtension.mockResolvedValue({ ok: true, extensionId: 'menu-test', deleted: true });
    mocks.reloadExtension.mockResolvedValue({ ok: true, id: 'menu-test', reloaded: true, message: 'Extension backend reloaded.' });
    mocks.updateExtension.mockResolvedValue({ extension: createExtension(), actionResult: { ok: true } });
    mocks.validateExtension.mockResolvedValue({
      ok: true,
      extensionId: 'menu-test',
      packageRoot: '/tmp/menu-test',
      findings: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    });
  });

  it('keeps the row actions menu focused on opening the package folder', async () => {
    renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('More actions'));

    expect(screen.getByText('Open folder')).toBeTruthy();
    expect(screen.queryByText('Build')).toBeNull();
    expect(screen.queryByText('Validate')).toBeNull();
    expect(screen.queryByText('Run self-test')).toBeNull();
    expect(screen.queryByText('Snapshot')).toBeNull();
    expect(screen.queryByText('Export')).toBeNull();
    expect(screen.queryByText('Copy diagnostics')).toBeNull();
  });

  it('does not render an empty row actions menu for extensions with no actions', async () => {
    mocks.extensionInstallations.mockResolvedValue([createSystemExtensionWithoutRowActions()]);
    renderPage();

    expect(await screen.findByText('System Menu Test')).toBeTruthy();
    expect(screen.queryByLabelText('More actions')).toBeNull();
  });

  it('keeps the row actions menu inside the viewport near the window bottom', async () => {
    renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    const moreButton = screen.getByLabelText('More actions');
    vi.spyOn(moreButton, 'getBoundingClientRect').mockReturnValue({
      x: 780,
      y: 560,
      width: 24,
      height: 24,
      top: 560,
      right: 804,
      bottom: 584,
      left: 780,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(820);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);

    fireEvent.click(moreButton);
    const menu = screen.getByRole('menu', { hidden: true });
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
      x: 652,
      y: 0,
      width: 160,
      height: 92,
      top: 0,
      right: 812,
      bottom: 92,
      left: 652,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.scroll(window);

    expect(Number.parseFloat(menu.style.top)).toBeLessThan(560);
    expect(Number.parseFloat(menu.style.top) + 92).toBeLessThanOrEqual(592);
    expect(Number.parseFloat(menu.style.right)).toBeGreaterThanOrEqual(8);
    expect(menu.style.left).toBe('auto');
    expect(menu.style.bottom).toBe('auto');
  });

  it('keeps extension row actions in a stable right-side column', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
    const { container } = renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    const actionsHeader = screen.getByText('Actions');
    const actionsCell = actionsHeader.closest('table')?.querySelector('tbody td:last-child');
    const moreButton = screen.getByLabelText('More actions');

    expect(actionsCell?.className).toContain('w-40');
    expect(actionsCell?.className).toContain('text-right');
    expect(moreButton.className).toContain('h-7');
    expect(moreButton.className).toContain('w-7');
    expect(container.querySelector('table')?.className).toContain('table-fixed');
  });

  it('shows a single extensions list with source labels and no catalog tab', async () => {
    renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Platform' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Attention' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Installed' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Built-in' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Available' })).toBeNull();
    expect(screen.queryByText('USER')).toBeNull();
    expect(screen.getAllByText('Installed').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'commands' })).toBeNull();
  });

  it('keeps required platform surfaces out of the default list but visible in the Platform tab', async () => {
    mocks.extensionInstallations.mockResolvedValue([createRequiredSystemExtension(), createExtension()]);
    renderPage();

    expect((await screen.findAllByRole('heading', { name: 'Extensions' })).length).toBeGreaterThan(0);
    expect(screen.getByText('Menu Test')).toBeTruthy();
    expect(screen.queryByText('Settings panels')).toBeNull();
    expect(screen.getByText('1 installed · 1 enabled')).toBeTruthy();
    expect(screen.getByLabelText('Disable Menu Test')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Platform' }));

    expect(screen.getByRole('heading', { name: 'Platform' })).toBeTruthy();
    expect(screen.getByText('Settings panels')).toBeTruthy();
    expect(screen.queryByText('Menu Test')).toBeNull();
    expect(screen.queryByLabelText('Disable Settings panels')).toBeNull();
    expect(screen.getByText('1 installed · 1 enabled · 1 platform')).toBeTruthy();
  });

  it('uses platform-specific empty copy when no required extensions are installed', async () => {
    mocks.extensionInstallations.mockResolvedValue([createExtension()]);
    renderPage();

    expect(await screen.findByText('Menu Test')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Platform' }));

    expect(screen.getByText('No platform extensions')).toBeTruthy();
    expect(screen.getByText('Required platform surfaces appear here when they are installed.')).toBeTruthy();
    expect(screen.queryByText('Clear search to show all installed extensions.')).toBeNull();
  });

  it('uses attention-specific empty copy when no extensions need attention', async () => {
    mocks.extensionInstallations.mockResolvedValue([createExtension()]);
    renderPage();

    expect(await screen.findByText('Menu Test')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Attention' }));

    expect(screen.getByText('No extensions need attention')).toBeTruthy();
    expect(screen.getByText('Diagnostics, updates, invalid state, and catalog drift will appear here.')).toBeTruthy();
    expect(screen.queryByText('Clear search to show all installed extensions.')).toBeNull();
  });

  it('sorts installed extensions by issue, disabled, then enabled', async () => {
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createExtension(),
        id: 'enabled-a',
        name: 'Enabled A',
      },
      {
        ...createExtension(),
        id: 'issue-m',
        name: 'Issue M',
        diagnostics: ['Needs attention.'],
      },
      {
        ...createExtension(),
        id: 'disabled-z',
        name: 'Disabled Z',
        enabled: false,
        status: 'disabled',
      },
    ]);
    renderPage();

    expect(await screen.findByText('Issue M')).toBeTruthy();
    const rows = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent ?? '');
    expect(rows[0]).toContain('Issue M');
    expect(rows[1]).toContain('Disabled Z');
    expect(rows[2]).toContain('Enabled A');
  });

  it('keeps the extensions table visible when enabling an extension fails', async () => {
    const notify = vi.fn();
    mocks.extensionInstallations.mockResolvedValue([{ ...createExtension(), enabled: false, status: 'disabled' }]);
    mocks.updateExtension.mockRejectedValue(new Error('Extension "Menu Test" requires Neon Pilot >=0.10.0 <0.11.0.'));

    renderPage({ notify });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Enable Menu Test'));

    expect(await screen.findByText('Failed to enable Menu Test')).toBeTruthy();
    expect(screen.getByText('Extension "Menu Test" requires Neon Pilot >=0.10.0 <0.11.0.')).toBeTruthy();
    expect(screen.getAllByText('Extensions').length).toBeGreaterThan(0);
    expect(screen.getByText('1 installed · 0 enabled')).toBeTruthy();
    expect(screen.getByLabelText('Enable Menu Test')).toBeTruthy();
    expect(notify).toHaveBeenCalledWith({
      message: 'Failed to enable Menu Test',
      details: 'Extension "Menu Test" requires Neon Pilot >=0.10.0 <0.11.0.',
      type: 'error',
      source: 'system-extension-manager',
    });
  });

  it('enables a disabled extension through the rendered installed row workflow', async () => {
    mocks.extensionInstallations.mockResolvedValue([{ ...createExtension(), enabled: false, status: 'disabled' }]);
    mocks.updateExtension.mockResolvedValue({
      extension: { ...createExtension(), enabled: true, status: 'enabled' },
      actionResult: { ok: true },
    });
    renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(screen.getByText('1 installed · 0 enabled')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Enable Menu Test'));

    await waitFor(() => {
      expect(screen.getByText('1 installed · 1 enabled')).toBeTruthy();
    });
    expect(screen.getByLabelText('Disable Menu Test')).toBeTruthy();
    expect(mocks.updateExtension).toHaveBeenCalledWith('menu-test', { enabled: true });
    expect(mocks.notifyExtensionRegistryChanged).toHaveBeenCalled();
  });

  it('combines installed add-ons and built-ins in the all extensions count', async () => {
    mocks.extensionInstallations.mockResolvedValue([createExtension(), createSystemExtension()]);
    renderPage();

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(screen.getByText('System Menu Test')).toBeTruthy();
    expect(screen.getByText('2 installed · 2 enabled')).toBeTruthy();
  });

  it('links configurable extensions to Settings', async () => {
    mocks.extensionInstallations.mockResolvedValue([createExtension(), createConfigurableExtension()]);
    renderPage();

    expect(await screen.findByText('Configurable Test')).toBeTruthy();
    expect(screen.getByLabelText('Configure Configurable Test in Settings').getAttribute('href')).toBe('/settings#settings-extensions');
    expect(screen.queryByLabelText('Configure Menu Test in Settings')).toBeNull();
  });

  it('points extension details to Settings instead of rendering duplicate controls', async () => {
    mocks.extensionInstallations.mockResolvedValue([createConfigurableExtension()]);
    renderPage();

    expect(await screen.findByText('Configurable Test')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Details for Configurable Test'));

    expect(await screen.findByRole('dialog', { name: 'Extension details' })).toBeTruthy();
    expect(screen.getByText('Configure Configurable Test from Settings.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open settings' }).getAttribute('href')).toBe('/settings#settings-extensions');
    expect(screen.queryByText('Toggle a test setting.')).toBeNull();
  });

  it('shows catalog-only extensions in the install modal instead of the installed table', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'available-only',
          name: 'Available Only',
          description: 'Catalog-only extension.',
          version: '1.0.0',
          tag: 'v1.0.0',
        },
      ],
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Available Only')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);
    expect(await screen.findByText('Available Only')).toBeTruthy();
  });

  it('does not offer catalog items already marked installed by the catalog', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'system-agent-browser',
          name: 'Agent Browser',
          description: 'Control browsers and Electron apps.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: true,
        },
        {
          id: 'available-only',
          name: 'Available Only',
          description: 'Catalog-only extension.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: false,
        },
      ],
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);

    expect(await screen.findByText('Available Only')).toBeTruthy();
    expect(within(screen.getByRole('dialog', { name: 'Install extension' })).queryByText('Agent Browser')).toBeNull();
  });

  it('shows catalog-installed extensions in the installed list when summaries lag', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'system-agent-browser',
          name: 'Agent Browser',
          description: 'Control browsers and Electron apps.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: true,
          enabled: false,
        },
      ],
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect(await screen.findByText('Agent Browser')).toBeTruthy();
  });

  it('deletes runtime-installed system-declared extensions', async () => {
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createSystemExtension(),
        id: 'system-browser',
        name: 'Browser',
        uninstallable: true,
      } as never,
    ]);
    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction: vi.fn().mockResolvedValue({ ok: true, version: '0.1.0', tag: 'v0.1.0', extensions: [] }) },
    });

    expect(await screen.findByText('Browser')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(mocks.deleteExtension).toHaveBeenCalledWith('system-browser'));
  });

  it('removes deleted catalog-installed extensions from the installed list', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.9.1-rc.6',
      tag: 'v0.9.1-rc.6',
      extensions: [
        {
          id: 'system-onboarding',
          name: 'Onboarding',
          description: 'Creates a one-time onboarding conversation.',
          version: '1.0.0',
          tag: 'v1.0.0',
          installed: true,
          enabled: true,
        },
      ],
    });
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createExtension(),
        id: 'system-onboarding',
        name: 'Onboarding',
        description: 'Creates a one-time onboarding conversation.',
        enabled: true,
        packageType: 'user',
      } as never,
    ]);
    mocks.deleteExtension.mockResolvedValue({ ok: true, extensionId: 'system-onboarding', deleted: true });
    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect(await screen.findByText('Onboarding')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Delete'));

    await screen.findByText('No extensions installed');
    expect(screen.queryByText('Onboarding')).toBeNull();
  });

  it('updates catalog-installed extensions from the actions menu', async () => {
    const callAction = vi.fn().mockResolvedValue({
      ok: true,
      version: '0.10.2',
      tag: 'v0.10.2',
      extensions: [
        {
          id: 'system-browser',
          name: 'Browser',
          description: 'Browse web pages beside a conversation.',
          version: '0.1.0',
          availableVersion: '0.1.0',
          installedVersion: '0.0.1',
          tag: 'v0.10.2',
          installed: true,
          enabled: true,
          updateAvailable: true,
        },
      ],
    });
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createExtension(),
        id: 'system-browser',
        name: 'Browser',
        description: 'Browse web pages beside a conversation.',
        enabled: true,
        packageType: 'user',
        version: '0.0.1',
      } as never,
    ]);
    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect(await screen.findByText('Update available: 0.0.1 -> 0.1.0')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Update'));

    expect(await screen.findByText('Updated Browser to 0.1.0.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Updated Browser to 0.1.0.');
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'updateCatalogExtension', { id: 'system-browser' });
    expect(mocks.notifyExtensionRegistryChanged).toHaveBeenCalled();
  });

  it('reinstalls catalog-installed extensions through the replace action', async () => {
    const callAction = vi.fn().mockImplementation(async (_extensionId: string, action: string) => {
      if (action === 'listInstallableExtensions') {
        return {
          ok: true,
          version: '0.10.2',
          tag: 'v0.10.2',
          extensions: [
            {
              id: 'system-browser',
              name: 'Browser',
              description: 'Browse web pages beside a conversation.',
              version: '0.1.0',
              availableVersion: '0.1.0',
              installedVersion: '0.1.0',
              tag: 'v0.10.2',
              installed: true,
              enabled: true,
              updateAvailable: false,
            },
          ],
        };
      }
      if (action === 'readExtensionSources') return { sources: [] };
      if (action === 'updateCatalogExtension') return { ok: true, updated: true };
      return { ok: true };
    });
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createExtension(),
        id: 'system-browser',
        name: 'Browser',
        description: 'Browse web pages beside a conversation.',
        enabled: true,
        packageType: 'user',
        version: '0.1.0',
      } as never,
    ]);
    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Browser')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Reinstall'));

    await waitFor(() => {
      expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'updateCatalogExtension', { id: 'system-browser' });
    });
    expect(mocks.deleteExtension).not.toHaveBeenCalled();
    expect(mocks.notifyExtensionRegistryChanged).toHaveBeenCalled();
  });

  it('updates all catalog-installed extensions with available updates', async () => {
    const callAction = vi.fn().mockImplementation(async (_extensionId: string, action: string) => {
      if (action === 'listInstallableExtensions') {
        return {
          ok: true,
          version: '0.10.2',
          tag: 'v0.10.2',
          extensions: [
            {
              id: 'system-browser',
              name: 'Browser',
              description: 'Browse web pages beside a conversation.',
              version: '0.1.0',
              availableVersion: '0.1.0',
              installedVersion: '0.0.1',
              tag: 'v0.10.2',
              installed: true,
              enabled: true,
              updateAvailable: true,
            },
            {
              id: 'system-ds4',
              name: 'DS4',
              description: 'DeepSeek model provider.',
              version: '0.1.3',
              availableVersion: '0.1.3',
              installedVersion: '0.1.2',
              tag: 'v0.10.2',
              installed: true,
              enabled: true,
              updateAvailable: true,
            },
          ],
        };
      }
      if (action === 'readExtensionSources') return { sources: [] };
      if (action === 'updateCatalogExtension') return { ok: true, updated: true };
      return { ok: true };
    });
    mocks.extensionInstallations.mockResolvedValue([
      {
        ...createExtension(),
        id: 'system-browser',
        name: 'Browser',
        description: 'Browse web pages beside a conversation.',
        enabled: true,
        packageType: 'user',
        version: '0.0.1',
      } as never,
      {
        ...createExtension(),
        id: 'system-ds4',
        name: 'DS4',
        description: 'DeepSeek model provider.',
        enabled: true,
        packageType: 'user',
        version: '0.1.2',
      } as never,
    ]);
    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect(await screen.findByRole('button', { name: 'Update all (2)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update all (2)' }));

    expect(await screen.findByText('Updated 2 extensions.')).toBeTruthy();
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'updateCatalogExtension', { id: 'system-browser' });
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'updateCatalogExtension', { id: 'system-ds4' });
    expect(mocks.notifyExtensionRegistryChanged).toHaveBeenCalled();
  });

  it('loads the installable catalog without starting a polling interval', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const callAction = vi.fn().mockResolvedValue({ ok: true, version: '0.9.1-rc.6', tag: 'v0.9.1-rc.6', extensions: [] });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    expect(callAction).toHaveBeenCalledTimes(2);
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'listInstallableExtensions', {});
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'readExtensionSources', {});
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 5_000)).toBe(false);
  });

  it('ignores stale installed extension refreshes after a newer registry event', async () => {
    const first = createDeferred<ReturnType<typeof createExtension>[]>();
    const second = createDeferred<ReturnType<typeof createExtension>[]>();
    mocks.extensionInstallations.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    renderPage();
    act(() => {
      window.dispatchEvent(new Event('neon-pilot-extension-registry-changed'));
    });

    await act(async () => {
      second.resolve([{ ...createExtension(), id: 'fresh-extension', name: 'Fresh Extension' } as never]);
      await second.promise;
    });
    expect(await screen.findByText('Fresh Extension')).toBeTruthy();

    await act(async () => {
      first.resolve([{ ...createExtension(), id: 'stale-extension', name: 'Stale Extension' } as never]);
      await first.promise;
    });
    await waitFor(() => expect(screen.queryByText('Stale Extension')).toBeNull());
    expect(screen.getByText('Fresh Extension')).toBeTruthy();
  });

  it('renders extension repositories as a settings panel', async () => {
    const callAction = vi.fn().mockResolvedValue({
      sources: [
        {
          id: 'neon-pilot',
          type: 'github',
          owner: 'patleeman',
          repo: 'neon-pilot-extensions',
          enabled: true,
          name: 'Neon Pilot Extensions',
        },
      ],
    });

    renderRepositoriesSettingsPanel({
      ui: { notify: vi.fn() },
      extensions: { callAction },
    });

    expect(await screen.findByText('Neon Pilot Extensions')).toBeTruthy();
    expect(screen.getByPlaceholderText('GitHub URL or owner/name')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'readExtensionSources', {});
  });

  it('adds extension repositories from the settings panel', async () => {
    const readResult = {
      sources: [
        {
          id: 'neon-pilot',
          type: 'github',
          owner: 'patleeman',
          repo: 'neon-pilot-extensions',
          enabled: true,
          name: 'Neon Pilot Extensions',
        },
      ],
    };
    const callAction = vi.fn().mockImplementation(async (_extensionId: string, action: string) => {
      if (action === 'readExtensionSources') return readResult;
      if (action === 'updateExtensionSources') return { ok: true, sources: readResult.sources };
      return { ok: true };
    });

    renderRepositoriesSettingsPanel({
      ui: { notify: vi.fn() },
      extensions: { callAction },
    });

    fireEvent.change(await screen.findByPlaceholderText('GitHub URL or owner/name'), {
      target: { value: 'https://github.com/example/neon-extensions.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));

    await screen.findByText('Added example/neon-extensions.');
    expect(callAction).toHaveBeenCalledWith('system-extension-manager', 'updateExtensionSources', {
      sources: [
        readResult.sources[0],
        { id: 'example-neon-extensions', type: 'github', owner: 'example', repo: 'neon-extensions', enabled: true },
      ],
    });
  });

  it('keeps agent plugin installs out of the extension install modal', async () => {
    const callAction = vi.fn().mockImplementation(async (_extensionId: string, action: string) => {
      if (action === 'listInstallableExtensions')
        return {
          ok: true,
          version: '0.9.1-rc.6',
          tag: 'v0.9.1-rc.6',
          extensions: [
            {
              id: 'native-extension',
              name: 'Native Extension',
              description: 'A native Neon Pilot extension.',
              version: '1.0.0',
              tag: 'v1.0.0',
              packageType: 'extension',
            },
          ],
        };
      return { ok: true };
    });

    renderPageWithPa({
      ui: { toast: vi.fn(), notify: vi.fn() },
      commands: { list: vi.fn().mockResolvedValue([]) },
      extensions: { callAction },
    });

    expect((await screen.findAllByText('Menu Test')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);
    expect(screen.queryByPlaceholderText('Extension, agent plugin, marketplace package, URL, or local path')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Package type' })).toBeNull();
    expect(screen.getByText('Available extensions')).toBeTruthy();
    expect(callAction).not.toHaveBeenCalledWith('system-extension-manager', 'installMarketplacePackage', expect.anything());
  });
});
