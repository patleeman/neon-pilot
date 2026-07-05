import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('renderer startup browser suppression', () => {
  it('suppresses native workbench browser views before mounting desktop-shell routes', () => {
    const source = readFileSync(fileURLToPath(new URL('./main.tsx', import.meta.url)), 'utf-8');

    expect(source).toContain("desktopShellParams.get('desktop-shell') === '1'");
    expect(source).not.toContain('DESKTOP_SHELL_PRESENTATION_STORAGE_KEY');
    expect(source).not.toContain('persistedDesktopShellPresentation');
    expect(source).not.toContain("desktopShellParams.get('shell') !== 'stable'");
    expect(source).toContain('window.neonPilotDesktop');
    expect(source).toContain('setWorkbenchBrowserBounds({');
    expect(source).toContain('visible: false');
    expect(source).toContain('deactivate: true');
    expect(source).toContain('destroy: true');
    expect(source).toContain('windowedShellActive: true');
    expect(source.indexOf('setWorkbenchBrowserBounds({')).toBeLessThan(source.indexOf('startRendererBlockTelemetry();'));
  });
});
