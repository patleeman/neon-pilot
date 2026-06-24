import { describe, expect, it } from 'vitest';

import { buildExtensionCommandNotification } from './extensionCommandNotifications';

const command = {
  extensionId: 'system-computer-use',
  surfaceId: 'computer-use.status',
  title: 'Check Computer Use status',
  action: 'computerUseStatus',
  category: 'Computer Use',
};

describe('extension command notifications', () => {
  it('shows a recovery notification for missing Computer Use driver status', () => {
    expect(
      buildExtensionCommandNotification(command, {
        ok: false,
        installed: false,
        message: 'Cua Driver is not installed or is not on PATH.',
        error: 'spawn cua-driver ENOENT',
        installHint: 'Run the Install Cua Driver command, then grant Accessibility and Screen Recording permissions.',
      }),
    ).toEqual({
      type: 'warning',
      message: 'Cua Driver is not installed or is not on PATH.',
      details: 'Run the Install Cua Driver command, then grant Accessibility and Screen Recording permissions.',
      source: 'Computer Use',
    });
  });

  it('summarizes status-shaped successful results without dumping raw data', () => {
    expect(
      buildExtensionCommandNotification(command, {
        ok: true,
        installed: true,
        version: 'cua-driver 1.2.3',
        telemetry: 'disabled',
        health: { ok: true },
      }),
    ).toEqual({
      type: 'info',
      message: 'Check Computer Use status finished.',
      details: 'Version: cua-driver 1.2.3\nTelemetry: disabled',
      source: 'Computer Use',
    });
  });

  it('ignores command results without user-facing status content', () => {
    expect(buildExtensionCommandNotification(command, { selected: 'file.txt' })).toBeNull();
    expect(buildExtensionCommandNotification(command, 'ok')).toBeNull();
  });

  it('does not expose internal route or stack details in failure notifications', () => {
    expect(
      buildExtensionCommandNotification(command, {
        ok: false,
        message: [
          'Error: Local API route did not complete for GET /api/extensions/action at Module.ep',
          '(file:///Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/localApi.js:132:20)',
        ].join('\n'),
      }),
    ).toEqual({
      type: 'warning',
      message: 'Check Computer Use status failed.',
      details: undefined,
      source: 'Computer Use',
    });
  });
});
