// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExtensionRouteHost, QuietExtensionRouteLoading } from './ExtensionRouteHost';

vi.mock('../navigation/lazyRouteRecovery', () => ({
  lazyRouteWithRecovery: () =>
    function MockExtensionPage() {
      const location = useLocation();
      const [mountedAt] = useState(() => `${location.pathname}${location.search}`);

      return <div data-mounted-route={mountedAt} data-current-route={`${location.pathname}${location.search}`} />;
    },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots) {
    act(() => root.unmount());
  }
  roots.length = 0;
  document.body.innerHTML = '';
});

function RouteHarness() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/knowledge')}>
        Knowledge
      </button>
      <button type="button" onClick={() => navigate('/telemetry?range=24h')}>
        Telemetry
      </button>
      <ExtensionRouteHost />
    </>
  );
}

describe('ExtensionRouteHost', () => {
  it('uses a quiet accessible loading fallback for extension routes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<QuietExtensionRouteLoading />);
    });

    expect(container.textContent).toBe('');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading extension page');
  });

  it('preserves the extension page host when the extension route changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/knowledge']}>
          <Routes>
            <Route path="*" element={<RouteHarness />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-mounted-route]')?.getAttribute('data-mounted-route')).toBe('/knowledge');

    await act(async () => {
      container.querySelectorAll('button')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });

    const extensionPage = container.querySelector('[data-mounted-route]');
    expect(extensionPage?.getAttribute('data-mounted-route')).toBe('/knowledge');
    expect(extensionPage?.getAttribute('data-current-route')).toBe('/telemetry?range=24h');
  });
});
