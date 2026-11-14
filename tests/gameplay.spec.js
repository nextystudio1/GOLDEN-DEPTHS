import { test, expect } from '@playwright/test';

async function enterWorldFromLobby(page) {
  await expect(page.locator('#lobby')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#worldRoomList button').first()).toBeVisible({ timeout: 10000 });
  await page.locator('#worldRoomList button').first().click();
  await expect(page.locator('#game')).toBeVisible({ timeout: 10000 });
}

async function holdMineBlock(page, holdMs = 1500) {
  const setup = await page.evaluate(() => {
    let block = window.__GD_TEST__.findReachableBlock();
    if (!block) {
      const p = window.__GD_TEST__.player();
      block = window.__GD_TEST__.setTestBlock(Math.floor(p.x / 24) + 1, Math.floor(p.y / 24) + 1, 2);
    }
    return { target: block, beforeMine: window.__GD_TEST__.worldTiles() };
  });
  const target = setup.target;
  expect(target).not.toBeNull();
  const point = await page.evaluate(({x,y}) => {
    const canvas = document.querySelector('#world');
    const rect = canvas.getBoundingClientRect();
    const camera = window.__GD_TEST__.camera();
    return { clientX: rect.left + (x + .5) * 24 - camera.x,
             clientY: rect.top + (y + .5) * 24 - camera.y };
  }, target);
  await page.locator('#world').dispatchEvent('pointerdown', {
    pointerId: 7, pointerType: 'touch', clientX: point.clientX, clientY: point.clientY,
    bubbles: true, cancelable: true
  });
  await page.waitForTimeout(holdMs);
  await page.locator('#world').dispatchEvent('pointerup', {
    pointerId: 7, pointerType: 'touch', clientX: point.clientX, clientY: point.clientY,
    bubbles: true, cancelable: true
  });
  return { ...target, beforeMine: setup.beforeMine };
}


test('guest can enter a visible playable world and mine a block', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#menu')).toBeVisible({ timeout: 8000 });
  await page.locator('#play').click();
  await expect(page.locator('#auth')).toBeVisible();
  await page.locator('#guest').click();
  await enterWorldFromLobby(page);
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

  await holdMineBlock(page);
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
          if (name === 'golden_start') return { data: { gold: 150, level: 1, pickaxe_level: 1, world_x: 100, world_y: 18 }, error: null };
          if (name === 'golden_world_save_chunk') return { data: { revision: 1 }, error: null };
          if (name === 'golden_mine') return { data: { item_name: 'Copper Ore', quantity: 1, tile_type: 2, chunk_revision: 1 }, error: null };
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
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await enterWorldFromLobby(page);
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_start'))).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_presence_update'))).toBeTruthy();
  const restored = await page.evaluate(() => window.__GD_TEST__.player());
  expect(restored.x).toBe(2400);
  expect(restored.y).toBeGreaterThanOrEqual(432);
  expect(restored.y).toBeLessThan(456);
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_player_position_save' && x.args.p_x === 100 && x.args.p_y >= 18 && x.args.p_y <= 19))).toBeTruthy();

  const target = await holdMineBlock(page);
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_mine'))).toBeTruthy();
  const miningCall = await page.evaluate(() => window.__SUPABASE_CALLS.find(x => x.name === 'golden_mine'));
  expect(miningCall.args).toMatchObject({ p_x: target.x, p_y: target.y });
  expect(Number.isInteger(miningCall.args.p_player_x)).toBeTruthy();
  expect(Number.isInteger(miningCall.args.p_player_y)).toBeTruthy();
  await expect.poll(() => page.evaluate(({x,y}) => window.__GD_TEST__.chunkRevision(x,y), target)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.worldTiles())).toBeLessThan(target.beforeMine);
  expect(await page.evaluate(() => window.__GD_TEST__.chunkState().dirty.length)).toBe(0);
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
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await enterWorldFromLobby(page);
  const before = await page.evaluate(() => window.__GD_TEST__.worldTiles());
  await holdMineBlock(page);
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
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await enterWorldFromLobby(page);
  await page.locator('#eventToggle').click();
  await expect(page.locator('#events')).toBeVisible();
  await expect(page.locator('#eventList')).toContainText('Crystal Rush');
  await expect(page.locator('#eventList')).toContainText('Peluang Crystal Shard meningkat.');
});


