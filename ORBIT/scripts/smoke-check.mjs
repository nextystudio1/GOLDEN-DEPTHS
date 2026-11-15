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
assert.ok(js.includes("refreshWorldList(content)}else if(name==='social')"), 'World Gate must render only server-backed worlds');
assert.ok(js.includes("const oldOpenPanel=openPanel;openPanel=function(name){if(name!=='worlds'&&name!=='social'&&name!=='market')return oldOpenPanel(name);"), 'Live menu dispatcher must route online panels through their feature handlers');
assert.ok(js.includes("if(name==='social'){authPanel();return}"), 'Active Social Hub route must render account and multiplayer controls');
assert.ok(js.includes("if(name==='market'){title.textContent='🏪 ORBIT Market';refreshMarketPanel(content);return}"), 'Active Market route must render player listings and transactions');
assert.ok(js.includes("title.textContent='🌍 World Gate';refreshWorldList(content)"), 'Active World Gate route must load public online worlds');
assert.ok(js.includes("Login dan pilih dunia online untuk mulai bermain. Progres disimpan di server."), 'Signed-in World Gate must explain online-only play');
assert.ok(js.includes("const {error}=await sb.auth.signInWithPassword"), 'Manual sign-in action must remain available');
assert.ok(!js.includes('Dunia lokal tersimpan di perangkat.') && !js.includes('switchLocalWorld'), 'World Gate must not advertise or switch to local worlds');
assert.ok(!js.includes('Multiplayer online sedang dikembangkan.'), 'World Gate must not claim the online mode is still being developed');
assert.ok(js.includes('remoteData?.display_name'), 'Remote player name labels are missing');
assert.ok(js.includes('function refreshSocialPlayerList()') && js.includes('refreshSocialPlayerList()})'), 'Online player list must refresh live from realtime presence updates');
assert.ok(js.includes("request.onclick=()=>requestTradeWithPlayer(p.user_id)"), 'Social player list must use the shared server-authoritative trade action');
assert.ok(js.includes("const tappedPlayer=tool==='mine'?remotePlayers.find(") && js.includes('requestTradeWithPlayer(tappedPlayer.user_id)'), 'Tapping another player in the world must open a server-authoritative trade request');
assert.ok(js.includes("async function requestTradeWithPlayer(userId){if(!onlineConnectionReady||!activeWorldId||!onlineUser||!sb||!userId||userId===onlineUser.id)return;"), 'Direct player trade must require a live online world session');
assert.ok(js.includes('function rectBlocked('), 'Player collision must check the full hitbox');
assert.ok(!js.includes("localStorage.setItem('orbit_v2_profile',JSON.stringify({coins,equippedTool}))"), 'Player progression must never be saved locally');
assert.ok(js.includes('function load(){return false}'), 'Local world loading must be disabled');
assert.ok(!js.includes('switchLocalWorld'), 'Local world switching must be absent');
assert.ok(js.includes('function save(showToast=false)'), 'Background saves must not spam toast notifications');
assert.ok(js.includes("function save(showToast=false){if(showToast)toast('Progres ORBIT disimpan otomatis oleh server saat online')}"), 'Manual save must not create a local save path');
assert.ok(js.includes("const uiPaused=!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine||!$('#modal').classList.contains('hidden')"), 'Gameplay must pause unless online and while menus or app background are active');
assert.ok(js.includes('addEventListener(\'blur\',clearControls)'), 'Controls must reset when the app loses focus');
assert.ok(js.includes("document.addEventListener('visibilitychange'"), 'Controls must reset when app is backgrounded');
assert.ok(js.includes("positionTimer=setInterval(()=>{if(!document.hidden&&worldChannel&&onlineUser)syncOnlinePosition()},1000)"), 'Online position sync must pause in background and avoid excessive polling');
assert.ok(js.includes("if(key===lastPositionSyncKey)return true"), 'Online position sync must skip unchanged player tiles');
assert.ok(js.includes("if(!document.hidden&&worldChannel&&onlineUser)"), 'Realtime presence must pause while the app is backgrounded');
assert.ok(js.includes("last_world_id,pos_x,pos_y"), 'Online player resume data must be loaded from the profile');
assert.ok(js.includes('pointerTarget.clientX-r.left+cameraX'), 'Mining target must follow pointer movement');
assert.ok(js.includes('ty=player.y+player.h+T*.45;mineAt(tx,ty,dt*16.67)'), 'Dedicated mine button must target the block at the player\'s feet, not empty air above the ground');
assert.ok(js.includes("sb.rpc('orbit_plant_seed'"), 'Crop planting must use the online server RPC');
assert.ok(js.includes("m.includes('INVENTORY_LIMIT')"), 'Mining must explain a full inventory instead of exposing a raw server error');
assert.ok(js.includes("m.includes('TILE_OCCUPIED')") && js.includes("m.includes('NOT_ENOUGH_ITEMS')"), 'Placement must explain occupied targets and missing block stacks');
assert.ok(js.includes("onlineSavedPosition?.world_id===w.id"), 'Online world resume must restore the server position');
assert.ok(js.includes("remoteData?.animation==='walk'"), 'Remote avatar movement state is missing');
assert.ok(js.includes('p.x*T-player.w/2-cameraX'), 'Remote avatar horizontal alignment is incorrect');
assert.ok(js.includes('Tidak bisa memasang blok di tubuh pemain'), 'Online placement must prevent trapping the player');
assert.ok(!js.includes("localStorage.setItem('orbit_v2_world_'"), 'World maps must never be saved locally');
assert.ok(!js.includes('}\\nfunction rectBlocked('), 'Collision helper contains a literal escaped newline');
assert.ok(js.includes('ctx.globalAlpha=Math.min(.82,p+.12)'), 'Progressive block damage feedback is missing');
assert.ok(js.includes("assets/items.svg#'+id"), 'Vector item icon renderer is missing');
assert.ok(js.includes('builtInItemIcons.has(id)') && js.includes("getItem(id)?.icon||'📦'"), 'New server catalog items must display a category icon when no vector asset exists');
assert.ok(js.includes("catalog.filter(it=>it.category==='tool'") && js.includes("it.serverId==='starter_pickaxe'"), 'Equipment picker must discover owned tools from the server catalog instead of a fixed list');
for (const tileId of [9,10,11,12]) assert.ok(js.includes(tileId+':'), 'Missing renderer or mining timing for crafted block tile '+tileId);
assert.ok(js.includes("sb.rpc('orbit_list_crafting_recipes'") && js.includes('recipe.ingredients') && js.includes('recipe.output_name'), 'Workshop recipes must load dynamically from server data');
assert.ok(js.includes('it.placeable===true'), 'Inventory must describe all server placeable items');
for (const item of ['grass','dirt','stone','copper','crystal','wood','seed','pickaxe','stonepick','crystalpick']) {
  assert.ok(itemAssets.includes('id="' + item + '"'), 'Missing original item artwork: ' + item);
}
assert.ok(!serviceWorker.includes('caches.open(CACHE)') && serviceWorker.includes('fetch(event.request)'), 'Service worker must never cache game content for offline play');
assert.ok(html.includes('getRegistrations()') && html.includes('unregister()'), 'Existing offline service workers must be removed');
assert.ok(js.includes("if(activeWorldId&&worldChannel&&onlineUser){lastPositionSyncKey='';ensureNearbyChunks().catch(()=>{});syncOnlinePosition();worldChannel.track("), 'Online world must resync position, nearby chunks and presence when the app resumes');
assert.ok(js.includes('async function reconnectActiveWorld(){if(worldReconnectPending||!activeWorldId||!onlineUser||!sb||!navigator.onLine)return;'), 'Reconnect must be single-flight and require an authenticated online session');
assert.ok(js.includes("addEventListener('online',()=>{reconnectActiveWorld()});") && js.includes('(!worldChannel||!onlineConnectionReady)){reconnectActiveWorld();return}'), 'Network recovery and app resume must use the same reconnect path');
assert.ok(!serviceWorker.includes('caches.match(event.request)'), 'Service worker must not provide cached offline fallbacks');
const audioEngine = fs.readFileSync('game/audio.js', 'utf8');
assert.ok(audioEngine.includes("if(!ac||!unlocked)return;if(document.hidden){") && audioEngine.includes('ac.suspend?.()') && audioEngine.includes('ac.resume?.();startMusic()'), 'Audio must pause in background and resume when the app returns');
assert.ok(html.includes('<script src="audio.js"></script>'), 'Audio engine must load before gameplay code');
for (const sound of ['break','place','collect','harvest','jump','notify','click']) assert.ok(audioEngine.includes("'" + sound + "'"), 'Missing audio event: ' + sound);
assert.ok(audioEngine.includes('function renderSettings(root)'), 'Separate music and effects settings are missing');
assert.ok(audioEngine.includes('function noiseBurst(') && audioEngine.includes('function kick(') && audioEngine.includes('musicTimer=setInterval(musicStep,300)'), 'Original soundtrack must include layered percussion and a longer rhythmic loop');
assert.ok(audioEngine.includes("noiseBurst(.07,.035,0,900,'lowpass',effectGain)"), 'Mining impact noise must use the independent effects bus');
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
assert.ok(js.includes("placeAt=function(px,py){if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine||onlineActionBusy)return;"), 'Block placement must require an active online session');
assert.ok(js.includes("item=placeableItems[selected],itemId=item?.serverId") && js.includes("if(!itemId){toast('Pilih blok yang bisa dipasang');return}"), 'Online placement must validate the selected server catalog item safely');
assert.ok(js.includes('function spawnBlockParticles(') && js.includes('function drawParticles(dt)'), 'Mining and placement particle effects are missing');
assert.ok(js.includes('drawMiningProgress();drawParticles(dt)'), 'World loop must render and update item effects');
assert.ok(js.includes('inventory-detail') && js.includes('d.onclick=()=>{') && js.includes('describe(it)'), 'Inventory item details and selection actions are missing');

