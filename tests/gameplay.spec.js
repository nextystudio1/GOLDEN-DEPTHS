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
  expect(await page.evaluate(() => window.__GD_TEST__.worldSize())).toEqual({ width: 360, height: 120 });
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
  await page.locator('#mapToggle').click();
  await expect(page.locator('#mapPanel')).toBeVisible();
  expect(await page.locator('#worldMap').evaluate(el => ({width:el.width,height:el.height}))).toEqual({width:360,height:120});
  await expect(page.locator('#mapDot')).toBeVisible();
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


test('guest can open the live world events panel', async ({ page }) => {
  const mockClient = `
    window.supabase = {
      createClient: () => ({
        auth: { getSession: async () => ({ data: { session: null } }) },
        from: (table) => {
          const query = {
            select() { return query; },
            eq() { return query; },
            lte() { return query; },
            gte() { return query; },
            order() { return query; },
            then(resolve, reject) {
              const data = table === 'golden_world_events' ? [{
                title: 'Crystal Rush',
                description: 'Peluang Crystal Shard meningkat.',
                starts_at: new Date(Date.now() - 60000).toISOString(),
                ends_at: new Date(Date.now() + 86400000).toISOString(),
                rewards: { crystal_chance: '14%' }
              }] : [];
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            }
          };
          return query;
        }
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await page.locator('#eventToggle').click();
  await expect(page.locator('#events')).toBeVisible();
  await expect(page.locator('#eventList')).toContainText('Crystal Rush');
  await expect(page.locator('#eventList')).toContainText('Peluang Crystal Shard meningkat.');
});


test('online trade panel loads offers and calls the accept RPC', async ({ page }) => {
  const mockClient = `
    window.__SUPABASE_CALLS = [];
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000125', email: 'buyer@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        rpc: async (name, args) => {
          window.__SUPABASE_CALLS.push({ name, args });
          if (name === 'golden_start') return { data: { gold: 1000, level: 1, pickaxe_level: 1 }, error: null };
          return { data: { offer_id: 'offer-1', item_code: 'copper_ore', quantity: 2, gold_paid: 80 }, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; },
            eq() { return query; },
            order() { return query; },
            limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: { gold: 1000, level: 1, pickaxe_level: 1 }, error: null }); },
            then(resolve, reject) {
              const data = table === 'golden_trade_offers' ? [{
                id: 'offer-1', seller_id: '00000000-0000-0000-0000-000000000999',
                item_code: 'copper_ore', quantity: 2, gold_price: 80,
                created_at: new Date().toISOString()
              }] : [];
              return Promise.resolve({ data, error: null }).then(resolve, reject);
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
  await page.locator('#tradeToggle').click();
  await expect(page.locator('#tradeList')).toContainText('Copper Ore ×2');
  await page.locator('#tradeList button').filter({ hasText: 'BELI' }).click();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_trade_accept' && x.args.p_offer_id === 'offer-1'))).toBeTruthy();
  await expect(page.locator('#toast')).toContainText('Transaksi berhasil');
});