test('nearby player can be selected and sent a direct trade request', async ({ page }) => {
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
          if (name === 'golden_start') return { data: { gold: 1000, level: 1, pickaxe_level: 1, world_x: 100, world_y: 18 }, error: null };
          if (name === 'golden_player_trade_request') return { data: { trade_id: 'direct-trade-1', status: 'pending' }, error: null };
          return { data: {}, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; },
            eq() { return query; },
            order() { return query; },
            limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: table === 'golden_player_state' ? { gold: 1000, level: 1, pickaxe_level: 1 } : null, error: null }); },
            then(resolve, reject) {
              const data = table === 'golden_player_presence' ? [{
                user_id: '00000000-0000-0000-0000-000000000999',
                world_id: 'main', x: 102, y: 18, facing: -1, animation: 'idle',
                last_seen: new Date().toISOString()
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
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await enterWorldFromLobby(page);
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.player().x)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.otherPlayers().length)).toBe(1);
  const camera = await page.evaluate(() => window.__GD_TEST__.camera());
  await page.mouse.click(102 * 24 - camera.x, 18 * 24 - camera.y);
  await expect(page.locator('#playerAction')).toBeVisible();
  await page.locator('#playerTradeRequest').click();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_player_trade_request' && x.args.p_target === '00000000-0000-0000-0000-000000000999'))).toBeTruthy();
  await expect(page.locator('#toast')).toContainText('Permintaan trade dikirim');
});

test('incoming trade request opens the live offer and confirmation panel', async ({ page }) => {
  const mockClient = `
    window.__SUPABASE_CALLS = [];
    window.__TRADE_CHANGE = null;
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000126', email: 'receiver@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        rpc: async (name, args) => {
          window.__SUPABASE_CALLS.push({ name, args });
          if (name === 'golden_start') return { data: { gold: 150, level: 1, pickaxe_level: 1, world_x: 100, world_y: 18 }, error: null };
          if (name === 'golden_player_trade_respond') return { data: { status: 'open' }, error: null };
          if (name === 'golden_player_trade_confirm') return { data: { completed: false }, error: null };
          return { data: { ok: true }, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; },
            eq() { return query; },
            order() { return query; },
            limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: table === 'golden_player_state' ? { gold: 150, level: 1, pickaxe_level: 1 } : null, error: null }); },
            single() {
              return Promise.resolve({
                data: table === 'golden_player_trades' ? {
                  id: 'incoming-trade-2',
                  initiator_id: '00000000-0000-0000-0000-000000000999',
                  recipient_id: '00000000-0000-0000-0000-000000000126',
                  status: 'open', initiator_items: [], recipient_items: [],
                  initiator_gold: 0, recipient_gold: 0,
                  initiator_confirmed: false, recipient_confirmed: false
                } : null,
                error: null
              });
            },
            then(resolve, reject) {
              return Promise.resolve({ data: [], error: null }).then(resolve, reject);
            }
          };
          return query;
        },
        channel: () => ({
          on(event, filter, callback) {
            if (filter?.table === 'golden_player_trades') window.__TRADE_CHANGE = callback;
            return this;
          },
          subscribe() { return this; }
        }),
        removeChannel: async () => 'ok'
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await enterWorldFromLobby(page);
  await page.evaluate(async () => window.__TRADE_CHANGE({ new: {
    id: 'incoming-trade-2',
    initiator_id: '00000000-0000-0000-0000-000000000999',
    recipient_id: '00000000-0000-0000-0000-000000000126',
    status: 'pending'
  }}));
  await expect(page.locator('#incomingTrade')).toBeVisible();
  await page.locator('#incomingTradeAccept').click();
  await expect(page.locator('#directTrade')).toBeVisible();
  await expect(page.locator('#otherTradeName')).toContainText('Miner 000000');
  await page.locator('#directTradeConfirm').click();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_player_trade_confirm'))).toBeTruthy();
  await page.locator('#directTradeCancel').click();
  await expect(page.locator('#directTrade')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_player_trade_cancel'))).toBeTruthy();
});

test('in-game account deletion requires the typed confirmation word', async ({ page }) => {
  const mockClient = `
    window.__DELETE_INVOKES = 0;
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000126', email: 'player@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        functions: { invoke: async () => { window.__DELETE_INVOKES++; return { data: { ok: true }, error: null }; } },
        rpc: async (name) => name === 'golden_start'
          ? { data: { gold: 150, level: 1, pickaxe_level: 1, world_x: 100, world_y: 18 }, error: null }
          : { data: {}, error: null },
        from: (table) => {
          const query = {
            select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: table === 'golden_player_state' ? { gold: 150, level: 1, pickaxe_level: 1 } : null, error: null }); },
            then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
          };
          return query;
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel: async () => 'ok'
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await enterWorldFromLobby(page);
  await page.locator('#accountToggle').click();
  await expect(page.locator('#accountPanel')).toBeVisible();
  const deleteButtonState = await page.locator('#accountDeleteOpen').evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { handler: typeof el.onclick, display: getComputedStyle(el).display, pointerEvents: getComputedStyle(el).pointerEvents, rect: {x:r.x,y:r.y,w:r.width,h:r.height}, hitTag: hit?.tagName, hitId: hit?.id };
  });
  console.log('account delete control state', deleteButtonState);
  await page.locator('#accountDeleteOpen').click();
  await expect(page.locator('#accountDeletePanel')).toBeVisible();
  await page.locator('#deleteAccountWord').fill('SALAH');
  await page.locator('#deleteAccountDo').click();
  await expect(page.locator('#deleteAccountMsg')).toContainText('Ketik HAPUS');
  expect(await page.evaluate(() => window.__DELETE_INVOKES)).toBe(0);
});

