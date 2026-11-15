import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('game/index.html', 'utf8');
const js = fs.readFileSync('game/game.js', 'utf8');
const css = fs.readFileSync('game/style.css', 'utf8');
const manifest = JSON.parse(fs.readFileSync('game/manifest.webmanifest', 'utf8'));
const itemAssets = fs.readFileSync('game/assets/items.svg', 'utf8');
const serviceWorker = fs.readFileSync('game/sw.js', 'utf8');
const workflow = fs.readFileSync('../.github/workflows/orbit-android.yml', 'utf8');
const releaseWorkflow = fs.readFileSync('../.github/workflows/orbit-release.yml', 'utf8');

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
assert.ok(!js.includes("localStorage.setItem('orbit_v2_profile',JSON.stringify({coins,equippedTool}))"), 'Player progression must never be saved locally');
assert.ok(js.includes('function load(){return false}'), 'Local world loading must be disabled');
assert.ok(js.includes('function switchLocalWorld(){toast('), 'Local world switching must be disabled');
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
assert.ok(serviceWorker.includes('orbit-shell-v23'), 'Service worker cache version must be refreshed');
assert.ok(js.includes("if(activeWorldId&&worldChannel&&onlineUser){lastPositionSyncKey='';ensureNearbyChunks().catch(()=>{});syncOnlinePosition();worldChannel.track("), 'Online world must resync position, nearby chunks and presence when the app resumes');
assert.ok(serviceWorker.includes('./audio.js'), 'Offline cache must include the game audio engine');
const audioEngine = fs.readFileSync('game/audio.js', 'utf8');
assert.ok(audioEngine.includes("if(!ac||!unlocked)return;if(document.hidden){") && audioEngine.includes('ac.suspend?.()') && audioEngine.includes('ac.resume?.();startMusic()'), 'Audio must pause in background and resume when the app returns');
assert.ok(html.includes('<script src="audio.js"></script>'), 'Audio engine must load before gameplay code');
for (const sound of ['break','place','collect','harvest','jump','notify','click']) assert.ok(audioEngine.includes("'" + sound + "'"), 'Missing audio event: ' + sound);
assert.ok(audioEngine.includes('function renderSettings(root)'), 'Separate music and effects settings are missing');
assert.ok(audioEngine.includes('musicOn') && audioEngine.includes('effectsOn'), 'Independent music/effects toggles are missing');
assert.ok(js.includes("window.ORBITAudio?.play('break')") && js.includes("window.ORBITAudio?.play('place')"), 'Mining and placement must trigger audio');
assert.ok(js.includes("window.ORBITAudio?.renderSettings($('#modal-content'))"), 'Settings panel must expose audio controls');
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
assert.ok(releaseWorkflow.includes('ANDROID_KEYSTORE_BASE64'), 'Production signing must use the owner-provided keystore secret');
assert.ok(releaseWorkflow.includes('ANDROID_KEYSTORE_PASSWORD') && releaseWorkflow.includes('ANDROID_KEY_ALIAS') && releaseWorkflow.includes('ANDROID_KEY_PASSWORD'), 'All production signing secrets must be validated');
assert.ok(releaseWorkflow.includes('assembleRelease bundleRelease'), 'Production workflow must build both signed APK and Play AAB');
assert.ok(releaseWorkflow.includes('apksigner') && releaseWorkflow.includes('jarsigner'), 'Production APK and AAB signatures must be verified');
assert.ok(releaseWorkflow.includes('workflow_dispatch:'), 'Production release must require an explicit manual dispatch');
assert.ok(!releaseWorkflow.includes('keytool -genkeypair'), 'Production release must not silently generate a new signing identity');

console.log('ORBIT smoke checks passed: UI shell, backpack sheet, online gameplay hooks, landscape and fullscreen build config.');

assert.ok(js.includes('const placeableItems=catalog.filter'), 'Hotbar must only expose items supported by the placement system');
assert.ok(js.includes('const tile=placeableItems[selected]'), 'Offline placement must resolve the selected hotbar item safely');
assert.ok(js.includes("items=['grass_block','soil_block','slate_block'];if(selected<0||selected>=items.length)"), 'Online placement must reject unsupported hotbar items safely');
assert.ok(js.includes('function spawnBlockParticles(') && js.includes('function drawParticles(dt)'), 'Mining and placement particle effects are missing');
assert.ok(js.includes('drawMiningProgress();drawParticles(dt)'), 'World loop must render and update item effects');
assert.ok(js.includes('inventory-detail') && js.includes("d.onclick=()=>{describe(it)"), 'Inventory item details and selection actions are missing');

assert.ok(js.includes("if(document.hidden){clearControls();if(!activeWorldId)save(false);return}"), 'Offline world progress must save immediately when the app is backgrounded');

assert.ok(js.includes("addEventListener('offline',()=>{clearControls();onlineConnectionReady=false;"), 'Network loss must pause gameplay and disable online readiness');
assert.ok(js.includes("addEventListener('online',()=>{if(!activeWorldId||!onlineUser||!sb)return;"), 'Online world must rejoin server after network recovery');

assert.ok(js.includes('onlineConnectionReady=false') && js.includes('if(!onlineConnectionReady||!activeWorldId||!navigator.onLine)'), 'Gameplay must remain locked until a live server channel is connected');
assert.ok(js.includes('ORBIT hanya dapat dimainkan secara online'), 'Disconnected state must clearly communicate online-only gameplay');
assert.ok(js.includes('function save(showToast=false){if(showToast)toast(\'Progres ORBIT disimpan otomatis oleh server saat online\')}'), 'Local save must be disabled');
assert.ok(!js.includes(\"toast('Mode offline aktif\"), 'No offline-mode messaging or fallback may remain');
