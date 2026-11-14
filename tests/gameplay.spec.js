import { test, expect } from '@playwright/test';

test('guest can enter a visible playable world and mine a block', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#menu')).toBeVisible({ timeout: 8000 });
  await page.locator('#play').click();
  await expect(page.locator('#auth')).toBeVisible();
  await page.locator('#guest').click();
  await expect(page.locator('#game')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__?.worldTiles() || 0)).toBeGreaterThan(1000);
  await page.waitForTimeout(300);
  expect(errors, 'Browser runtime errors before frame assertion').toEqual([]);
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__?.frames || 0)).toBeGreaterThan(3);
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__?.tilesDrawn || 0)).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/game-screen.png', fullPage: true });

  const before = await page.evaluate(() => {
    const c = document.querySelector('#world');
    const ctx = c.getContext('2d');
    const image = ctx.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    for (let y = 0; y < c.height; y += 12) {
      for (let x = 0; x < c.width; x += 12) {
        const i = (y * c.width + x) * 4;
        colors.add(image[i] + ',' + image[i+1] + ',' + image[i+2]);
      }
    }
    return { colors: colors.size, width: c.width, height: c.height, tiles: window.__GD_TEST__.worldTiles() };
  });
  expect(before.width).toBeGreaterThan(300);
  expect(before.height).toBeGreaterThan(300);
  expect(before.tiles).toBeGreaterThan(1000);

  await page.locator('#mine').click();
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.worldTiles())).toBeLessThan(before.tiles);
  expect(errors).toEqual([]);
});