test('public account deletion page verifies login and confirmation before request', async ({ page }) => {
  const mockClient = `
    window.__DELETE_INVOKES = 0;
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
          signInWithPassword: async ({ email }) => ({ data: { user: { email } }, error: null }),
          signOut: async () => ({ error: null })
        },
        functions: { invoke: async (name) => { window.__DELETE_INVOKES++; return { data: { ok: true }, error: null }; } }
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/account-deletion.html');
  await page.locator('#email').fill('player@example.test');
  await page.locator('#password').fill('test-password');
  await page.locator('#loginButton').click();
  await expect(page.locator('#accountCard')).toBeVisible();
  await page.locator('#confirmWord').fill('HAPUS');
  await page.locator('#deleteButton').click();
  await expect(page.locator('#status')).toContainText('Akun berhasil dihapus');
  expect(await page.evaluate(() => window.__DELETE_INVOKES)).toBe(1);
});

test('landscape play controls move the player and remain on screen', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await enterWorldFromLobby(page);
  const controls = await Promise.all(['#left','#right','#jump','#hotbar'].map(sel => page.locator(sel).boundingBox()));
  for (const rect of controls) {
    expect(rect).not.toBeNull();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(915);
    expect(rect.y + rect.height).toBeLessThanOrEqual(412);
  }
  const before = await page.evaluate(() => window.__GD_TEST__.player().x);
  const right = await page.locator('#right').boundingBox();
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.up();
  const afterPointer = await page.evaluate(() => window.__GD_TEST__.player().x);
  expect(afterPointer).toBeGreaterThan(before + 10);
  await page.keyboard.down('d');
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.input().right)).toBeTruthy();
  await page.keyboard.up('d');
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.input().right)).toBeFalsy();
});


test('guest pickaxe shop displays price and applies an upgrade', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gd_stats', JSON.stringify({ gold: 1000, level: 1, pick: 1 })));
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await enterWorldFromLobby(page);
  await page.locator('#upgrade').click();
  await expect(page.locator('#shop')).toBeVisible();
  await expect(page.locator('#shopPickCost')).toHaveText('180 AURUM');
  await page.locator('#buyUpgrade').click();
  await expect(page.locator('#pick')).toHaveText('2');
  await expect(page.locator('#gold')).toHaveText('820');
  await expect(page.locator('#shopPickName')).toHaveText('Stone Pickaxe');
});


test('online crafting calls the server recipes', async ({ page }) => {
  const mockClient = `
    window.__SUPABASE_CALLS = [];
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000126', email: 'crafter@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        rpc: async (name, args) => {
          window.__SUPABASE_CALLS.push({ name, args });
          if (name === 'golden_start') return { data: { gold: 0, level: 1, pickaxe_level: 1, world_x: 180, world_y: 20 }, error: null };
          if (name === 'golden_craft') return { data: { item_name: args.p_recipe_code === 'crystal_lamp' ? 'Crystal Lamp' : 'Stone Platform', quantity: 1 }, error: null };
          return { data: {}, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; },
            eq() { return query; },
            order() { return query; },
            limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: { gold: 0, level: 1, pickaxe_level: 1 }, error: null }); },
            then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
          };
          return query;
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel: async () => 'ok'
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await enterWorldFromLobby(page);
  await page.locator('#craftToggle').click();
  await page.locator('#craftLamp').click();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_craft' && x.args.p_recipe_code === 'crystal_lamp'))).toBeTruthy();
  await expect(page.locator('#toast')).toContainText('Crystal Lamp');
  await page.locator('#craftPlatform').click();
  await expect.poll(() => page.evaluate(() => window.__SUPABASE_CALLS.some(x => x.name === 'golden_craft' && x.args.p_recipe_code === 'stone_platform'))).toBeTruthy();
});



