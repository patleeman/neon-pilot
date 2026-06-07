// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ExtensionModalHost, resolveExtensionModalSizeClasses } from './ExtensionModalHost';

describe('ExtensionModalHost confirm bridge', () => {
  afterEach(() => {
    document.body.innerHTML = '';
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
});

describe('resolveExtensionModalSizeClasses', () => {
  it('keeps default extension modals compact', () => {
    const classes = resolveExtensionModalSizeClasses(undefined);

    expect(classes.dialogClassName).toContain('max-w-2xl');
    expect(classes.dialogClassName).toContain('max-h-[85vh]');
    expect(classes.bodyClassName).toBeUndefined();
  });

  it('provides an intermediate large modal size', () => {
    const classes = resolveExtensionModalSizeClasses('large');

    expect(classes.dialogClassName).toContain('w-[min(78rem,calc(100vw-2rem))]');
    expect(classes.dialogClassName).toContain('h-[min(86vh,calc(100vh-2rem))]');
    expect(classes.bodyClassName).toContain('overflow-auto');
  });

  it('makes fullscreen extension modals fill the usable viewport below desktop chrome', () => {
    const classes = resolveExtensionModalSizeClasses('fullscreen');

    expect(classes.backdropClassName).toContain('!pt-[calc(2.75rem+0.5rem)]');
    expect(classes.dialogClassName).toContain('!w-[calc(100vw-1.5rem)]');
    expect(classes.dialogClassName).toContain('!h-[calc(100vh-4rem)]');
    expect(classes.bodyClassName).toContain('overflow-hidden');
    expect(classes.bodyClassName).toContain('flex-1');
    expect(classes.bodyClassName).toContain('p-0');
  });
});
