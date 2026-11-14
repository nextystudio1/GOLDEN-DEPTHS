import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('game/index.html', 'utf8');
const js = fs.readFileSync('game/game.js', 'utf8');
const css = fs.readFileSync('game/style.css', 'utf8');
const manifest = JSON.parse(fs.readFileSync('game/manifest.webmanifest', 'utf8'));
const itemAssets = fs.readFileSync('game/assets/items.svg', 'utf8');
const serviceWorker = fs.readFileSync('game/sw.js', 'utf8');
const workflow = fs.readFileSync('../.github/workflows/orbit-android.yml', 'utf8');

const requiredIds = [
  'game-shell', 'menu-button', 'side-menu', 'drawer-scrim',
  'drawer-close', 'modal', 'modal-panel', 'sheet-grabber',
  'modal-content', 'hotbar', 'left', 'right', 'jump', 'mine', 'place',
  'world-name', 'level', 'xp', 'toast', 'coords'
];
for (const id of requiredIds) {
  assert.ok(html.includes('id="' + id + '"') || html.includes("id='" + id + "'"), 'Missing HTML element #' + id);
}
for (const selector of [
  '#game-shell', '.topbar', '.viewport', '.game-controls',
  '.side-menu', '.drawer-panel', '#modal.inventory-mode',
  '#modal.inventory-mode.sheet-expanded'
]) {
  assert.ok(css.includes(selector), 'Missing UI style: ' + selector);
assert.ok(css.includes('#game-shell{') && css.includes('display:block') && css.includes('overflow:hidden'), 'Full-bleed game shell is missing');
assert.ok(css.includes('.viewport{position:absolute;inset:0'), 'World canvas must cover the full screen');
assert.ok(css.includes('.game-controls{') && css.includes('position:absolute'), 'Touch controls must overlay the world');
}
for (const feature of [
  'orbit_create_world', 'orbit_join_world', 'orbit_mine_tile',
  'orbit_place_tile', 'orbit_send_chat_message', 'orbit_create_listing',
  'orbit_buy_listing', 'orbit_create_trade', 'orbit_accept_trade',
  'orbit_claim_chunk', 'orbit_release_chunk', 'orbit_craft_item',
  'orbit_plant_seed', 'orbit_harvest_crop'
]) {
  assert.ok(js.includes(feature), 'Missing online gameplay integration: ' + feature);
}
assert.ok(js.includes('sheetHandle.addEventListener'), 'Backpack drag gesture is missing');
assert.ok(js.includes('loadOnlineSdk'), 'Online SDK loader is missing');
assert.ok(js.includes('remoteData?.display_name'), 'Remote player name labels are missing');
assert.ok(js.includes('function rectBlocked('), 'Player collision must check the full hitbox');
assert.ok(js.includes('pointerTarget.clientX-r.left+cameraX'), 'Mining target must follow pointer movement');
assert.ok(js.includes("localPlants[tx+','+ty]"), 'Offline crop growth state must be tracked');
assert.ok(js.includes("onlineSavedPosition?.world_id===w.id"), 'Online world resume must restore the server position');
assert.ok(js.includes("remoteData?.animation==='walk'"), 'Remote avatar movement state is missing');
assert.ok(js.includes("if(!activeWorldId){localStorage.setItem('orbit_v2_world_'"), 'Online worlds must not overwrite local saves');
assert.ok(!js.includes('}\\nfunction rectBlocked('), 'Collision helper contains a literal escaped newline');
assert.ok(js.includes('ctx.globalAlpha=Math.min(.82,p+.12)'), 'Progressive block damage feedback is missing');
assert.ok(js.includes("assets/items.svg#'+id"), 'Vector item icon renderer is missing');
for (const item of ['grass','dirt','stone','copper','crystal','wood','seed','pickaxe','stonepick','crystalpick']) {
  assert.ok(itemAssets.includes('id="' + item + '"'), 'Missing original item artwork: ' + item);
}
assert.ok(serviceWorker.includes('./assets/items.svg'), 'Offline cache must include item artwork');
assert.ok(serviceWorker.includes('orbit-shell-v10'), 'Service worker cache version must be refreshed');
const tileRenderer = js.slice(js.indexOf('function drawTile('), js.indexOf('function drawMiningProgress()'));
const avatarRenderer = js.slice(js.indexOf('function drawPlayer('), js.indexOf('function frame(ts)'));
assert.ok(tileRenderer.includes('shape') === false && tileRenderer.includes('tileSpriteCache'), 'Pixel tile renderer is missing');
assert.ok(tileRenderer.includes('g.fillRect') && !tileRenderer.includes('createLinearGradient'), 'Tile art should use crisp pixel shapes');
assert.ok(avatarRenderer.includes('function drawPlayer') && avatarRenderer.includes('ctx.fillRect'), 'Pixel avatar renderer is missing');
assert.ok(css.includes('crisp edges') || css.includes('crisp pixel sandbox styling') || css.includes('shape-rendering:crispEdges'), 'Pixel-style UI is missing');
assert.equal(manifest.orientation, 'landscape', 'Game must request landscape orientation');
assert.equal(manifest.display, 'fullscreen', 'Web app must request fullscreen display');
assert.ok(workflow.includes('ORBIT_IMMERSIVE_FULLSCREEN'), 'Android immersive fullscreen patch is missing');
assert.ok(workflow.includes('assembleDebug'), 'Android debug build task is missing');

console.log('ORBIT smoke checks passed: UI shell, backpack sheet, online gameplay hooks, landscape and fullscreen build config.');
