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
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__?.assets?.() || {tiles:false,miner:false})).toEqual({tiles:true,miner:true});
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


test('authenticated client wires world chunks, presence and mining RPCs', async ({ page }) => {
  const mockClient = `
    window.__SUPABASE_CALLS = [];
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000123', email: 'miner@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        rpc: async (name, args) => {
          window.__SUPABASE_CALLS.push({ name, args });
          if (name === 'golden_start') return { data: { gold: 150, level: 1, pickaxe_level: 1 }, error: null };
          if (name === 'golden_world_save_chunk') return { data: { revision: 1 }, error: null };
          return { data: { item_name: 'Copper Ore', quantity: 1, gold_earned: 0 }, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; },
            eq() { return query; },
            order() { return query; },
            limit() { return query; },
            maybeSingle() {
              return Promise.resolve({
                data: table === 'golden_player_state' ? { gold: 150, level: 1, pickaxe_level: 1 } : null,
                error: null
              });
            },
            then(resolve, reject) {
              return Promise.resolve({ data: [], error: null }).then(resolve, reject);
            }
          };
          return query;
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel: async () => 'ok'
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#game')).toBeVisible({ timeout: 8000 });
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_start'))).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_presence_update'))).toBeTruthy();

  await page.locator('#mine').click();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_mine'))).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.chunkState().dirty.length)).toBeGreaterThan(0);
  await page.evaluate(() => window.__GD_TEST__.flushChunks());
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_world_save_chunk'))).toBeTruthy();
  const saved = await page.evaluate(() => window.__SUPABASE_CALLS.find(x => x.name === 'golden_world_save_chunk'));
  expect(saved.args.p_tiles).toHaveLength(32);
  expect(saved.args.p_tiles.every(row => row.length === 32)).toBeTruthy();
});


test('online mining failure does not destroy or persist a block', async ({ page }) => {
  const mockClient = `
    window.__SUPABASE_CALLS = [];
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000124', email: 'miner2@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        rpc: async (name, args) => {
          window.__SUPABASE_CALLS.push({ name, args });
          if (name === 'golden_start') return { data: { gold: 0, level: 1, pickaxe_level: 1 }, error: null };
          if (name === 'golden_mine') return { data: null, error: { message: 'MINING_TOO_FAST' } };
          return { data: { revision: 1 }, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; },
            eq() { return query; },
            order() { return query; },
            limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: table === 'golden_player_state' ? { gold: 0, level: 1, pickaxe_level: 1 } : null, error: null }); },
            then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
          };
          return query;
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel: async () => 'ok'
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#game')).toBeVisible({ timeout: 8000 });
  const before = await page.evaluate(() => window.__GD_TEST__.worldTiles());
  await page.locator('#mine').click();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_mine'))).toBeTruthy();
  await expect(page.locator('#toast')).toContainText('Tunggu sebentar');
  expect(await page.evaluate(() => window.__GD_TEST__.worldTiles())).toBe(before);
  expect(await page.evaluate(() => window.__GD_TEST__.chunkState().dirty.length)).toBe(0);
  expect(await page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_world_save_chunk'))).toBeFalsy();
});
