// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ExtensionPage } from './ExtensionPage';

vi.mock('../components/notifications/notificationStore', () => ({
  addNotification: vi.fn(),
}));

vi.mock('./NativeExtensionSurfaceHost', () => ({
  NativeExtensionSurfaceHost: ({ surface }: { surface: { extensionId: string; id: string } }) => (
    <div data-testid="surface-host" data-extension-id={surface.extensionId} data-surface-id={surface.id} />
  ),
}));

vi.mock('./useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({
    loading: false,
    error: null,
    surfaces: [],
  }),
}));

describe('ExtensionPage', () => {
  it('falls back to the bundled extension manager page when the registry route is missing', () => {
    render(
      <MemoryRouter initialEntries={['/extensions']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-extension-id')).toBe('system-extension-manager');
    expect(host.getAttribute('data-surface-id')).toBe('extensions-page');
    expect(screen.queryByText(/Extension surface unavailable/i)).toBeNull();
  });
});
