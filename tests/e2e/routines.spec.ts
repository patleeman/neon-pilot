/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { launchTestApp, navigateApp } from './fixtures/electronApp';

test('routines page supports creating and saving a routine @routines', async ({}, testInfo) => {
  const testApp = await launchTestApp({ testInfo, initialRoute: '/routines' });
  try {
    const page = testApp.page;
    const routineName = `E2E temporary instruction ${Date.now()}`;

    await expect(page.locator('body')).toContainText('Checkpoint timeline', { timeout: 45_000 });
    await page.getByRole('button', { name: 'Add instruction' }).first().click();
    await page
      .locator('input')
      .filter({ hasText: '' })
      .evaluateAll((inputs, name) => {
        const target = inputs.find((input) => (input as HTMLInputElement).value === 'New instruction') as HTMLInputElement | undefined;
        if (!target) {
          throw new Error('New instruction input not found');
        }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(target, name);
        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(name) }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }, routineName);
    await page.locator('textarea').last().fill('E2E instruction /skill:');
    await expect(page.locator('body')).toContainText('Unsaved changes');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await expect(page.locator('body')).not.toContainText('Unsaved changes', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(routineName);

    await navigateApp(page, '/routines');
    await expect(page.locator('body')).toContainText(routineName, { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/requires permission|Unhandled rejection|Cannot find module/i);
  } finally {
    await testApp.close();
  }
});
