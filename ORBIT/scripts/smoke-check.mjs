import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('game/index.html', 'utf8');
const js = fs.readFileSync('game/game.js', 'utf8');
const css = fs.readFileSync('game/style.css', 'utf8');
const manifest = JSON.parse(fs.readFileSync('game/manifest.webmanifest', 'utf8'));
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
assert.equal(manifest.orientation, 'landscape', 'Game must request landscape orientation');
assert.equal(manifest.display, 'fullscreen', 'Web app must request fullscreen display');
assert.ok(workflow.includes('ORBIT_IMMERSIVE_FULLSCREEN'), 'Android immersive fullscreen patch is missing');
assert.ok(workflow.includes('assembleDebug'), 'Android debug build task is missing');

console.log('ORBIT smoke checks passed: UI shell, backpack sheet, online gameplay hooks, landscape and fullscreen build config.');
