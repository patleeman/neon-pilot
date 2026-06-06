// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ExtensionModalHost } from './ExtensionModalHost';

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
