import { describe, expect, it } from 'vitest';

import { buildDesktopStartupErrorPageDataUrl, buildDesktopStartupErrorPageHtml } from './startup-error-page.js';

describe('startup error page helpers', () => {
  it('renders recovery guidance and desktop actions without raw internals in the viewport', () => {
    const html = buildDesktopStartupErrorPageHtml({
      message: 'Error: backend failed\n    at Module.run (file:///tmp/local-backend-child.js:1:2)',
      logsDir: '/tmp/raw/logs',
    });

    expect(html).toContain('Neon Pilot couldn’t finish starting.');
    expect(html).toContain('The runtime did not become ready.');
    expect(html).toContain('Diagnostic logs are available from the button below.');
    expect(html).not.toContain('backend failed');
    expect(html).not.toContain('file:///tmp/local-backend-child.js');
    expect(html).not.toContain('Logs: <code>/tmp/raw/logs</code>');
    expect(html).toContain('desktop.openPath(logsDir)');
    expect(html).toContain("window.location.href = 'neon-pilot://app/'");
  });

  it('encodes the HTML into a data URL for BrowserWindow.loadURL', () => {
    const dataUrl = buildDesktopStartupErrorPageDataUrl({
      message: 'boom',
      logsDir: '/tmp/logs',
    });

    expect(dataUrl.startsWith('data:text/html;charset=UTF-8,')).toBe(true);
    const html = decodeURIComponent(dataUrl.slice('data:text/html;charset=UTF-8,'.length));
    expect(html).toContain('Neon Pilot couldn’t finish starting.');
    expect(html).not.toContain('boom');
  });
});
