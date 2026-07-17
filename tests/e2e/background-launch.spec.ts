/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { launchTestApp } from './fixtures/electronApp';

test('automated QA launch shows the app without taking window focus @background-launch', async ({}, testInfo) => {
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
