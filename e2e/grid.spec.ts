import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('blotter sorts, filters, edits, and answers the keyboard', async ({ page }) => {
  await page.goto('/?rows=40');
  const grid = page.locator('.og-root');
  await expect(grid).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Symbol' })).toBeVisible();
  await page.getByRole('button', { name: 'Symbol', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Symbol' })).toHaveAttribute('aria-sort', 'ascending');

  await grid.focus();
  await page.keyboard.press('ArrowDown');
  const first = await grid.getAttribute('aria-activedescendant');
  await page.keyboard.press('ArrowRight');
  const second = await grid.getAttribute('aria-activedescendant');
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();
  expect(second).not.toBe(first);

  await page.getByRole('button', { name: 'Filter Qty' }).click();
  await page.getByLabel('Qty filter value').fill('200');
  await page.getByLabel('Qty filter operator').selectOption('greaterThan');
  await expect(page.getByTestId('row-count')).not.toHaveText('40 rows');

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.locator('.og-viewport').dblclick({ position: { x: 540, y: 18 } });
  const editor = page.locator('.og-editor');
  await expect(editor).toBeVisible();
  await editor.fill('125');
  await page.keyboard.press('Enter');
  await expect(editor).toBeHidden();
  await expect(page.locator('.og-arow').first().locator('.og-acell').nth(5)).toHaveText('125');

  await page.getByRole('button', { name: 'Symbol', exact: true }).click();
  await expect(page.locator('.og-arow').first().locator('.og-acell').nth(1)).toHaveText('TSLA');
});

test('axe finds no serious issues on the blotter', async ({ page }) => {
  await page.goto('/?rows=25');
  await expect(page.locator('.og-root')).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.page').analyze();
  const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious, JSON.stringify(serious.map((violation) => ({ id: violation.id, nodes: violation.nodes.length })))).toEqual([]);
});