test('guest can choose a named biome mine before entering gameplay', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#worldRoomList')).toContainText('Amber Quarry');
  await page.locator('#worldRoomList button').nth(1).click();
  await expect(page.locator('#game')).toBeVisible();
  expect(await page.evaluate(() => window.__GD_TEST__.world())).toEqual({
    id: 'guest_dunes', name: 'Amber Quarry', biome: 'amber', seed: 10.45
  });
});


test('guest mine blocks persist when reopening the same named world', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await enterWorldFromLobby(page);
  const target = await page.evaluate(() => window.__GD_TEST__.findReachableBlock());
  expect(target).not.toBeNull();
  await holdMineBlock(page, 1500);
  await expect.poll(() => page.evaluate(({x,y}) => window.__GD_TEST__.tileAt(x,y), target)).toBe(-1);
  const afterMining = await page.evaluate(() => window.__GD_TEST__.worldTiles());
  await page.reload();
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await enterWorldFromLobby(page);
  expect(await page.evaluate(() => window.__GD_TEST__.worldTiles())).toBe(afterMining);
  expect(await page.evaluate(({x,y}) => window.__GD_TEST__.tileAt(x,y), target)).toBe(-1);
});

test('online player can create and enter a named mine', async ({ page }) => {
  const mockClient = `
    window.__SUPABASE_CALLS = [];
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-0000-0000-000000000221', email: 'builder@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        rpc: async (name, args) => {
          window.__SUPABASE_CALLS.push({ name, args });
          if (name === 'golden_start') return { data: { gold: 150, lumen: 0, level: 1, pickaxe_level: 1, world_x: 180, world_y: 20 }, error: null };
          if (name === 'golden_world_list') return { data: [{ world_id: 'main', name: 'Verdant Haven', biome: 'verdant', owner: 'VELMORA', online: 1, capacity: 40 }], error: null };
          if (name === 'golden_world_create') return { data: { world_id: 'mine_abc123def456', name: args.p_name, biome: args.p_biome, seed: 4321 }, error: null };
          if (name === 'golden_world_join') return { data: { world_id: args.p_world_id, name: 'Moonlit Hollow', biome: 'frost', seed: 4321 }, error: null };
          return { data: { ok: true }, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: table === 'golden_player_state' ? { gold: 150, lumen: 0, level: 1, pickaxe_level: 1 } : null, error: null }); },
            then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
          };
          return query;
        },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel: async () => 'ok'
      })
    };
  `;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#lobby')).toBeVisible({ timeout: 8000 });
  await page.locator('#newWorldName').fill('Moonlit Hollow');
  await page.locator('#newWorldBiome').selectOption('frost');
  await page.locator('#createWorld').click();
  await expect(page.locator('#game')).toBeVisible();
  expect(await page.evaluate(() => window.__GD_TEST__.world())).toEqual({
    id: 'mine_abc123def456', name: 'Moonlit Hollow', biome: 'frost', seed: 43.21
  });
  const calls = await page.evaluate(() => window.__SUPABASE_CALLS);
  expect(calls.some(x => x.name === 'golden_world_create' && x.args.p_name === 'Moonlit Hollow' && x.args.p_biome === 'frost')).toBeTruthy();
  expect(calls.some(x => x.name === 'golden_world_join' && x.args.p_world_id === 'mine_abc123def456')).toBeTruthy();
});