assert.ok(js.includes("if(document.hidden){clearControls();if(!activeWorldId)save(false);return}"), 'Backgrounding must clear controls; local save is a no-op');

assert.ok(js.includes("addEventListener('offline',()=>{clearControls();onlineConnectionReady=false;"), 'Network loss must pause gameplay and disable online readiness');
assert.ok(js.includes("addEventListener('online',()=>{reconnectActiveWorld()});") && js.includes('async function reconnectActiveWorld(){if(worldReconnectPending||!activeWorldId||!onlineUser||!sb||!navigator.onLine)return;'), 'Online world must rejoin server after network recovery through the guarded reconnect path');

assert.ok(js.includes('onlineConnectionReady=false') && js.includes('if(!onlineConnectionReady||!activeWorldId||!navigator.onLine)'), 'Gameplay must remain locked until a live server channel is connected');
assert.ok(js.includes('ORBIT hanya dapat dimainkan secara online'), 'Disconnected state must clearly communicate online-only gameplay');
assert.ok(js.includes('function save(showToast=false){if(showToast)toast(\'Progres ORBIT disimpan otomatis oleh server saat online\')}'), 'Local save must be disabled');
assert.ok(!js.includes("toast('Mode offline aktif"), 'No offline-mode messaging or fallback may remain');

