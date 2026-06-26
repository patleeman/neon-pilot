// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setExtensionCommandContext } from './commands';
import { EXTENSION_MODAL_CLOSE_COMMAND_EVENT } from './extensionModalCommands';
import { ExtensionModalHost, resolveExtensionModalSizeClasses } from './ExtensionModalHost';
import { systemExtensionModules } from './systemExtensionModules';

vi.mock('./commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./commands')>()),
  setExtensionCommandContext: vi.fn(),
}));

describe('ExtensionModalHost confirm bridge', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.mocked(setExtensionCommandContext).mockClear();
    vi.useRealTimers();
  });

  function dispatchConfirm(detail: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    resolve: (value: boolean) => void;
  }) {
    window.dispatchEvent(new CustomEvent('neon-pilot-extension-confirm', { detail }));
  }

  it('resolves true when the shared confirm dialog is confirmed', async () => {
    render(<ExtensionModalHost />);

    const result = new Promise<boolean>((resolve) => {
      act(() => {
        dispatchConfirm({
          title: 'Delete automation',
          message: 'Delete Daily check? This cannot be undone.',
          confirmLabel: 'Delete',
          resolve,
        });
      });
    });

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.getByText('Delete Daily check? This cannot be undone.')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await expect(result).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('resolves false when the shared confirm dialog is canceled', async () => {
    render(<ExtensionModalHost />);

    const result = new Promise<boolean>((resolve) => {
      act(() => {
        dispatchConfirm({
          title: 'Delete extension',
          message: 'Delete System Knowledge?',
          cancelLabel: 'Keep',
          resolve,
        });
      });
    });

    expect(await screen.findByRole('dialog')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    await expect(result).resolves.toBe(false);
  });

  it('does not render backend UI confirmations as dialogs', () => {
    render(<ExtensionModalHost />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('neon-pilot-extension-ui-confirm', {
          detail: {
            requestId: 'confirm-1',
            extensionId: 'system-skill-search',
            title: 'Install community skill',
            message: 'Install Reviewer from Community Skills?',
            confirmLabel: 'Install',
            cancelLabel: 'Cancel',
            timeoutMs: 60_000,
          },
        }),
      );
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Install Reviewer from Community Skills?')).toBeNull();
  });
});

describe('ExtensionModalHost modal bridge', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    systemExtensionModules.delete('test-extension');
    vi.mocked(setExtensionCommandContext).mockClear();
  });

  it('closes an extension modal from the shared command event', async () => {
    systemExtensionModules.set('test-extension', async () => ({
      TestModal: () => <div>Extension modal body</div>,
    }));
    render(<ExtensionModalHost />);

    const result = new Promise<unknown>((resolve, reject) => {
      act(() => {
        window.dispatchEvent(
          new CustomEvent('neon-pilot-extension-modal', {
            detail: {
              extensionId: 'test-extension',
              title: 'Test modal',
              component: 'TestModal',
              props: {},
              resolve,
              reject,
            },
          }),
        );
      });
    });

    expect(await screen.findByText('Extension modal body')).not.toBeNull();
    expect(setExtensionCommandContext).toHaveBeenCalledWith('extensionModal.open', true);

    act(() => {
      window.dispatchEvent(new CustomEvent(EXTENSION_MODAL_CLOSE_COMMAND_EVENT));
    });

    await expect(result).resolves.toBeNull();
    await waitFor(() => expect(screen.queryByText('Extension modal body')).toBeNull());
    expect(setExtensionCommandContext).toHaveBeenCalledWith('extensionModal.open', null);
  });

  it('shows safe copy when an extension modal component cannot be loaded', async () => {
    systemExtensionModules.set('test-extension', async () => ({
      OtherModal: () => <div>Other modal body</div>,
    }));
    render(<ExtensionModalHost />);

    const result = new Promise<unknown>((resolve, reject) => {
      act(() => {
        window.dispatchEvent(
          new CustomEvent('neon-pilot-extension-modal', {
            detail: {
              extensionId: 'test-extension',
              title: 'Test modal',
              component: 'TestModal',
              props: {},
              resolve,
              reject,
            },
          }),
        );
      });
    });

    expect(await screen.findByText('This extension dialog could not be loaded.')).not.toBeNull();
    expect(document.body.textContent).not.toContain('TestModal');
    await expect(result).resolves.toBeNull();
  });
});

describe('resolveExtensionModalSizeClasses', () => {
  it('keeps default extension modals compact', () => {
    const classes = resolveExtensionModalSizeClasses(undefined);

    expect(classes.dialogClassName).toContain('ui-extension-modal-default');
    expect(classes.bodyClassName).toBeUndefined();
  });

  it('provides an intermediate large modal size', () => {
    const classes = resolveExtensionModalSizeClasses('large');

    expect(classes.dialogClassName).toContain('ui-extension-modal-large');
    expect(classes.bodyClassName).toContain('overflow-auto');
  });

  it('makes fullscreen extension modals fill the usable viewport below desktop chrome', () => {
    const classes = resolveExtensionModalSizeClasses('fullscreen');

    expect(classes.backdropClassName).toContain('!pt-[calc(2.75rem+0.5rem)]');
    expect(classes.dialogClassName).toContain('ui-extension-modal-fullscreen');
    expect(classes.bodyClassName).toContain('overflow-hidden');
    expect(classes.bodyClassName).toContain('flex-1');
    expect(classes.bodyClassName).toContain('p-0');
  });
});
