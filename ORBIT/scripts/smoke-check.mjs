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
assert.ok(js.includes("else{toast('Login berhasil');openPanel('social')}};"), 'Successful login must return to Social Hub and never auto-open World Gate');
assert.ok(js.includes("else if(name==='social'){authPanel()}"), 'Social Hub must render real account, login, chat, claims and trade controls instead of a placeholder');
assert.ok(js.includes("if(sb&&onlineUser)refreshWorldList(content)"), 'World Gate must load online worlds and the create-world action for signed-in players');
assert.ok(js.includes("const oldOpenPanel=openPanel;openPanel=function(name){if(name!=='worlds'&&name!=='social'&&name!=='market')return oldOpenPanel(name);"), 'Live menu dispatcher must route online panels through their feature handlers');
assert.ok(js.includes("if(name==='social'){authPanel();return}"), 'Active Social Hub route must render account and multiplayer controls');
assert.ok(js.includes("if(name==='market'){title.textContent='🏪 ORBIT Market';refreshMarketPanel(content);return}"), 'Active Market route must render player listings and transactions');
assert.ok(js.includes("title.textContent='🌍 World Gate';refreshWorldList(content)"), 'Active World Gate route must load public online worlds');
assert.ok(js.includes("Pilih dunia lokal atau bergabung ke dunia online."), 'Signed-in World Gate must show accurate online-world guidance');
assert.ok(js.includes("const {error}=await sb.auth.signInWithPassword"), 'Manual sign-in action must remain available');
assert.ok(js.includes('Login melalui Social Hub untuk melihat dan bergabung ke dunia online.'), 'World Gate must distinguish local worlds from available online worlds');
assert.ok(!js.includes('Multiplayer online sedang dikembangkan.'), 'World Gate must not claim the online mode is still being developed');
assert.ok(js.includes('remoteData?.display_name'), 'Remote player name labels are missing');
assert.ok(js.includes('function rectBlocked('), 'Player collision must check the full hitbox');
assert.ok(js.includes("localStorage.setItem('orbit_v2_profile',JSON.stringify({coins,equippedTool}))"), 'Offline player progression must persist across worlds');
assert.ok(js.includes("inv=sharedInv&&typeof sharedInv==='object'?sharedInv:(saved.inv||{})"), 'Saved offline worlds must load shared player inventory');
assert.ok(js.includes("if(sharedInv&&typeof sharedInv==='object')inv=sharedInv"), 'New offline worlds must inherit the shared player inventory');
assert.ok(js.includes('function save(showToast=false)'), 'Background saves must not spam toast notifications');
assert.ok(js.includes('b.onclick=()=>save(true)'), 'Manual save must still confirm success');
assert.ok(js.includes("const uiPaused=!$('#modal').classList.contains('hidden')||!sideMenu.classList.contains('hidden')||document.hidden"), 'Gameplay must pause while menus or app background are active');
assert.ok(js.includes('addEventListener(\'blur\',clearControls)'), 'Controls must reset when the app loses focus');
assert.ok(js.includes("document.addEventListener('visibilitychange'"), 'Controls must reset when app is backgrounded');
assert.ok(js.includes("positionTimer=setInterval(()=>{if(!document.hidden&&worldChannel&&onlineUser)syncOnlinePosition()},1000)"), 'Online position sync must pause in background and avoid excessive polling');
assert.ok(js.includes("if(key===lastPositionSyncKey)return true"), 'Online position sync must skip unchanged player tiles');
assert.ok(js.includes("if(!document.hidden&&worldChannel&&onlineUser)"), 'Realtime presence must pause while the app is backgrounded');
assert.ok(js.includes("last_world_id,pos_x,pos_y"), 'Online player resume data must be loaded from the profile');
assert.ok(js.includes('pointerTarget.clientX-r.left+cameraX'), 'Mining target must follow pointer movement');
assert.ok(js.includes('ty=player.y+player.h+T*.45;mineAt(tx,ty,dt*16.67)'), 'Dedicated mine button must target the block at the player\'s feet, not empty air above the ground');
assert.ok(js.includes("localPlants[tx+','+ty]"), 'Offline crop growth state must be tracked');
assert.ok(js.includes("onlineSavedPosition?.world_id===w.id"), 'Online world resume must restore the server position');
assert.ok(js.includes("remoteData?.animation==='walk'"), 'Remote avatar movement state is missing');
assert.ok(js.includes('p.x*T-player.w/2-cameraX'), 'Remote avatar horizontal alignment is incorrect');
assert.ok(js.includes('Tidak bisa memasang blok di tubuh pemain'), 'Online placement must prevent trapping the player');
assert.ok(js.includes("if(!activeWorldId){localStorage.setItem('orbit_v2_world_'"), 'Online worlds must not overwrite local saves');
assert.ok(!js.includes('}\\nfunction rectBlocked('), 'Collision helper contains a literal escaped newline');
assert.ok(js.includes('ctx.globalAlpha=Math.min(.82,p+.12)'), 'Progressive block damage feedback is missing');
assert.ok(js.includes("assets/items.svg#'+id"), 'Vector item icon renderer is missing');
for (const item of ['grass','dirt','stone','copper','crystal','wood','seed','pickaxe','stonepick','crystalpick']) {
  assert.ok(itemAssets.includes('id="' + item + '"'), 'Missing original item artwork: ' + item);
}
assert.ok(serviceWorker.includes('./assets/items.svg'), 'Offline cache must include item artwork');
assert.ok(serviceWorker.includes('orbit-shell-v21'), 'Service worker cache version must be refreshed');
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
