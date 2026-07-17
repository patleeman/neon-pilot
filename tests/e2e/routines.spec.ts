/* eslint-disable no-empty-pattern */
import { expect, test } from '@playwright/test';

import { expectCleanViewport, launchTestApp, navigateApp } from './fixtures/electronApp';

async function fillInputByValue(page: import('@playwright/test').Page, currentValue: string, nextValue: string): Promise<void> {
  await page.evaluate(
    ({ from, to }) => {
      const target = Array.from(document.querySelectorAll('input')).find((entry) => (entry as HTMLInputElement).value === from) as
        | HTMLInputElement
        | undefined;
      if (!target) throw new Error(`Input with value ${from} not found`);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(target, to);
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: to }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { from: currentValue, to: nextValue },
  );
}

async function saveOpenRoutine(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('body')).toContainText('Unsaved changes');
  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText('Saving…', { timeout: 15_000 });
  await expect(page.locator('body')).not.toContainText('Unsaved changes', { timeout: 15_000 });
}

async function routineTop(page: import('@playwright/test').Page, nameOrId: string): Promise<number> {
  const locator = nameOrId.startsWith('id:')
    ? page.locator(`[data-routine-id="${nameOrId.slice(3)}"]`).first()
    : page.locator('[data-routine-id]', { hasText: nameOrId }).first();
  const box = await locator.boundingBox();
  expect(box, `Routine ${nameOrId} should be visible`).toBeTruthy();
  return box!.y;
}

test('routines page supports GA editing, sidebar, runs, and drag workflows @routines', async ({}, testInfo) => {
  const testApp = await launchTestApp({ testInfo, initialRoute: '/routines' });
  try {
    const page = testApp.page;
    const routineName = `E2E temporary instruction ${Date.now()}`;
    const decisionName = `E2E path chooser ${Date.now()}`;
    const stopName = `E2E stop ${Date.now()}`;

    await expect(page.locator('body')).toContainText('No events added', { timeout: 45_000 });
    const checkpointExample = page.getByText('Check before checkpoint', { exact: true }).locator('..').locator('..');
    await checkpointExample.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('body')).toContainText('When Checkpoint runs', { timeout: 45_000 });
    await saveOpenRoutine(page);
    await expect(page.getByRole('tree', { name: 'Routines' })).toBeVisible();
    await expect(page.getByPlaceholder('Search routines…')).toHaveCount(0);
    await expect(page.locator('body')).toContainText('Checkpoint');
    await page.getByRole('button', { name: 'Add routine event' }).click();
    await expect(page.getByRole('button', { name: 'Done adding routine event' })).toBeVisible();
    await page.getByRole('tree', { name: 'Routines' }).getByText('Background command', { exact: true }).click();
    await expect(page.locator('body')).toContainText('When Background command runs');
    await expect(page.locator('body')).toContainText('No routines before this event.');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-navigate', { detail: { route: '/routines#checkpoint' } }));
    });
    await expect(page.locator('body')).toContainText('When Checkpoint runs', { timeout: 45_000 });

    await page.getByText('Add routine ▾').click();
    await page.getByText('Run prompt', { exact: true }).click();
    await fillInputByValue(page, 'New prompt', routineName);
    await page.locator('textarea').last().fill('E2E instruction /skill:');
    await page.getByRole('option', { name: /\/skill:autoreview/ }).click();
    await expect(page.locator('textarea').last()).toHaveValue('E2E instruction /skill:autoreview');
    await saveOpenRoutine(page);
    await expect(page.locator('body')).toContainText(routineName);

    const sourceRoutine = page.locator('[data-routine-id]', { hasText: routineName }).first();
    const targetRoutine = page.locator('[data-routine-id]', { hasText: 'Review code changes' }).first();
    await sourceRoutine.dragTo(targetRoutine, { targetPosition: { x: 24, y: 16 } });
    await expect
      .poll(async () => (await routineTop(page, routineName)) < (await routineTop(page, 'Review code changes')), { timeout: 15_000 })
      .toBe(true);

    await page.getByText('Add routine ▾').click();
    await page.getByText('Choose path', { exact: true }).click();
    await fillInputByValue(page, 'New path chooser', decisionName);
    await page.getByRole('button', { name: 'Add path' }).click();
    await fillInputByValue(page, 'new_path', 'needs_e2e');
    await fillInputByValue(page, 'Describe this path', 'Run the E2E branch');
    await saveOpenRoutine(page);
    await expect(page.locator('body')).toContainText(decisionName);
    await expect(page.locator('body')).toContainText('needs_e2e');

    await page.getByText('Add routine ▾').click();
    await page.getByRole('menuitem', { name: /Stop event/ }).click();
    await fillInputByValue(page, 'Stop event', stopName);
    await page.locator('textarea').last().fill('Stop from E2E.');
    await expect(page.locator('body')).toContainText('Unsaved changes');
    await saveOpenRoutine(page);
    await expect(page.locator('body')).toContainText(stopName);
    await page.getByLabel(`Delete ${stopName}`).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('body')).not.toContainText(stopName, { timeout: 15_000 });

    await expect(page.getByText('Routine context')).toBeVisible();
    await expect(page.getByText('No routine runs yet.')).toBeVisible();

    await navigateApp(page, '/routines');
    await expect(page.locator('body')).toContainText(routineName, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(decisionName, { timeout: 15_000 });
    await expect
      .poll(async () => (await routineTop(page, routineName)) < (await routineTop(page, 'Review code changes')), { timeout: 15_000 })
      .toBe(true);
    await testInfo.attach('routines-ga-smoke.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await expectCleanViewport(page);
    await expect(page.locator('body')).not.toContainText(/requires permission|Unhandled rejection|Cannot find module/i);
  } finally {
    await testApp.close();
  }
});
