// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildExtensionRouteKey, ExtensionRouteHost } from './ExtensionRouteHost';

vi.mock('../navigation/lazyRouteRecovery', () => ({
  lazyRouteWithRecovery: () =>
    function MockExtensionPage() {
      const location = useLocation();
      const [mountedAt] = useState(() => buildExtensionRouteKey(location.pathname, location.search));

      return <div data-mounted-route={mountedAt}>{mountedAt}</div>;
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
  it('builds route keys from path and search', () => {
    expect(buildExtensionRouteKey('/telemetry', '?range=24h')).toBe('/telemetry?range=24h');
  });

  it('remounts extension pages when the extension route changes', async () => {
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

    expect(container.querySelector('[data-mounted-route]')?.textContent).toBe('/knowledge');

    await act(async () => {
      container.querySelectorAll('button')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(container.querySelector('[data-mounted-route]')?.textContent).toBe('/telemetry?range=24h');
  });
});