test('touching and holding a block mines that exact block directly', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#play').click();
  await page.locator('#guest').click();
  await enterWorldFromLobby(page);
  const target = await page.evaluate(() => window.__GD_TEST__.findReachableBlock());
  expect(target).not.toBeNull();
  const before = await page.evaluate(() => window.__GD_TEST__.worldTiles());
  await holdMineBlock(page, 1500);
  await expect.poll(() => page.evaluate(() => window.__GD_TEST__.worldTiles())).toBeLessThan(before);
});


test('player market searches catalog items and buys an escrowed listing', async ({ page }) => {
  const mockClient = `
    window.__MARKET_CALLS = [];
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: '00000000-0000-4000-8000-000000000231', email: 'market@example.test' } } } }),
          signOut: async () => ({ error: null })
        },
        rpc: async (name, args) => {
          window.__MARKET_CALLS.push({ name, args });
          if (name === 'golden_start') return { data: { gold: 50000, lumen: 100, level: 1, pickaxe_level: 1, world_x: 180, world_y: 20 }, error: null };
          if (name === 'golden_world_list') return { data: [{ world_id: 'main', name: 'Verdant Haven', biome: 'verdant', owner: 'VELMORA', online: 1, capacity: 40 }], error: null };
          if (name === 'golden_world_join') return { data: { world_id: 'main', name: 'Verdant Haven', biome: 'verdant', seed: 920 }, error: null };
          return { data: { ok: true }, error: null };
        },
        from: (table) => {
          const query = {
            select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
            maybeSingle() { return Promise.resolve({ data: { gold: 50000, lumen: 100, level: 1, pickaxe_level: 1 }, error: null }); },
            then(resolve, reject) {
              let data = [];
              if (table === 'golden_inventory') data = [{ item_code: 'ore_chunk_moonstone_t09_luminous', quantity: 3, golden_item_catalog: { name: 'Ancient Moonstone Ore — Luminous', rarity: 'legendary', item_type: 'ore', metadata: { purpose: 'Bahan crafting langka' }, sell_value: 900 } }];
              if (table === 'golden_trade_offers') data = [{ id: '00000000-0000-4000-8000-000000000241', seller_id: '00000000-0000-4000-8000-000000000242', item_code: 'ore_chunk_moonstone_t09_luminous', quantity: 2, gold_price: 1800, created_at: new Date().toISOString(), golden_item_catalog: { name: 'Ancient Moonstone Ore — Luminous', item_type: 'ore', rarity: 'legendary', metadata: { purpose: 'Bahan crafting langka' } } }];
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
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockClient })
  );
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#lobby')).toBeVisible({ timeout: 8000 });
  await page.locator('#worldRoomList button').first().click();
  await expect(page.locator('#game')).toBeVisible();
  await page.locator('#tradeToggle').click();
  await expect(page.locator('#trade')).toBeVisible();
  await expect(page.locator('#tradeItem')).toContainText('Ancient Moonstone Ore');
  await expect(page.locator('#tradeList')).toContainText('Ancient Moonstone Ore — Luminous');
  await page.locator('#marketCategory').selectOption('ore');
  await page.locator('#marketSearch').fill('moonstone');
  await expect(page.locator('#marketSummary')).toContainText('1 penawaran');
  await page.locator('#tradeList button').filter({ hasText: 'BELI' }).click();
  await expect.poll(() => page.evaluate(() => window.__MARKET_CALLS.some(x => x.name === 'golden_trade_accept'))).toBeTruthy();
});