assert.ok(js.includes('if(onlineUser?.id!==nextUser?.id){') && js.includes("$('#world-name').textContent=nextUser?'WORLD GATE':'LOGIN'"), 'Authentication changes must never switch into a local world');

assert.ok(html.includes('caches.delete(key)') && html.includes('key.startsWith(\"orbit-shell-\")'), 'Legacy offline game caches must be deleted on launch');

assert.ok(js.includes("if(!(await loadProfile())){activeWorldId=null;toast('Profil server belum siap."), 'World entry must fail closed if the server profile is unavailable');
assert.ok(js.includes('return results.every(Boolean)}return true}'), 'World entry must fail closed if any required server chunk fails to load');
assert.ok(js.includes("if(!(await syncOnlineInventory())){activeWorldId=null;toast('Inventaris server gagal dimuat."), 'World entry must require inventory data from the server');
assert.ok(/async function syncOnlineInventory\(\)\{\s*if\(!sb\|\|!onlineUser\)return false;/.test(js), 'Inventory sync must report server failure instead of allowing local play');
assert.ok(js.includes("if(!document.hidden&&!(await syncOnlinePosition())){activeWorldId=null;toast('Posisi pemain gagal disimpan ke server."), 'World reconnect must not fail just because the app is backgrounded; resume handler will sync position');
assert.ok(js.includes("(!worldChannel||!onlineConnectionReady)"), 'App resume must recover a stale realtime channel, not only a missing channel');
assert.ok(js.includes('worldReconnectPending=false'), 'World reconnect must guard against duplicate resume attempts');
assert.ok(js.includes("status==='CHANNEL_ERROR'||status==='TIMED_OUT'){onlineConnectionReady=false;if(presenceTimer)"), 'Realtime channel failure must stop stale presence and position timers');

assert.ok(!js.includes('localPlants') && !js.includes('worlds=[]'), 'No local crop or world state may remain');
assert.ok(!js.includes('oldMineAt') && !js.includes('oldPlaceAt'), 'Mining and placement must not fall back to local handlers');
assert.ok(js.includes("if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine){toast('Koneksi server diperlukan untuk crafting')"), 'Crafting must require an active online connection');
assert.ok(js.includes("sb.rpc('orbit_list_crafting_recipes'") && js.includes('recipe.ingredients') && js.includes('recipe.output_name'), 'Workshop must load recipe definitions dynamically from the server');
assert.ok(js.includes("if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine){toast('Koneksi server diperlukan untuk menanam')"), 'Planting must require an active online connection');

assert.ok(js.includes("sb.from('item_catalog').select('item_id,display_name,category,rarity,stack_limit,is_placeable,is_tradeable,item_data')"), 'Backpack must load item definitions from the server catalog');
assert.ok(js.includes('serverId:row.item_id') && js.includes('catalog.push(item)'), 'Server catalog metadata must be attached to both known and newly discovered items');
assert.ok(js.includes('placeableItems.splice(0,placeableItems.length') && js.includes('item.placeable===true'), 'Hotbar placeable items must refresh from authoritative server catalog metadata');
assert.ok(js.includes('p_item_id:itemId'), 'Placement must send the selected catalog item ID to the server');
assert.ok(js.includes("meta['用途']==='crafting'") && js.includes("meta.tool==='pickaxe'"), 'Item details must explain crafting and tool functions from server metadata');
assert.ok(js.includes("const key=mapIds[row.item_id]||row.item_id;inv[key]=row.quantity"), 'Inventory sync must retain newly added server item IDs');
assert.ok(js.includes(".in('item_id',ids)"), 'Inventory sync must fetch only definitions for owned and starter items');
assert.ok(js.includes(".ilike('display_name'") && js.includes('.limit(40)'), 'Large item catalogs must be searched server-side with a bounded result page');
assert.ok(js.includes('validPlaceableTiles=[1,2,3,9,10,11,12]') && js.includes('validPlaceableTiles.includes(item.tile)'), 'All supported crafted block types must be selectable from the hotbar');
assert.ok(js.includes('catalog.filter(it=>(inv[it.id]||0)>0)'), 'Backpack must render owned items only, not the full global catalog');
