/* eslint-disable no-empty-pattern */
import { execFileSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

import { launchTestApp } from './fixtures/electronApp';

test('automated QA launch shows the app without taking window focus @background-launch', async ({}, testInfo) => {
  // Give showInactive() an actual foreground application to preserve. Without
  // this, macOS may focus the only remaining visible app after a prior E2E app
  // exits, which tests OS fallback focus rather than Neon Pilot's launch mode.
  execFileSync('osascript', ['-e', 'tell application "Finder" to activate']);
  const testApp = await launchTestApp({ testInfo, initialRoute: '/' });
  try {
    const state = await testApp.app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {
        visible: window?.isVisible() ?? false,
        focused: window?.isFocused() ?? false,
      };
    });

    expect(state).toEqual({ visible: true, focused: false });
  } finally {
    await testApp.close();
  }
});
