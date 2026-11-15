(()=>{'use strict';
const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d'),T=24,WW=220,WH=90;
const catalog=[
{id:'grass',name:'Grass Block',icon:'🟩',tile:1,stack:999,desc:'Blok permukaan yang subur.'},
{id:'dirt',name:'Soft Soil',icon:'🟫',tile:2,stack:999,desc:'Tanah dasar untuk membangun.'},
{id:'stone',name:'Slate Stone',icon:'⬛',tile:3,stack:999,desc:'Batu kuat untuk konstruksi.'},
{id:'copper',name:'Copper Ore',icon:'🟠',tile:4,stack:999,desc:'Bijih tembaga untuk crafting.'},
{id:'crystal',name:'Sky Crystal',icon:'💎',tile:5,stack:999,desc:'Kristal bercahaya yang langka.'},
{id:'wood',name:'Amber Wood',icon:'🪵',tile:6,stack:999,desc:'Kayu dari pohon amber.'},
{id:'seed',name:'Glow Seed',icon:'🌱',tile:0,stack:99,desc:'Benih tanaman bercahaya.'},
{id:'pickaxe',name:'Copper Pickaxe',icon:'⛏️',tile:0,stack:1,desc:'Pickaxe tembaga, lebih cepat dari alat awal.'},
{id:'stonepick',name:'Stone Pickaxe',icon:'🪨',tile:0,stack:1,desc:'Pickaxe batu untuk tahap awal.'},
{id:'crystalpick',name:'Crystal Pickaxe',icon:'💠',tile:0,stack:1,desc:'Pickaxe kristal dengan kecepatan tinggi.'}
];
const builtInItemIcons=new Set(['grass','dirt','stone','copper','crystal','wood','seed','pickaxe','stonepick','crystalpick']);
const placeableItems=catalog.filter(item=>item.placeable===true || ['grass','dirt','stone'].includes(item.id));
const particles=[];
const readJSON=()=>null;
let map=Array.from({length:WH},()=>Array(WW).fill(0)),inv={},selected=0,tool='mine',cameraX=0,cameraY=0,screenW=1,screenH=1,last=0,toastTimer=0,coins=0;
const player={x:100,y:100,vx:0,vy:0,w:17,h:27,ground:false,face:1};const input={left:false,right:false,jump:false,mine:false};
let miningState={key:'',progress:0,tx:-1,ty:-1};
let equippedTool='starter_pickaxe';function mineDuration(tile){const base=({1:420,2:300,3:850,4:1150,5:1500,6:520,7:180,8:180,9:520,10:780,11:1100,12:650})[tile]||650;const factor=({starter_pickaxe:1,stone_pickaxe:.88,copper_pickaxe:.72,crystal_pickaxe:.52})[equippedTool]||1;return Math.ceil(base*factor)}
function advanceMining(tx,ty,delta){const tile=map[ty]?.[tx];if(!tile)return false;const key=tx+','+ty;if(miningState.key!==key)miningState={key,progress:0,tx,ty};miningState.progress=Math.min(mineDuration(tile),miningState.progress+Math.max(0,delta));return miningState.progress>=mineDuration(tile)}
function resetMining(){miningState={key:'',progress:0,tx:-1,ty:-1}}let activeWorld='ONLINE',activeBiome='verdant';
function rand(n){let v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)}
function generate(){
 let worldKey=0;for(let i=0;i<activeWorld.length;i++)worldKey=(worldKey*31+activeWorld.charCodeAt(i))>>>0;
 const worldRand=n=>rand(n+worldKey*.013);
 map=Array.from({length:WH},()=>Array(WW).fill(0));
 const surfaceAt=x=>24+Math.floor(Math.sin(x*.075)*2.5+Math.sin(x*.021)*4+Math.sin(x*.19)*.8+worldRand(x*3.1)*1.6);
 for(let x=0;x<WW;x++){
  const surface=surfaceAt(x);
  for(let y=surface;y<WH;y++){
   const depth=y-surface, r=worldRand(x*97+y*53);
   map[y][x]=depth===0?1:depth<5?2:depth<10?(r>.08?3:2):3;
  }
 }
 // Ruang gua dan lorong bawah tanah dibentuk dari seed dunia yang stabil.
 for(let n=0;n<42;n++){
  const cx=9+Math.floor(worldRand(n*31+4)*(WW-18)), cy=34+Math.floor(worldRand(n*47+9)*48);
  const rx=2+Math.floor(worldRand(n*13+2)*5), ry=1+Math.floor(worldRand(n*19+6)*3);
  for(let y=Math.max(2,cy-ry);y<Math.min(WH-2,cy+ry+1);y++)
   for(let x=Math.max(2,cx-rx);x<Math.min(WW-2,cx+rx+1);x++){
    const surface=surfaceAt(x), dx=(x-cx)/rx,dy=(y-cy)/ry;
    if(y>surface+7&&dx*dx+dy*dy<1&&worldRand(n*991+x*17+y*29)>.06)map[y][x]=0;
   }
 }
 // Kantong bijih mengikuti kedalaman, dengan variasi ukuran.
 for(let n=0;n<105;n++){
  const x=4+Math.floor(worldRand(n*71+3)*(WW-8)), y=surfaceAt(x)+8+Math.floor(worldRand(n*83+7)*55);
  const ore=y>surfaceAt(x)+38&&worldRand(n*101)>.72?5:4;
  const radius=1+Math.floor(worldRand(n*37+11)*2);
  for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
   const tx=x+ox,ty=y+oy;
   if(map[ty]?.[tx]===3&&(ox*ox+oy*oy)<=radius*radius+1&&worldRand(n*131+tx*19+ty*23)>.18)map[ty][tx]=ore;
  }
 }
 // Pepohonan dengan tajuk bervariasi; tidak menutup jalur spawn.
 for(let x=10;x<WW-8;){
  const y=surfaceAt(x);
  if(x>15&&worldRand(x*3)>.31){
   const height=3+Math.floor(worldRand(x*5+2)*3);
   for(let dy=1;dy<=height;dy++)if(y-dy>=1)map[y-dy][x]=6;
   const crownY=y-height;
   for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=1;dy++){
    const tx=x+dx,ty=crownY+dy;
    if(Math.abs(dx)+Math.abs(dy)*.8<3.5&&map[ty]?.[tx]===0)map[ty][tx]=7;
   }
  }
  x+=6+Math.floor(worldRand(x*11+1)*8);
 }
}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);screenW=r.width;screenH=r.height;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0)}addEventListener('resize',resize);resize();
function toast(t){window.ORBITAudio?.play('notify');const e=$('#toast');e.textContent=t;e.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.style.opacity=0,1500)}
function save(showToast=false){if(showToast)toast('Progres ORBIT disimpan otomatis oleh server saat online')}
function load(){return false}
function setSpawn(){const tx=Math.max(0,Math.min(WW-1,Math.floor((player.x+player.w/2)/T)));const surface=map.findIndex(row=>row[tx]===1);if(surface>0){player.y=surface*T-player.h;player.vy=0;player.ground=false}}
function getItem(id){return catalog.find(x=>x.id===id)}
function makeItemIcon(id,itemOverride=null){if(!builtInItemIcons.has(id)){const item=itemOverride||getItem(id);const fallback=document.createElement('span');fallback.className='item-icon-fallback';fallback.textContent=item?.icon||'📦';fallback.setAttribute('aria-label',item?.name||'Item');return fallback}const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('class','item-icon-svg');svg.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','assets/items.svg#'+id);svg.append(use);return svg}
function addItem(id,n=1){window.ORBITAudio?.play('collect');const item=getItem(id),limit=item?.stack||999,current=inv[id]||0;if(!Number.isInteger(n)||n<1||current+n>limit){toast('Inventaris penuh');return false}inv[id]=current+n;renderHotbar();if(!$('#modal').classList.contains('hidden')&&$('#modal').classList.contains('inventory-mode'))renderInventory();return true}
function renderHotbar(){const bar=$('#hotbar');bar.replaceChildren();placeableItems.forEach((it,i)=>{let b=document.createElement('button');b.className='slot'+(i===selected?' selected':'');b.title=it.name;b.append(makeItemIcon(it.id));let s=document.createElement('small');s.textContent=inv[it.id]||0;b.append(s);b.onclick=()=>{selected=i;renderHotbar()};bar.append(b)})}
const serverItemMap={grass_block:'grass',soil_block:'dirt',slate_block:'stone',copper_ore:'copper',sky_crystal:'crystal',amber_wood:'wood',glow_seed:'seed',copper_pickaxe:'pickaxe',stone_pickaxe:'stonepick',crystal_pickaxe:'crystalpick'};
const categoryIcons={block:'🧱',resource:'🪨',seed:'🌱',tool:'🛠️',material:'🧰',consumable:'🧪',pet:'🐾',furniture:'🪑',decoration:'✨'};
const validPlaceableTiles=[1,2,3,9,10,11,12];
function mergeCatalogRow(row,keep=true){
 const key=serverItemMap[row.item_id]||row.item_id,meta=row.item_data&&typeof row.item_data==='object'?row.item_data:{};
 const existing=catalog.find(item=>item.id===key);
 const usage=meta.description||meta.function||(meta['用途']==='crafting'?'Bahan untuk membuat item lain.':meta['用途']==='farming'?'Benih untuk kegiatan pertanian.':meta.tool==='pickaxe'?'Alat tambang • Kecepatan '+(meta.mine_speed||1)+'x':'');
 const item=existing||{id:key,icon:categoryIcons[row.category]||'📦'};
 Object.assign(item,{serverId:row.item_id,name:row.display_name||item.name||row.item_id,tile:Number.isInteger(meta.tile)?meta.tile:(item.tile||0),stack:row.stack_limit||item.stack||999,desc:usage||item.desc||('Kategori: '+(row.category||'item')+' • Kelangkaan: '+(row.rarity||'common')),category:row.category||item.category||'item',rarity:row.rarity||item.rarity||'common',placeable:!!row.is_placeable,tradeable:!!row.is_tradeable,itemData:meta});
 if(!existing&&keep)catalog.push(item);
 return item;
}
function renderInventory(){
 const e=$('#modal-content');e.replaceChildren();
 const search=document.createElement('input');search.type='search';search.className='world-input';search.placeholder='Cari nama item...';search.setAttribute('aria-label','Cari item di katalog');
 const grid=document.createElement('div');grid.className='inventory-grid';
 const detail=document.createElement('p');detail.className='panel-note inventory-detail';
 const ownedItems=()=>catalog.filter(it=>(inv[it.id]||0)>0);
 const describe=it=>{const count=inv[it.id]||0;detail.textContent=(it.desc||'Item ORBIT')+' • Dimiliki: '+count+(it.placeable===true?' • Bisa dipasang dari hotbar':it.id==='seed'?' • Tanam melalui Workshop':it.category==='tool'?' • Pasang melalui bagian peralatan':it.category==='resource'?' • Bahan crafting':'')};
 let visibleItems=ownedItems(),searchTimer=null,requestNumber=0;
 const renderItems=items=>{
  visibleItems=items;grid.replaceChildren();
  if(!items.length){addText(grid,'p',search.value.trim()?'Item tidak ditemukan.':'Tas masih kosong. Tambang atau buat item untuk mengisinya.','panel-note');return}
  items.forEach(it=>{
   const d=document.createElement('button');d.type='button';d.className='inventory-item'+(placeableItems[selected]?.id===it.id?' selected':'');
   const b=document.createElement('b');b.className='item-icon';b.append(makeItemIcon(it.id,it));
   const n=document.createElement('strong');n.textContent=it.name;
   const q=document.createElement('div');q.textContent='× '+(inv[it.id]||0);
   d.append(b,n,q);
   d.onclick=()=>{
    describe(it);
    if((inv[it.id]||0)<=0){detail.textContent=it.name+' • Belum dimiliki. Item ini belum dapat dipilih.';return}
    const slot=placeableItems.findIndex(x=>x.id===it.id);
    if(slot>=0){selected=slot;renderHotbar();renderItems(visibleItems)}
   };
   grid.append(d);
  });
 };
 const searchCatalog=async()=>{
  const query=search.value.trim().replace(/[%_]/g,'').slice(0,40),request=++requestNumber;
  if(query.length<2){renderItems(ownedItems());return}
  if(!sb||!onlineUser||!navigator.onLine){renderItems(ownedItems());toast('Koneksi diperlukan untuk mencari katalog item');return}
  const {data,error}=await sb.from('item_catalog').select('item_id,display_name,category,rarity,stack_limit,is_placeable,is_tradeable,item_data').ilike('display_name','%'+query+'%').order('display_name').limit(40);
  if(request!==requestNumber)return;
  if(error){toast('Pencarian katalog gagal: '+error.message);return}
  renderItems((data||[]).map(row=>mergeCatalogRow(row,false)));
 };
 search.addEventListener('input',()=>{if(searchTimer)clearTimeout(searchTimer);searchTimer=setTimeout(searchCatalog,220)});
 e.append(search,grid,detail);renderItems(visibleItems);
 describe(catalog.find(x=>x.id===placeableItems[selected]?.id)||visibleItems[0]||catalog[0]);
 const gear=document.createElement('div');gear.className='panel-row';
 const label=document.createElement('span');label.textContent='Pilih alat tambang';
 const picker=document.createElement('select');picker.className='world-input';
 const tools=catalog.filter(it=>it.category==='tool'&&(it.serverId==='starter_pickaxe'||(inv[it.id]||0)>0));
 tools.forEach(it=>{const o=document.createElement('option');o.value=it.serverId||it.id;o.textContent=it.name;picker.append(o)});
 picker.value=tools.some(it=>(it.serverId||it.id)===equippedTool)?equippedTool:(tools[0]?.serverId||'starter_pickaxe');
 const button=document.createElement('button');button.textContent='PAKAI';
 button.onclick=async()=>{
  if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine){toast('Koneksi server diperlukan untuk memasang alat');return}
  const next=picker.value;button.disabled=true;
  const {error}=await sb.rpc('orbit_equip_tool',{p_item_id:next});button.disabled=false;
  if(error){toast('Gagal memasang alat: '+error.message);return}
  equippedTool=next;renderInventory();toast('Alat berhasil dipasang');
 };
 gear.append(label,picker,button);e.append(gear);
}
function openPanel(name){const modal=$('#modal'),title=$('#modal-title'),content=$('#modal-content');content.replaceChildren();modal.classList.remove('hidden');modal.classList.toggle('inventory-mode',name==='inventory');modal.classList.remove('sheet-expanded');if(name==='inventory'){title.textContent='🎒 Backpack';renderInventory()}else if(name==='craft'){
 title.textContent='⚒ Workshop';
 const note=document.createElement('p');note.className='panel-note';note.textContent='Semua resep diproses dan disimpan oleh server ORBIT.';content.append(note);
 if(!sb||!onlineUser){
  addText(content,'p','Login diperlukan untuk melihat resep server.','panel-note');
 }else{
  (async()=>{
  const {data:recipes,error:recipeError}=await sb.rpc('orbit_list_crafting_recipes');
  if(recipeError||!Array.isArray(recipes)){
   addText(content,'p','Resep gagal dimuat dari server. Periksa koneksi lalu buka Workshop lagi.','panel-note');
  }else if(!recipes.length){
   addText(content,'p','Belum ada resep yang tersedia.','panel-note');
  }else{
   recipes.forEach(recipe=>{
    const row=document.createElement('div');row.className='panel-row';
    const span=document.createElement('span');
    const ingredients=(recipe.ingredients||[]).map(item=>item.quantity+' '+item.display_name).join(' + ');
    span.textContent=(recipe.output_name||recipe.output_item_id)+' ×'+recipe.output_quantity+' • '+ingredients;
    const btn=document.createElement('button');btn.textContent='BUAT';
    btn.onclick=async()=>{
     if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine){toast('Koneksi server diperlukan untuk crafting');return}
     btn.disabled=true;
     const {data,error}=await sb.rpc('orbit_craft_item',{p_recipe_id:recipe.recipe_id});
     btn.disabled=false;
     if(error){const m=error.message||'';toast(m.includes('MATERIALS_MISSING')?'Material belum cukup':m.includes('OUTPUT_STACK_LIMIT')?'Kapasitas item sudah penuh':'Craft gagal: '+m);return}
     await syncOnlineInventory();
     toast('Berhasil membuat '+(data?.item_name||recipe.output_name||'item'));
     openPanel('craft');
    };
    row.append(span,btn);content.append(row);
   });
  }
  })();
 }
  const farmRow=document.createElement('div');farmRow.className='panel-row';
  const farmLabel=document.createElement('span');farmLabel.textContent='🌱 Glow Seed Farm • tumbuh dalam 5 menit';
  const plant=document.createElement('button');plant.textContent='TANAM DI DEPAN';plant.disabled=!onlineConnectionReady||!activeWorldId||!onlineUser;
  plant.onclick=async()=>{if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine){toast('Koneksi server diperlukan untuk menanam');return}const tx=Math.floor((player.x+(player.face>0?player.w+5:-5))/T),ty=Math.floor((player.y+player.h-1)/T);plant.disabled=true;const {error}=await sb.rpc('orbit_plant_seed',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty});plant.disabled=false;if(error){const m=error.message;toast(m.includes('SEED_REQUIRED')?'Butuh Glow Seed':m.includes('NEEDS_SOIL')?'Tanam di atas rumput atau tanah':m.includes('TARGET_NOT_EMPTY')?'Tempat tanam terisi':m.includes('AREA_CLAIMED')?'Area ini dilindungi pemain lain':m.includes('TOO_FAR')?'Dekati area tanam dahulu':'Gagal menanam: '+m);return}map[ty][tx]=8;await syncOnlineInventory();toast('Benih ditanam • siap dipanen dalam 5 menit')};
  farmRow.append(farmLabel,plant);content.append(farmRow);
 }else if(name==='worlds'){title.textContent='🌍 World Gate';let p=document.createElement('p');p.className='panel-note';p.textContent='Login dan pilih dunia online untuk mulai bermain. Progres disimpan di server.';content.append(p);refreshWorldList(content)}else if(name==='social'){authPanel()}else{title.textContent='⚙ Settings';content.innerHTML='<p class="panel-note">ORBIT Online • progres dan dunia tersimpan di server. Koneksi internet diperlukan untuk bermain.</p>'}}
function solid(x,y){return y>=WH||x<0||x>=WW||y<0?true:([1,2,3,4,5,6,7].includes(map[y][x]))}
function rectBlocked(x,y,w,h){const left=Math.floor(x/T),right=Math.floor((x+w-1)/T),top=Math.floor(y/T),bottom=Math.floor((y+h-1)/T);for(let ty=top;ty<=bottom;ty++)for(let tx=left;tx<=right;tx++)if(solid(tx,ty))return true;return false}
function mineAt(){return}
function placeAt(){return}
function actionAt(e,delta=0){if(!onlineConnectionReady||!activeWorldId||!onlineUser)return;const r=canvas.getBoundingClientRect(),px=e.clientX-r.left+cameraX,py=e.clientY-r.top+cameraY;if(tool==='mine')mineAt(px,py,delta);else placeAt(px,py)}
let mining=false,miningPointerId=null,pointerTarget=null;canvas.addEventListener('pointerdown',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),wx=e.clientX-r.left+cameraX,wy=e.clientY-r.top+cameraY;const tappedPlayer=tool==='mine'?remotePlayers.find(p=>wx>=p.x*T-player.w/2-5&&wx<=p.x*T+player.w/2+5&&wy>=p.y*T-player.h/2-5&&wy<=p.y*T+player.h/2+5):null;if(tappedPlayer){requestTradeWithPlayer(tappedPlayer.user_id);return}mining=true;miningPointerId=e.pointerId;pointerTarget={clientX:e.clientX,clientY:e.clientY};if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);resetMining();if(tool==='place')actionAt(e)});canvas.addEventListener('pointermove',e=>{if(mining&&e.pointerId===miningPointerId)pointerTarget={clientX:e.clientX,clientY:e.clientY}});['pointerup','pointercancel','lostpointercapture'].forEach(n=>canvas.addEventListener(n,e=>{if(miningPointerId!==null&&e.pointerId!==miningPointerId)return;mining=false;miningPointerId=null;pointerTarget=null;resetMining()}));
function clearControls(){input.left=input.right=input.jump=input.mine=false;mining=false;miningPointerId=null;pointerTarget=null;resetMining()}async function reconnectActiveWorld(){if(worldReconnectPending||!activeWorldId||!onlineUser||!sb||!navigator.onLine)return;worldReconnectPending=true;const resume={id:activeWorldId,name:activeWorld,biome:activeBiome};onlineConnectionReady=false;loadedChunkKeys=new Set();lastPositionSyncKey='';if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}if(positionTimer){clearInterval(positionTimer);positionTimer=null}const previous=worldChannel;worldChannel=null;try{if(previous)await sb.removeChannel(previous);await enterOnlineWorld(resume)}catch(error){toast('Gagal menyambung kembali ke dunia. Masuk ulang melalui World Gate.')}finally{worldReconnectPending=false}}
function bind(id,key){let e=$(id);e.addEventListener('pointerdown',v=>{v.preventDefault();if(!$('#modal').classList.contains('hidden')||!sideMenu.classList.contains('hidden'))return;input[key]=true;e.currentTarget.setPointerCapture(v.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(n=>e.addEventListener(n,()=>{input[key]=false;if(key==='mine')resetMining()}))}bind('#left','left');bind('#right','right');bind('#jump','jump');bind('#mine','mine');addEventListener('blur',clearControls);document.addEventListener('visibilitychange',()=>{if(document.hidden){clearControls();if(!activeWorldId)save(false);return}if(activeWorldId&&onlineUser&&sb&&navigator.onLine&&(!worldChannel||!onlineConnectionReady)){reconnectActiveWorld();return}if(activeWorldId&&worldChannel&&onlineUser){lastPositionSyncKey='';ensureNearbyChunks().catch(()=>{});syncOnlinePosition();worldChannel.track({x:Math.floor((player.x+player.w/2)/T),y:Math.floor((player.y+player.h/2)/T),face:player.face,animation:Math.abs(player.vx)>.15?'walk':'idle',display_name:playerDisplayName}).catch(()=>{})}});addEventListener('offline',()=>{clearControls();onlineConnectionReady=false;if(worldChannel){sb?.removeChannel(worldChannel);worldChannel=null}if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}if(positionTimer){clearInterval(positionTimer);positionTimer=null}toast('Koneksi terputus • permainan dijeda, tidak ada mode offline')});addEventListener('online',()=>{reconnectActiveWorld()});addEventListener('keydown',e=>{if(['a','ArrowLeft','d','ArrowRight',' ','w','ArrowUp'].includes(e.key)&&!$('#modal').classList.contains('hidden')){e.preventDefault();return}if(['a','ArrowLeft','d','ArrowRight',' ','w','ArrowUp'].includes(e.key))e.preventDefault();if(['a','ArrowLeft'].includes(e.key))input.left=true;if(['d','ArrowRight'].includes(e.key))input.right=true;if([' ','w','ArrowUp'].includes(e.key))input.jump=true;if(e.key==='e'&&!e.repeat)openPanel('inventory')});addEventListener('keyup',e=>{if(['a','ArrowLeft'].includes(e.key))input.left=false;if(['d','ArrowRight'].includes(e.key))input.right=false;if([' ','w','ArrowUp'].includes(e.key))input.jump=false});
const tileSpriteCache=new Map();
function drawTile(id,screenX,screenY,wx,wy){
 if(id===0)return;
 const variant=Math.floor(rand(wx*97+wy*193)*5);
 const key=activeBiome+':'+id+':'+variant;
 let sprite=tileSpriteCache.get(key);
 if(!sprite){
  sprite=document.createElement('canvas');sprite.width=T;sprite.height=T;
  const g=sprite.getContext('2d'),p={
   1:['#70c64f','#4d9c3e','#2d713b'],2:['#bd8650','#99613c','#74452e'],
   3:['#89969e','#697983','#4b5962'],4:['#9e6342','#d78a4b','#784432'],
   5:['#287e9b','#61d9db','#d2ffff'],6:['#80502f','#b77b42','#d9a866'],
   7:['#24643f','#439a4c','#8bd66a'],8:['#3b7d3c','#64b94f','#b3e878'],9:['#8a5b38','#bd8a55','#e3c08a'],10:['#754c42','#b76b52','#e7a27b'],11:['#2b7890','#75dce4','#e3ffff'],12:['#476d50','#739a63','#b5d18b']
  };
  const cold={1:['#cce8ee','#91bbc9','#547e91'],2:['#9bbbc7','#718f9c','#4e6a78'],3:['#a9c3d0','#839eae','#526d7d'],7:['#76b7b0','#a9ddd0','#e2f6df'],8:['#5b9b9b','#8acac1','#d9f4e7']};
  const hot={1:['#d18a4e','#ad593e','#793d35'],2:['#a36a49','#80503c','#56372f'],3:['#8b6e65','#6a514e','#493a42'],7:['#9b4d39','#d16e43','#f1a35f'],8:['#b05a37','#d98a45','#f2c06e']};
  const mystic={1:['#8974b8','#a891d4','#d4c4ef'],2:['#765c91','#9b80b4','#c2a7d9'],3:['#626a9a','#8894bf','#c4c9e7'],7:['#3e786d','#69b69a','#b0e4b0'],8:['#497d70','#83c9a1','#d5f2b5']};
  const pal=activeBiome==='frost'?cold[id]||p[id]:activeBiome==='ember'?hot[id]||p[id]:activeBiome==='mystic'?mystic[id]||p[id]:p[id];
  const [base,mid,light]=pal,grain=n=>rand(variant*137+n*29+wx*17+wy*31);
  g.fillStyle=base;g.fillRect(0,0,T,T);
  g.fillStyle='#182d35';g.fillRect(0,0,T,1);g.fillRect(0,0,1,T);
  g.fillStyle='#ffffff30';g.fillRect(1,1,T-2,1);
  g.fillStyle='#18232c55';g.fillRect(0,T-2,T,2);g.fillRect(T-2,0,2,T);
  if(id===1){
   g.fillStyle=light;g.fillRect(1,1,T-2,4);g.fillStyle=mid;g.fillRect(1,5,T-2,2);
   for(let n=0;n<7;n++){const x=2+Math.floor(grain(n)*19),y=8+Math.floor(grain(n+9)*13);g.fillStyle=n%3===0?light:mid;g.fillRect(x,y,2+(n%2),2)}
   g.fillStyle='#e5e7a1';g.fillRect(5,10,2,2);g.fillRect(17,17,2,2);
  }else if(id===2){
   g.fillStyle=mid;for(let n=0;n<8;n++){const x=2+Math.floor(grain(n)*19),y=3+Math.floor(grain(n+10)*18);g.fillRect(x,y,2+(n%3),1+(n%2))}
   g.fillStyle=light;g.fillRect(5,7,3,1);g.fillRect(15,15,4,1);g.fillStyle='#54382e';g.fillRect(3,19,4,2);
  }else if(id===3){
   g.fillStyle=mid;g.fillRect(3,4,7,3);g.fillRect(13,13,8,4);g.fillRect(5,18,4,3);
   g.fillStyle=light;g.fillRect(4,4,4,1);g.fillRect(14,13,5,1);g.fillStyle='#394954';g.fillRect(8,7,2,3);g.fillRect(18,17,3,2);
  }else if(id===4){
   g.fillStyle='#4b3938';g.fillRect(4,6,15,13);g.fillStyle=mid;g.fillRect(6,5,11,12);
   g.fillStyle=light;g.fillRect(7,6,5,7);g.fillRect(13,10,3,3);g.fillStyle='#f6d39a';g.fillRect(8,7,2,3);
  }else if(id===5){
   g.fillStyle='#15516e';g.fillRect(5,5,13,15);g.fillRect(8,2,8,3);g.fillStyle=mid;g.fillRect(7,4,9,13);g.fillStyle=light;g.fillRect(9,5,4,8);g.fillStyle='#f2ffff';g.fillRect(10,5,2,4);
  }else if(id===6){
   g.fillStyle='#513523';g.fillRect(5,3,14,19);g.fillStyle=mid;g.fillRect(7,3,10,18);g.fillStyle=light;g.fillRect(8,4,3,16);g.fillStyle='#75482c';g.fillRect(13,7,2,12);
  }else if(id===7){
   g.fillStyle='#17452f';g.fillRect(3,8,18,11);g.fillRect(6,4,13,15);g.fillStyle=mid;g.fillRect(2,7,8,9);g.fillRect(9,4,10,11);g.fillStyle=light;g.fillRect(5,6,5,4);g.fillRect(13,5,4,3);g.fillRect(10,13,6,3);
  }else if(id===8){
   g.fillStyle='#28603a';g.fillRect(10,7,5,14);g.fillStyle=mid;g.fillRect(4,7,8,7);g.fillRect(13,4,7,7);g.fillStyle=light;g.fillRect(10,3,5,5);g.fillRect(6,8,3,2);g.fillRect(15,5,3,2);
  }else if(id===9){
   g.fillStyle='#60402d';for(let y=5;y<24;y+=7){g.fillRect(2,y,20,5);g.fillStyle=mid;g.fillRect(3,y+1,18,3);g.fillStyle='#60402d';}
   g.fillStyle=light;g.fillRect(5,7,5,1);g.fillRect(15,14,4,1);g.fillRect(7,21,4,1);
  }else if(id===10){
   g.fillStyle='#593c36';for(let y=3;y<25;y+=8){g.fillRect(2,y,20,6);g.fillStyle=mid;for(let x=(y%16===3?3:8);x<23;x+=10)g.fillRect(x,y+1,7,4);g.fillStyle='#593c36';}
   g.fillStyle=light;g.fillRect(4,4,3,1);g.fillRect(14,12,4,1);g.fillRect(5,20,4,1);
  }else if(id===11){
   g.fillStyle='#174c62';g.fillRect(2,2,20,20);g.fillStyle=mid;g.fillRect(4,4,16,16);g.fillStyle=light;g.fillRect(6,5,3,10);g.fillRect(11,5,2,5);g.fillStyle='#ffffffaa';g.fillRect(4,4,5,1);
  }else if(id===12){
   g.fillStyle='#38533f';g.fillRect(2,2,20,20);g.fillStyle=mid;g.fillRect(4,4,16,16);g.fillStyle=light;g.fillRect(5,5,6,3);g.fillRect(14,11,5,3);g.fillStyle='#294436';g.fillRect(7,15,5,3);g.fillStyle='#b2cf7b';g.fillRect(4,3,4,2);g.fillRect(16,17,4,2);
  }
  tileSpriteCache.set(key,sprite);
 }
 ctx.drawImage(sprite,Math.round(screenX),Math.round(screenY));
}
function spawnBlockParticles(tx,ty,tileId){const palette=({1:['#8bd66a','#d7ef9a'],2:['#bd8650','#e4b47c'],3:['#a9bac2','#e4edf0'],4:['#d78a4b','#ffe0a0'],5:['#61d9db','#e5ffff'],6:['#b77b42','#e7bd78'],7:['#78c86b','#d2f09a'],8:['#83d96a','#e3ff9d'],9:['#bd8a55','#e3c08a'],10:['#b76b52','#e7a27b'],11:['#75dce4','#e3ffff'],12:['#739a63','#b5d18b']})[tileId]||['#e8d28b','#fff2c2'];for(let i=0;i<9&&particles.length<120;i++){const a=Math.random()*Math.PI*2,s=.7+Math.random()*2.1;particles.push({x:(tx+.5)*T,y:(ty+.5)*T,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.1,life:280+Math.random()*220,max:500,size:2+Math.floor(Math.random()*2),color:palette[i%palette.length]})}}
function drawParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.11*dt;p.life-=dt*16.67;if(p.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=Math.min(1,p.life/150);ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x-cameraX),Math.round(p.y-cameraY),p.size,p.size)}ctx.globalAlpha=1}
function drawMiningProgress(){if(!miningState.key||miningState.tx<0)return;const tile=map[miningState.ty]?.[miningState.tx];if(!tile)return;const x=miningState.tx*T-cameraX,y=miningState.ty*T-cameraY,p=Math.min(1,miningState.progress/mineDuration(tile));ctx.fillStyle='#091523b8';ctx.fillRect(x+2,y+T-7,T-4,5);ctx.fillStyle='#f6d47d';ctx.fillRect(x+2,y+T-7,(T-4)*p,5);ctx.strokeStyle='#fff1bf';ctx.lineWidth=1;ctx.strokeRect(x+2.5,y+T-6.5,T-5,4);
 if(p>.18){ctx.save();ctx.beginPath();ctx.strokeStyle='#17202a';ctx.lineWidth=1.15;ctx.globalAlpha=Math.min(.82,p+.12);ctx.moveTo(x+7,y+5);ctx.lineTo(x+11,y+10);ctx.lineTo(x+9,y+14);ctx.moveTo(x+11,y+10);ctx.lineTo(x+16,y+8);if(p>.48){ctx.moveTo(x+9,y+14);ctx.lineTo(x+6,y+19);ctx.moveTo(x+16,y+8);ctx.lineTo(x+18,y+14)}if(p>.78){ctx.moveTo(x+16,y+8);ctx.lineTo(x+14,y+4);ctx.moveTo(x+9,y+14);ctx.lineTo(x+13,y+19)}ctx.stroke();ctx.restore()}
}
function drawPlayer(x,y,remote=false,remoteData=null){
 const t=performance.now()/105,walking=remote?remoteData?.animation==='walk':Math.abs(player.vx)>.15,step=walking?Math.round(Math.sin(t)*2):0,bob=walking?Math.abs(Math.sin(t)):0,face=remote?(Number(remoteData?.face)||1):player.face,swing=(remote?remoteData?.animation==='mine':input.mine||mining)?Math.sin(performance.now()/42)*.58:0;
 ctx.save();ctx.translate(Math.round(x),Math.round(y-bob));
 if(face<0){ctx.translate(player.w,0);ctx.scale(-1,1)}
 // Compact original pixel avatar: backpack, boots, tunic, face and hair.
 ctx.fillStyle='#593d2b';ctx.fillRect(0,12,5,10);ctx.fillStyle='#c18a4c';ctx.fillRect(1,13,3,7);ctx.fillStyle='#e2b96e';ctx.fillRect(1,13,2,2);
 ctx.fillStyle='#49342b';ctx.fillRect(3,19+step,5,7);ctx.fillRect(11,19-step,5,7);
 ctx.fillStyle='#e1b36d';ctx.fillRect(2,24+step,7,4);ctx.fillRect(10,24-step,7,4);
 ctx.fillStyle='#2d5e9a';ctx.fillRect(3,10,12,12);ctx.fillStyle='#4b88c5';ctx.fillRect(4,11,10,9);
 ctx.fillStyle='#f1d27c';ctx.fillRect(8,12,2,8);ctx.fillRect(4,11,3,2);
 ctx.fillStyle='#d99569';ctx.fillRect(1,13+Math.round(swing*2),3,8);ctx.fillRect(14,13-Math.round(swing*3),3,8);
 ctx.fillStyle='#f4c59a';ctx.fillRect(3,2,11,10);ctx.fillStyle='#ffddb0';ctx.fillRect(4,3,9,7);
 ctx.fillStyle='#593b2c';ctx.fillRect(2,0,13,4);ctx.fillRect(2,2,3,5);ctx.fillRect(11,2,4,5);
 ctx.fillStyle='#2c2730';ctx.fillRect(11,5,2,2);ctx.fillStyle='#fff1c8';ctx.fillRect(12,5,1,1);
 ctx.fillStyle='#f2c36f';ctx.fillRect(6,11,6,2);
 ctx.save();ctx.translate(18,14);ctx.rotate(swing);ctx.strokeStyle='#64442d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(2,-3);ctx.stroke();ctx.fillStyle='#273d54';ctx.fillRect(-3,-5,8,3);ctx.fillStyle='#c9d7dc';ctx.fillRect(1,-6,3,2);ctx.restore();
 ctx.restore();
 if(remote&&remoteData?.display_name){
  const label=String(remoteData.display_name).slice(0,18);ctx.font='9px monospace';const width=Math.max(42,Math.min(116,ctx.measureText(label).width+18));
  const lx=Math.round(x+player.w/2-width/2),ly=Math.round(y-15);
  ctx.fillStyle='#17251fe8';ctx.fillRect(lx,ly,width,13);ctx.strokeStyle='#f2d28b';ctx.lineWidth=1;ctx.strokeRect(lx+.5,ly+.5,width-1,12);
  ctx.fillStyle='#9ee36c';ctx.fillRect(lx+5,ly+5,3,3);ctx.font='9px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff3cf';ctx.fillText(label,lx+width/2+3,ly+6.5,width-14);
 }
}
function frame(ts){let dt=Math.min((ts-last)/16.67||1,2);last=ts;const uiPaused=!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine||!$('#modal').classList.contains('hidden')||!sideMenu.classList.contains('hidden')||document.hidden;if(uiPaused){input.left=input.right=input.jump=input.mine=false;mining=false;miningPointerId=null;pointerTarget=null;resetMining();if(!onlineConnectionReady||!activeWorldId||!navigator.onLine){ctx.clearRect(0,0,screenW,screenH);ctx.fillStyle='#15283c';ctx.fillRect(0,0,screenW,screenH);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4e4bd';ctx.font='bold 20px monospace';ctx.fillText(!navigator.onLine?'KONEKSI INTERNET TERPUTUS':!onlineUser?'LOGIN UNTUK BERMAIN':!activeWorldId?'PILIH DUNIA ONLINE':'MENGHUBUNGKAN KE SERVER',screenW/2,screenH/2-12);ctx.font='12px monospace';ctx.fillStyle='#b9c9d8';ctx.fillText('ORBIT hanya dapat dimainkan secara online',screenW/2,screenH/2+18);requestAnimationFrame(frame);return}}if(input.mine&&tool==='mine'){const tx=player.x+(player.face>0?player.w+5:-5),ty=player.y+player.h+T*.45;mineAt(tx,ty,dt*16.67)}if(mining&&tool==='mine'&&pointerTarget){const r=canvas.getBoundingClientRect();mineAt(pointerTarget.clientX-r.left+cameraX,pointerTarget.clientY-r.top+cameraY,dt*16.67)}player.vx=((input.right?1:0)-(input.left?1:0))*2.5;if(player.vx)player.face=Math.sign(player.vx);if(input.jump&&player.ground){window.ORBITAudio?.play('jump');player.vy=-8.4;player.ground=false}player.vy=Math.min(10,player.vy+.38*dt);let nx=player.x+player.vx*dt;if(!rectBlocked(nx,player.y,player.w,player.h))player.x=Math.max(0,Math.min(WW*T-player.w,nx));let ny=player.y+player.vy*dt;player.ground=false;if(!rectBlocked(player.x,ny,player.w,player.h))player.y=ny;else if(player.vy>=0){const footTile=Math.floor((ny+player.h-1)/T);player.y=footTile*T-player.h;player.vy=0;player.ground=true}else{const headTile=Math.floor(ny/T);player.y=(headTile+1)*T;player.vy=0;}cameraX=Math.max(0,Math.min(WW*T-screenW,player.x-screenW*.46));cameraY=Math.max(0,Math.min(WH*T-screenH,player.y-screenH*.52));const skyColor=({frost:'#b9d9e5',ember:'#c77d65',mystic:'#9388bf',deep:'#477e84'})[activeBiome]||'#79bde2';ctx.fillStyle=skyColor;ctx.fillRect(0,0,screenW,screenH);
 const sun=activeBiome==='ember'?'#ffe0a0':activeBiome==='mystic'?'#f1e4ff':'#fff1b5';ctx.fillStyle=sun;ctx.fillRect(Math.round(screenW*.78-cameraX*.025),Math.round(screenH*.16),18,18);ctx.fillStyle='#ffffff66';
 for(let i=0;i<6;i++){const cx=((i*193-cameraX*.16)%(screenW+160)+screenW+160)%(screenW+160)-80,cy=Math.round(screenH*(.12+(i%3)*.1));ctx.fillRect(cx+8,cy-5,24,5);ctx.fillRect(cx,cy,48,9);ctx.fillRect(cx+7,cy+9,30,4)}
 for(let layer=0;layer<3;layer++){const baseY=Math.round(screenH*(.66+layer*.085));ctx.fillStyle=['#78a98d','#578d78','#386c63'][layer];for(let x=-40;x<screenW+60;x+=40){const wx=x+cameraX*(.1+layer*.12),h=16+Math.round((Math.sin(wx*.012+layer*2)+1)*9);ctx.fillRect(Math.round(x),baseY-h,40,h+screenH-baseY)}}let sx=Math.floor(cameraX/T),sy=Math.floor(cameraY/T),ex=Math.min(WW,sx+Math.ceil(screenW/T)+2),ey=Math.min(WH,sy+Math.ceil(screenH/T)+2);for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)drawTile(map[y][x],x*T-cameraX,y*T-cameraY,x,y);drawMiningProgress();drawParticles(dt);remotePlayers.forEach(p=>drawPlayer(p.x*T-player.w/2-cameraX,p.y*T-player.h/2-cameraY,true,p));drawPlayer(player.x-cameraX,player.y-cameraY);$('#coords').textContent='X: '+Math.floor(player.x/T)+' • Y: '+Math.floor(player.y/T);requestAnimationFrame(frame)}
function closeModal(){const modal=$('#modal');modal.classList.add('hidden');modal.classList.remove('inventory-mode','sheet-expanded')}
$('#modal-close').onclick=closeModal;
const sheetHandle=$('#sheet-grabber');let sheetStartY=0,sheetDelta=0,sheetDragging=false;
sheetHandle.addEventListener('pointerdown',e=>{if(!$('#modal').classList.contains('inventory-mode'))return;sheetStartY=e.clientY;sheetDelta=0;sheetDragging=true;sheetHandle.setPointerCapture(e.pointerId)});
sheetHandle.addEventListener('pointermove',e=>{if(!sheetDragging)return;sheetDelta=e.clientY-sheetStartY});
sheetHandle.addEventListener('pointerup',()=>{if(!sheetDragging)return;sheetDragging=false;if(sheetDelta < -35){$('#modal').classList.add('sheet-expanded')}else if(sheetDelta > 65){if($('#modal').classList.contains('sheet-expanded'))$('#modal').classList.remove('sheet-expanded');else closeModal()}else if(sheetDelta< -8){$('#modal').classList.add('sheet-expanded')}});
sheetHandle.addEventListener('pointercancel',()=>{sheetDragging=false});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
const sideMenu=$('#side-menu'),menuButton=$('#menu-button');
function closeSideMenu(){sideMenu.classList.add('hidden');sideMenu.setAttribute('aria-hidden','true');menuButton.setAttribute('aria-expanded','false')}
function openSideMenu(){sideMenu.classList.remove('hidden');sideMenu.setAttribute('aria-hidden','false');menuButton.setAttribute('aria-expanded','true')}
document.querySelectorAll('.drawer-links [data-panel]').forEach(b=>b.onclick=()=>{closeSideMenu();openPanel(b.dataset.panel)});
menuButton.onclick=()=>sideMenu.classList.contains('hidden')?openSideMenu():closeSideMenu();
$('#drawer-close').onclick=closeSideMenu;$('#drawer-scrim').onclick=closeSideMenu;
$('#mine').onclick=()=>{if(!onlineConnectionReady)return;tool='mine';toast('Mode menambang')};$('#place').onclick=()=>{if(!onlineConnectionReady)return;tool='place';resetMining();toast('Mode memasang blok')};renderHotbar();$('#world-name').textContent='ONLINE';$('#coins').textContent='0';requestAnimationFrame(frame);

let sb=null,onlineUser=null,activeWorldId=null,worldChannel=null,onlineConnectionReady=false,onlineSaveTimers=new Map(),remotePlayers=[],presenceTimer=null,playerDisplayName='Explorer',loadedChunkKeys=new Set(),positionTimer=null,onlineActionBusy=false,onlineSavedPosition=null,positionSyncBusy=false,lastPositionSyncKey='';
let chatFeed=[],chatFeedElement=null,socialPlayerListElement=null,worldReconnectPending=false;
const cfg=window.ORBIT_CONFIG;
function addText(parent,tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el}
function setAccountLabel(){const b=$('#world-name');if(onlineUser)b.title='Login: '+onlineUser.email;else b.title='Login diperlukan • Online-only'}
async function loadProfile(){if(!sb||!onlineUser)return false;const {error:ensureError}=await sb.rpc('orbit_ensure_profile',{p_display_name:onlineUser.user_metadata?.display_name||'Explorer'});if(ensureError){toast('Profil gagal disiapkan: '+ensureError.message);return false}const {data,error}=await sb.from('player_profiles').select('display_name,level,experience,coins,gems,equipped_tool,last_world_id,pos_x,pos_y').eq('user_id',onlineUser.id).maybeSingle();if(error){toast('Profil belum dapat dimuat');return false}if(data){applyProgress(data);$('#coins').textContent=data.coins;coins=data.coins;playerDisplayName=data.display_name||'Explorer';equippedTool=data.equipped_tool||'starter_pickaxe';onlineSavedPosition=data.last_world_id?{world_id:data.last_world_id,pos_x:Number(data.pos_x)||0,pos_y:Number(data.pos_y)||0}:null;return true}return false}
function applyProgress(data){if(!data)return;const nextLevel=Math.max(1,Number(data.level)||1),previous=Number($('#level').textContent)||1;$('#level').textContent=nextLevel;const xp=Number(data.experience)||0;const xpLabel=$('#xp');if(xpLabel)xpLabel.textContent=xp+'/'+(nextLevel*nextLevel*100)+' XP';if(nextLevel>previous)toast('Level naik! Sekarang Lv '+nextLevel)}
function renderChatFeed(){if(!chatFeedElement)return;chatFeedElement.replaceChildren();chatFeed.slice(-40).forEach(m=>{const row=document.createElement('div');row.className='chat-message';const head=document.createElement('b');head.textContent=m.display_name||'Explorer';const body=document.createElement('span');body.textContent=m.body||'';const time=document.createElement('small');time.textContent=new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});row.append(head,body,time);chatFeedElement.append(row)});chatFeedElement.scrollTop=chatFeedElement.scrollHeight}
function appendChatMessage(m){if(!m||chatFeed.some(x=>String(x.id)===String(m.id)))return;chatFeed.push(m);chatFeed=chatFeed.slice(-60);renderChatFeed()}
async function loadWorldChat(){if(!activeWorldId||!sb)return;const {data,error}=await sb.from('world_chat_messages').select('id,display_name,body,created_at').eq('world_id',activeWorldId).order('created_at',{ascending:true}).limit(40);if(error){toast('Chat gagal dimuat: '+error.message);return}chatFeed=data||[];renderChatFeed()}
async function requestTradeWithPlayer(userId){if(!onlineConnectionReady||!activeWorldId||!onlineUser||!sb||!userId||userId===onlineUser.id)return;const {error}=await sb.rpc('orbit_create_trade',{p_receiver_id:userId});if(error){const m=error.message;toast(m.includes('PLAYER_TOO_FAR')?'Dekati pemain untuk mengajak trade':m.includes('PLAYER_NOT_ACTIVE')?'Pemain tidak aktif':m.includes('TRADE_ALREADY_PENDING')?'Permintaan trade sudah ada':m.includes('TRADE_RATE_LIMIT')?'Tunggu sebelum mengirim permintaan lain':'Gagal mengajak trade: '+m);return}toast('Permintaan trade dikirim');openPanel('social')}
function refreshSocialPlayerList(){
  if(!socialPlayerListElement)return;
  socialPlayerListElement.replaceChildren();
  if(!remotePlayers.length){addText(socialPlayerListElement,'p','Belum ada pemain lain yang terdeteksi di dunia ini.','panel-note');return}
  const playerTileX=(player.x+player.w/2)/T,playerTileY=(player.y+player.h/2)/T;
  const nearby=[...remotePlayers].map(p=>({...p,distance:Math.round(Math.hypot(p.x-playerTileX,p.y-playerTileY))})).sort((a,b)=>a.distance-b.distance);
  addText(socialPlayerListElement,'p',nearby.length+' pemain online • diurutkan dari yang terdekat','panel-note');
  nearby.forEach(p=>{
   const row=document.createElement('div');row.className='panel-row';
   const label=document.createElement('span');label.textContent=(p.display_name||'Explorer')+' • '+p.distance+' blok';
   const profile=document.createElement('details');profile.className='player-profile-details';
   const profileSummary=addText(profile,'summary','PROFIL PEMAIN');
   const profileInfo=addText(profile,'p',(p.display_name||'Explorer')+' • Online sekarang • '+(p.animation==='walk'?'Sedang bergerak':'Sedang diam')+' • Jarak '+p.distance+' blok','panel-note');
   profile.setAttribute('aria-label','Profil pemain '+(p.display_name||'Explorer'));
   const request=addText(row,'button','AJAK TRADE');
   request.disabled=!onlineConnectionReady;
   request.title='Jarak perkiraan '+p.distance+' blok';
   request.onclick=()=>requestTradeWithPlayer(p.user_id);
   row.prepend(label);row.append(profile);socialPlayerListElement.append(row);
  });
 }
 async function renderTradePanel(content){
  if(!activeWorldId||!onlineUser)return;
  addText(content,'p','🤝 Pemain di dunia','panel-note');
  socialPlayerListElement=document.createElement('div');content.append(socialPlayerListElement);refreshSocialPlayerList();
 const {data:trades,error}=await sb.from('player_trades').select('id,sender_id,receiver_id,status,sender_offer,receiver_offer,expires_at').eq('status','pending').or('sender_id.eq.'+onlineUser.id+',receiver_id.eq.'+onlineUser.id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(20);
 if(error){addText(content,'p','Daftar trade gagal dimuat.','panel-note');return}
 addText(content,'p','📨 Permintaan & penawaran trade','panel-note');
 if(!trades?.length)addText(content,'p','Belum ada permintaan trade aktif.','panel-note');
 const otherIds=[...new Set((trades||[]).map(t=>t.sender_id===onlineUser.id?t.receiver_id:t.sender_id))];
 let names=new Map();
 if(otherIds.length){const p=await sb.rpc('orbit_get_public_profiles',{p_user_ids:otherIds});names=new Map((p.data||[]).map(x=>[x.user_id,x.display_name]))}
 const inventoryResult=await fetchAllPlayerInventoryRows();
 if(inventoryResult.error){addText(content,'p','Inventaris trade gagal dimuat dari server.','panel-note');return}
 const ownedRows=(inventoryResult.data||[]).filter(x=>x.quantity>0);
 const catalogResult=await fetchCatalogRowsByIds(ownedRows.map(x=>x.item_id));
 if(catalogResult.error){addText(content,'p','Katalog item trade gagal dimuat.','panel-note');return}
 const tradeItems=(catalogResult.data||[]).filter(x=>x.is_tradeable===true);
 const tradeableIds=new Set(tradeItems.map(x=>x.item_id));
 const owned=ownedRows.filter(x=>tradeableIds.has(x.item_id));
 const itemNames=new Map(tradeItems.map(i=>[i.item_id,i.display_name]));
 const offerText=offer=>(offer||[]).map(x=>(itemNames.get(x.item_id)||x.item_id)+' ×'+x.quantity).join(', ')||'Kosong';
 const ownedById=new Map(owned.map(item=>[item.item_id,item]));
 (trades||[]).forEach(t=>{
  const incoming=t.receiver_id===onlineUser.id,other=incoming?t.sender_id:t.receiver_id;
  const card=document.createElement('div');card.className='panel-row';card.style.display='block';
  addText(card,'b',(incoming?'Dari ':'Kepada ')+(names.get(other)||'Explorer'),'');
  addText(card,'div','Tawaran mereka: '+offerText(incoming?t.sender_offer:t.receiver_offer));
  addText(card,'div','Tawaran kamu: '+offerText(incoming?t.receiver_offer:t.sender_offer));
  const select=document.createElement('select');select.className='world-input';
  owned.forEach(it=>{const o=document.createElement('option');o.value=it.item_id;o.textContent=(itemNames.get(it.item_id)||it.item_id)+' • stok '+it.quantity;select.append(o)});
  if(!owned.length){const o=document.createElement('option');o.textContent='Tidak ada item untuk ditawarkan';select.append(o)}
  const quantity=document.createElement('input');quantity.className='world-input';quantity.type='number';quantity.min='1';quantity.step='1';quantity.value='1';const syncQuantityLimit=()=>{const selected=ownedById.get(select.value);quantity.max=String(Math.max(1,Number(selected?.quantity)||1));quantity.value='1'};select.addEventListener('change',syncQuantityLimit);syncQuantityLimit();
  const draft=[];const draftList=document.createElement('div');draftList.className='panel-note';
  const renderDraft=()=>{draftList.replaceChildren();if(!draft.length){addText(draftList,'p','Belum ada item dalam tawaranmu.','');return}draft.forEach((entry,index)=>{const line=document.createElement('div');line.className='panel-row';const name=addText(line,'span',(itemNames.get(entry.item_id)||entry.item_id)+' ×'+entry.quantity);const remove=addText(line,'button','HAPUS');remove.type='button';remove.onclick=()=>{draft.splice(index,1);renderDraft()};line.append(name,remove);draftList.append(line)})};
  const addOffer=addText(card,'button','TAMBAH ITEM');addOffer.type='button';addOffer.disabled=!owned.length;
  addOffer.onclick=()=>{const item=ownedById.get(select.value),q=Number(quantity.value),max=Number(item?.quantity)||0;if(!item||!Number.isSafeInteger(q)||q<1||q>max){toast('Jumlah harus 1 sampai '+max+' sesuai stok');return}const existing=draft.find(x=>x.item_id===item.item_id);if(existing){toast('Item sudah ada dalam daftar tawaran');return}draft.push({item_id:item.item_id,quantity:q});renderDraft()};
  const offerButton=addText(card,'button','KIRIM SEMUA TAWARAN');offerButton.disabled=!owned.length;
  offerButton.onclick=async()=>{if(!draft.length){toast('Tambahkan minimal satu item');return}offerButton.disabled=true;addOffer.disabled=true;const {error}=await sb.rpc('orbit_set_trade_offer',{p_trade_id:t.id,p_offer:draft.map(x=>({...x}))});offerButton.disabled=false;addOffer.disabled=false;if(error){toast(error.message.includes('INSUFFICIENT_TRADE_ITEMS')?'Jumlah item tidak cukup':'Tawaran gagal: '+error.message);return}toast('Tawaran multi-item diperbarui');openPanel('social')};
  card.append(select,quantity,addOffer,draftList,offerButton);renderDraft();
  if(incoming){const accept=addText(card,'button','TERIMA TRADE');accept.style.marginLeft='6px';accept.onclick=async()=>{accept.disabled=true;const {error}=await sb.rpc('orbit_accept_trade',{p_trade_id:t.id});accept.disabled=false;if(error){const m=error.message;toast(m.includes('BOTH_OFFERS_REQUIRED')?'Kedua pemain harus mengirim tawaran':m.includes('TRADE_INVENTORY_LIMIT')?'Inventaris salah satu pemain penuh':m.includes('TRADE_ITEMS_CHANGED')?'Item berubah, perbarui tawaran':'Trade gagal: '+m);return}toast('Trade berhasil');await syncOnlineInventory();openPanel('social')}}
  const decline=addText(card,'button','TOLAK');decline.style.marginLeft='6px';decline.onclick=async()=>{const {error}=await sb.rpc('orbit_decline_trade',{p_trade_id:t.id});if(error)toast('Gagal menolak trade');else{toast('Trade ditolak');openPanel('social')}};
  content.append(card);
 });
}
function authPanel(){const title=$('#modal-title'),content=$('#modal-content');title.textContent='👥 Akun & Sosial';content.replaceChildren();chatFeedElement=null;socialPlayerListElement=null;if(!sb){addText(content,'p','Layanan online belum tersambung. Periksa koneksi internet.','panel-note');return}
 if(onlineUser){
  addText(content,'p','Login sebagai '+onlineUser.email,'panel-note');
  const status=addText(content,'div','Akun aktif • ID '+onlineUser.id.slice(0,8),'panel-row');
  const ownProfile=document.createElement('section');ownProfile.className='panel-note player-own-profile';
  addText(ownProfile,'b','👤 PROFIL PEMAINKU','');
  addText(ownProfile,'div','Nama: '+(playerDisplayName||'Explorer'),'');
  addText(ownProfile,'div','Level: '+($('#level')?.textContent||'1')+' • '+($('#xp')?.textContent||'0 XP'),'');
  addText(ownProfile,'div','Koin: '+($('#coins')?.textContent||'0')+' • Alat: '+(equippedTool||'starter_pickaxe'),'');
  content.append(ownProfile);
  if(activeWorldId){
   addText(content,'p','🛡️ Perlindungan area','panel-note');
   const claimStatus=addText(content,'p','Memeriksa status area…','panel-note');
   const claimRow=document.createElement('div');claimRow.className='panel-row';
   const claimHere=addText(claimRow,'button','KLAIM AREA INI');
   const releaseHere=addText(claimRow,'button','LEPAS KLAIM');releaseHere.disabled=true;
   const currentChunk=()=>({x:Math.floor((player.x+player.w/2)/T/16),y:Math.floor((player.y+player.h/2)/T/16)});
   const refreshClaim=async()=>{const c=currentChunk();const {data,error}=await sb.from('world_claims').select('owner_id').eq('world_id',activeWorldId).eq('chunk_x',c.x).eq('chunk_y',c.y).maybeSingle();if(error){claimStatus.textContent='Status area belum dapat dimuat.';return}if(!data){claimStatus.textContent='Area ini belum diklaim. Batas klaim: 9 area per pemain.';claimHere.disabled=false;releaseHere.disabled=true}else if(data.owner_id===onlineUser.id){claimStatus.textContent='Area ini dilindungi oleh klaimmu.';claimHere.disabled=true;releaseHere.disabled=false}else{claimStatus.textContent='Area ini dilindungi pemain lain.';claimHere.disabled=true;releaseHere.disabled=true}};
   claimHere.onclick=async()=>{const c=currentChunk();claimHere.disabled=true;const {error}=await sb.rpc('orbit_claim_chunk',{p_world_id:activeWorldId,p_chunk_x:c.x,p_chunk_y:c.y});if(error){claimHere.disabled=false;const m=error.message;toast(m.includes('CLAIM_LIMIT_REACHED')?'Batas klaim sudah tercapai (9 area)':m.includes('AREA_ALREADY_CLAIMED')?'Area sudah diklaim pemain lain':m.includes('MOVE_TO_AREA_TO_CLAIM')?'Kamu harus berada di area yang ingin diklaim':'Gagal klaim: '+m);return}toast('Area berhasil dilindungi');await refreshClaim()};
   releaseHere.onclick=async()=>{const c=currentChunk();releaseHere.disabled=true;const {error}=await sb.rpc('orbit_release_chunk',{p_world_id:activeWorldId,p_chunk_x:c.x,p_chunk_y:c.y});if(error){toast('Gagal melepas klaim: '+error.message);await refreshClaim();return}toast('Perlindungan area dilepas');await refreshClaim()};
   claimRow.append(claimStatus);content.append(claimRow);refreshClaim();
   addText(content,'p','💬 Chat dunia','panel-note');
   chatFeedElement=document.createElement('div');chatFeedElement.className='chat-feed';content.append(chatFeedElement);loadWorldChat();
   const input=document.createElement('input');input.className='world-input';input.maxLength=240;input.placeholder='Tulis pesan (maks. 240 karakter)';
   const send=addText(content,'button','KIRIM');send.className='primary';
   const sendMessage=async()=>{const body=input.value.trim();if(!body)return;send.disabled=true;const {data,error}=await sb.rpc('orbit_send_chat_message',{p_world_id:activeWorldId,p_body:body});send.disabled=false;if(error){toast(error.message.includes('CHAT_RATE_LIMIT')?'Tunggu sebentar sebelum mengirim lagi':'Pesan gagal dikirim: '+error.message);return}appendChatMessage(data);input.value=''};
   send.onclick=sendMessage;input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendMessage()}});
   content.append(input);
   renderTradePanel(content);
  }else addText(content,'p','Masuk ke dunia online untuk membuka chat dan bertemu pemain lain.','panel-note');
  const signout=addText(content,'button','KELUAR');signout.style.marginTop='10px';signout.onclick=async()=>{await sb.auth.signOut();toast('Berhasil keluar');openPanel('social')};return;
 }
 addText(content,'p','Masuk atau buat akun ORBIT untuk bermain di dunia online.','panel-note');
 const email=document.createElement('input');email.className='world-input';email.type='email';email.autocomplete='email';email.placeholder='Email';
 const pass=document.createElement('input');pass.className='world-input';pass.type='password';pass.autocomplete='current-password';pass.placeholder='Password (minimal 8 karakter)';
 const display=document.createElement('input');display.className='world-input';display.maxLength=20;display.placeholder='Nama pemain (untuk daftar)';
 content.append(email,pass,display);
 const login=addText(content,'button','MASUK');login.className='primary';login.onclick=async()=>{if(!email.value||!pass.value){toast('Isi email dan password');return}login.disabled=true;const {error}=await sb.auth.signInWithPassword({email:email.value.trim(),password:pass.value});login.disabled=false;if(error)toast('Login gagal: '+error.message);else{toast('Login berhasil');openPanel('social')}};
 const signup=addText(content,'button','BUAT AKUN');signup.style.marginLeft='8px';signup.onclick=async()=>{if(!email.value||pass.value.length<8){toast('Email valid dan password minimal 8 karakter');return}signup.disabled=true;const {data,error}=await sb.auth.signUp({email:email.value.trim(),password:pass.value,options:{data:{display_name:(display.value.trim()||'Explorer').slice(0,20)}}});signup.disabled=false;if(error)toast('Daftar gagal: '+error.message);else if(!data.session)toast('Cek email untuk konfirmasi akun');else toast('Akun berhasil dibuat')};
}
async function refreshWorldList(content){if(!sb||!onlineUser){addText(content,'p','Login dahulu untuk melihat dunia online.','panel-note');return}
 addText(content,'p','Dunia publik yang dibuat pemain ORBIT.','panel-note');
 const {data,error}=await sb.from('game_worlds').select('id,name,biome,max_players,owner_id').eq('is_public',true).order('created_at',{ascending:false}).limit(30);
 if(error){addText(content,'p','Gagal memuat daftar dunia: '+error.message,'panel-note');return}
 if(!data?.length)addText(content,'p','Belum ada dunia publik. Buat dunia pertama!','panel-note');
 (data||[]).forEach(w=>{const row=document.createElement('div');row.className='panel-row';const label=document.createElement('span');label.textContent='🌍 '+w.name+' • '+w.biome;const btn=addText(row,'button','MASUK');btn.onclick=async()=>{btn.disabled=true;const {error:joinError}=await sb.rpc('orbit_join_world',{p_world_id:w.id});btn.disabled=false;if(joinError){toast('Tidak bisa masuk: '+joinError.message);return}await enterOnlineWorld(w);};row.append(label,btn);content.append(row)});
 const divider=addText(content,'p','Buat dunia baru','panel-note');const name=document.createElement('input');name.className='world-input';name.maxLength=32;name.placeholder='Nama dunia (3–32 karakter)';const biome=document.createElement('select');biome.className='world-input';[['verdant','Verdant'],['frost','Frost'],['ember','Ember'],['mystic','Mystic'],['deep','Deep']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;biome.append(o)});const create=addText(content,'button','+ BUAT DUNIA ONLINE');create.className='primary';create.onclick=async()=>{if(name.value.trim().length<3){toast('Nama dunia minimal 3 karakter');return}create.disabled=true;const {data,error}=await sb.rpc('orbit_create_world',{p_name:name.value.trim(),p_biome:biome.value,p_is_public:true});create.disabled=false;if(error){toast('Gagal membuat dunia: '+error.message);return}const world={id:data,name:name.value.trim(),biome:biome.value};await enterOnlineWorld(world)};
}
async function enterOnlineWorld(w){
 if(!sb||!onlineUser){toast('Login dahulu untuk masuk ke dunia online');return}
 onlineConnectionReady=false;activeWorldId=w.id;activeWorld=w.name;activeBiome=w.biome||'verdant';$('#world-name').textContent=w.name;$('#modal').classList.add('hidden');toast('Memuat dunia online…');
 if(worldChannel){await sb.removeChannel(worldChannel);worldChannel=null}
 if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}
 if(positionTimer){clearInterval(positionTimer);positionTimer=null}
 remotePlayers=[];chatFeed=[];chatFeedElement=null;map=Array.from({length:WH},()=>Array(WW).fill(0));resetMining();
 if(!(await loadProfile())){activeWorldId=null;toast('Profil server belum siap. Coba masuk ulang.');return}
 const hasSavedPosition=onlineSavedPosition?.world_id===w.id;
 if(hasSavedPosition){
  player.x=Math.max(0,Math.min(WW*T-player.w,onlineSavedPosition.pos_x*T-player.w/2));
  player.y=Math.max(0,Math.min(WH*T-player.h,onlineSavedPosition.pos_y*T-player.h/2));
 }else{
  player.x=4*T-player.w/2;player.y=20*T;
 }
 player.vx=0;player.vy=0;player.ground=false;
 loadedChunkKeys=new Set();lastPositionSyncKey='';
 if(!(await ensureNearbyChunks())){activeWorldId=null;toast('Data dunia gagal dimuat dari server. Coba masuk ulang.');return}
 if(!hasSavedPosition){
  const tx=Math.max(0,Math.min(WW-1,Math.floor((player.x+player.w/2)/T)));
  const surface=map.findIndex(row=>row[tx]===1);
  if(surface>0){player.y=surface*T-player.h;player.vy=0;player.ground=false}
  if(!(await ensureNearbyChunks())){activeWorldId=null;toast('Data dunia gagal dimuat dari server. Coba masuk ulang.');return}
 }
 if(!(await syncOnlineInventory())){activeWorldId=null;toast('Inventaris server gagal dimuat. Coba masuk ulang.');return}
 if(!document.hidden&&!(await syncOnlinePosition())){activeWorldId=null;toast('Posisi pemain gagal disimpan ke server. Coba masuk ulang.');return}
 await sb.realtime.setAuth();
 worldChannel=sb.channel('orbit-world:'+w.id,{config:{private:true,presence:{key:onlineUser.id}}})
  .on('presence',{event:'sync'},()=>{const state=worldChannel.presenceState();remotePlayers=Object.entries(state).filter(([id])=>id!==onlineUser.id).flatMap(([id,metas])=>metas.map(p=>({...p,user_id:id}))).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));refreshSocialPlayerList()})
  .on('postgres_changes',{event:'*',schema:'public',table:'world_chunks',filter:'world_id=eq.'+w.id},payload=>{const row=payload.new;if(row?.tile_data)applyChunk(row.chunk_x,row.chunk_y,row.tile_data)})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'world_chat_messages',filter:'world_id=eq.'+w.id},payload=>appendChatMessage(payload.new))
  .on('postgres_changes',{event:'*',schema:'public',table:'player_trades',filter:'receiver_id=eq.'+onlineUser.id},()=>{if(!$('#modal').classList.contains('hidden')&&$('#modal-title').textContent.includes('Akun'))openPanel('social')})
  .on('postgres_changes',{event:'*',schema:'public',table:'player_trades',filter:'sender_id=eq.'+onlineUser.id},()=>{if(!$('#modal').classList.contains('hidden')&&$('#modal-title').textContent.includes('Akun'))openPanel('social')})
  .subscribe(async status=>{if(status==='SUBSCRIBED'&&worldChannel){onlineConnectionReady=true;await worldChannel.track({x:Math.floor((player.x+player.w/2)/T),y:Math.floor((player.y+player.h/2)/T),face:player.face,animation:'idle',display_name:playerDisplayName})}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){onlineConnectionReady=false;if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}if(positionTimer){clearInterval(positionTimer);positionTimer=null}toast('Koneksi dunia terputus. Permainan dijeda; buka kembali aplikasi untuk menyambung ulang.')}else if(status==='CLOSED'){onlineConnectionReady=false}});
 presenceTimer=setInterval(()=>{if(!document.hidden&&worldChannel&&onlineUser){worldChannel.track({x:Math.floor((player.x+player.w/2)/T),y:Math.floor((player.y+player.h/2)/T),face:player.face,animation:Math.abs(player.vx)>.15?'walk':'idle',display_name:playerDisplayName}).catch(()=>{});ensureNearbyChunks()}},1200);positionTimer=setInterval(()=>{if(!document.hidden&&worldChannel&&onlineUser)syncOnlinePosition()},1000);
 toast('Online: '+w.name);
}
function applyChunk(cx,cy,data){const tiles=data?.tiles;if(!Array.isArray(tiles))return;for(let y=0;y<16;y++)for(let x=0;x<16;x++){const wy=cy*16+y,wx=cx*16+x;if(map[wy]&&Number.isInteger(tiles[y]?.[x]))map[wy][wx]=tiles[y][x]}}
async function loadOnlineChunk(cx,cy){if(!sb||!activeWorldId||cx<0||cx>13||cy<0||cy>5)return false;const key=cx+','+cy;if(loadedChunkKeys.has(key))return true;loadedChunkKeys.add(key);const {data,error}=await sb.rpc('orbit_get_chunk',{p_world_id:activeWorldId,p_chunk_x:cx,p_chunk_y:cy});if(error){loadedChunkKeys.delete(key);return false}applyChunk(cx,cy,data);return true}
async function ensureNearbyChunks(){if(!activeWorldId)return false;const cx=Math.floor(player.x/T/16),cy=Math.floor(player.y/T/16),tasks=[];for(let y=Math.max(0,cy-1);y<=Math.min(5,cy+3);y++)for(let x=Math.max(0,cx-1);x<=Math.min(13,cx+3);x++)if(!loadedChunkKeys.has(x+','+y))tasks.push(loadOnlineChunk(x,y));if(tasks.length){const results=await Promise.all(tasks);return results.every(Boolean)}return true}
async function fetchAllPlayerInventoryRows(){
 if(!sb||!onlineUser)return {data:null,error:new Error('AUTH_REQUIRED')};
 const rows=[],pageSize=500;
 for(let offset=0;offset<50000;offset+=pageSize){
  const result=await sb.from('player_inventory').select('item_id,quantity').eq('user_id',onlineUser.id).order('item_id').range(offset,offset+pageSize-1);
  if(result.error)return {data:null,error:result.error};
  const page=result.data||[];rows.push(...page);
  if(page.length<pageSize)return {data:rows,error:null};
 }
 return {data:null,error:new Error('INVENTORY_PAGE_LIMIT')};
}
async function fetchCatalogRowsByIds(itemIds){
 const ids=[...new Set(itemIds)].filter(Boolean),rows=[],pageSize=100;
 for(let offset=0;offset<ids.length;offset+=pageSize){
  const result=await sb.from('item_catalog').select('item_id,display_name,category,rarity,stack_limit,is_placeable,is_tradeable,item_data').in('item_id',ids.slice(offset,offset+pageSize));
  if(result.error)return {data:null,error:result.error};
  rows.push(...(result.data||[]));
 }
 return {data:rows,error:null};
}
async function syncOnlineInventory(){
 if(!sb||!onlineUser)return false;
 const inventoryResult=await fetchAllPlayerInventoryRows();
 if(inventoryResult.error)return false;
 const inventoryRows=inventoryResult.data||[];
 const ids=[...new Set(['grass_block','soil_block','slate_block','starter_pickaxe',...inventoryRows.map(row=>row.item_id)])];
 const catalogResult=await fetchCatalogRowsByIds(ids);
 if(catalogResult.error)return false;
 (catalogResult.data||[]).forEach(row=>mergeCatalogRow(row,true));
 Object.keys(inv).forEach(k=>delete inv[k]);
 inventoryRows.forEach(row=>{const key=serverItemMap[row.item_id]||row.item_id;inv[key]=row.quantity});
 placeableItems.splice(0,placeableItems.length,...catalog.filter(item=>item.placeable===true&&validPlaceableTiles.includes(item.tile)&&(inv[item.id]||0)>0));
 selected=Math.max(0,Math.min(selected,Math.max(0,placeableItems.length-1)));
 renderHotbar();
 if(!$('#modal').classList.contains('hidden')&&$('#modal').classList.contains('inventory-mode'))renderInventory();
 return true;
}
async function syncOnlinePosition(){if(!sb||!onlineUser||!activeWorldId||positionSyncBusy||document.hidden)return false;const worldId=activeWorldId;const x=Math.max(0,Math.min(WW-1,Math.floor((player.x+player.w/2)/T))),y=Math.max(0,Math.min(WH-1,Math.floor((player.y+player.h/2)/T))),key=worldId+':'+x+','+y;if(key===lastPositionSyncKey)return true;positionSyncBusy=true;try{const {error}=await sb.rpc('orbit_update_position',{p_world_id:worldId,p_x:x,p_y:y});if(error){if(error.message!=='MOVEMENT_TOO_FAST')console.warn('position sync',error.message);return false}if(activeWorldId===worldId){lastPositionSyncKey=key;onlineSavedPosition={world_id:worldId,pos_x:x,pos_y:y}}return true}finally{positionSyncBusy=false}}

mineAt=function(px,py,delta=0){if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine||onlineActionBusy)return;const tx=Math.floor(px/T),ty=Math.floor(py/T);if(tx<0||tx>=WW||ty<0||ty>=WH){resetMining();return}if(map[ty]?.[tx]===8){if(!advanceMining(tx,ty,delta))return;onlineActionBusy=true;sb.rpc('orbit_harvest_crop',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty}).then(async({data,error})=>{if(error){resetMining();toast(error.message.includes('CROP_NOT_READY')?'Tanaman belum siap, tunggu sampai tumbuh':'Panen gagal: '+error.message);return}window.ORBITAudio?.play('harvest');spawnBlockParticles(tx,ty,map[ty][tx]);spawnBlockParticles(tx,ty,8);map[ty][tx]=0;window.ORBITAudio?.play('break');resetMining();applyProgress(data);await syncOnlineInventory();toast('Panen berhasil: +2 Glow Seed • +8 XP')}).finally(()=>onlineActionBusy=false);return}if(!map[ty]?.[tx]||!advanceMining(tx,ty,delta))return;onlineActionBusy=true;sb.rpc('orbit_mine_tile',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty}).then(async({data,error})=>{if(error){resetMining();const m=error.message||'';if(m.includes('TOO_FAR'))toast('Dekati blok dahulu');else if(m.includes('AREA_CLAIMED'))toast('Area ini dilindungi pemain lain');else if(m.includes('INVENTORY_LIMIT'))toast('Tas penuh • kosongkan ruang sebelum menambang');else if(m.includes('UNSUPPORTED_TILE'))toast('Jenis blok ini belum didukung');else if(m.includes('PLAYER_NOT_IN_WORLD')){onlineConnectionReady=false;toast('Sesi dunia terputus • sambungkan kembali')}else if(!m.includes('MINING_COOLDOWN'))toast('Tidak bisa menambang: '+m);return}map[ty][tx]=0;resetMining();applyProgress(data);await syncOnlineInventory()}).finally(()=>onlineActionBusy=false)};
placeAt=function(px,py){if(!onlineConnectionReady||!activeWorldId||!onlineUser||!navigator.onLine||onlineActionBusy)return;const tx=Math.floor(px/T),ty=Math.floor(py/T),item=placeableItems[selected],itemId=item?.serverId||({grass:'grass_block',dirt:'soil_block',stone:'slate_block'}[item?.id]);if(!itemId){toast('Pilih blok yang bisa dipasang');return}if(tx<0||tx>=WW||ty<0||ty>=WH){toast('Lokasi tidak valid');return}const overlaps=player.x<((tx+1)*T)&&player.x+player.w>(tx*T)&&player.y<((ty+1)*T)&&player.y+player.h>(ty*T);if(overlaps){toast('Tidak bisa memasang blok di tubuh pemain');return}onlineActionBusy=true;sb.rpc('orbit_place_tile',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty,p_item_id:itemId}).then(async({data,error})=>{if(error){const m=error.message||'';toast(m.includes('TOO_FAR')?'Dekati lokasi dahulu':m.includes('AREA_CLAIMED')?'Area ini dilindungi pemain lain':m.includes('TILE_OCCUPIED')?'Lokasi sudah terisi':m.includes('NOT_ENOUGH_ITEMS')?'Jumlah blok tidak cukup':m.includes('ITEM_NOT_PLACEABLE')?'Item ini tidak bisa dipasang':m.includes('PLAYER_NOT_IN_WORLD')?'Sesi dunia terputus • sambungkan kembali':'Tidak bisa memasang: '+m);if(m.includes('PLAYER_NOT_IN_WORLD'))onlineConnectionReady=false;return}map[ty][tx]=data.tile_id;window.ORBITAudio?.play('place');spawnBlockParticles(tx,ty,data.tile_id);await syncOnlineInventory()}).finally(()=>onlineActionBusy=false)};
async function refreshMarketPanel(content){
 if(!sb||!onlineUser){addText(content,'p','Login dahulu untuk memakai market.','panel-note');return}
 addText(content,'p','Jual dan beli item dari pemain lain. Semua pembayaran dan perpindahan item diproses oleh server.','panel-note');
 const [inventoryResult,listingRes]=await Promise.all([
  fetchAllPlayerInventoryRows(),
  sb.from('market_listings').select('id,seller_id,item_id,quantity,unit_price,currency,created_at').eq('status','active').order('created_at',{ascending:false}).range(0,39)
 ]);
 if(inventoryResult.error||listingRes.error){addText(content,'p','Market gagal dimuat. Periksa koneksi dan coba lagi.','panel-note');return}
 const inventory=inventoryResult.data||[],catalogResult=await fetchCatalogRowsByIds(inventory.map(x=>x.item_id));
 if(catalogResult.error){addText(content,'p','Katalog market gagal dimuat.','panel-note');return}
 const items=(catalogResult.data||[]).filter(x=>x.is_tradeable===true),itemNames=new Map(items.map(x=>[x.item_id,x.display_name]));
 let listings=listingRes.data||[],listingOffset=listings.length,hasMore=listings.length===40,loadingMore=false;
 addText(content,'p','📦 Pasang penjualan','panel-note');
 const select=document.createElement('select');select.className='world-input';
 const available=inventory.filter(x=>x.quantity>0&&itemNames.has(x.item_id));
 available.forEach(x=>{const o=document.createElement('option');o.value=x.item_id;o.textContent=(itemNames.get(x.item_id)||x.item_id)+' • '+x.quantity+' tersedia';select.append(o)});
 if(!available.length){const o=document.createElement('option');o.textContent='Belum ada item yang bisa dijual';select.append(o)}
 const qty=document.createElement('input');qty.className='world-input';qty.type='number';qty.min='1';qty.max='9999';qty.value='1';qty.placeholder='Jumlah item';
 const price=document.createElement('input');price.className='world-input';price.type='number';price.min='1';price.max='1000000000';price.value='10';price.placeholder='Harga per item';
 const currency=document.createElement('select');currency.className='world-input';[['coins','Coins'],['gems','Gems']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;currency.append(o)});
 const create=addText(content,'button','PASANG LISTING');create.className='primary';create.disabled=!available.length;
 create.onclick=async()=>{const q=Number(qty.value),p=Number(price.value);if(!Number.isInteger(q)||q<1||!Number.isSafeInteger(p)||p<1){toast('Jumlah dan harga harus valid');return}create.disabled=true;const {error}=await sb.rpc('orbit_create_listing',{p_item_id:select.value,p_quantity:q,p_unit_price:p,p_currency:currency.value});create.disabled=false;if(error){const m=error.message;toast(m.includes('INSUFFICIENT_ITEMS')?'Jumlah item tidak cukup':m.includes('LISTING_LIMIT')?'Maksimal 30 listing aktif':m.includes('LISTING_RATE_LIMIT')?'Tunggu sebentar sebelum memasang listing':'Gagal memasang: '+m);return}toast('Listing berhasil dipasang');await syncOnlineInventory();openPanel('market')};
 content.append(select,qty,price,currency,create);
 addText(content,'p','🛒 Listing aktif','panel-note');
 const search=document.createElement('input');search.type='search';search.className='world-input';search.placeholder='Cari item di market...';search.setAttribute('aria-label','Cari listing market');
 const listingContainer=document.createElement('div');content.append(search,listingContainer);
 const more=addText(content,'button','MUAT LEBIH BANYAK');more.className='secondary';more.hidden=!hasMore;
 const profileNames=new Map();
 const loadNames=async rows=>{const ids=[...new Set(rows.map(x=>x.seller_id).filter(id=>!profileNames.has(id)))];if(!ids.length)return;const p=await sb.rpc('orbit_get_public_profiles',{p_user_ids:ids});(p.data||[]).forEach(x=>profileNames.set(x.user_id,x.display_name))};
 const renderListings=()=>{
  const query=search.value.trim().toLocaleLowerCase();listingContainer.replaceChildren();
  const filtered=listings.filter(x=>(itemNames.get(x.item_id)||x.item_id).toLocaleLowerCase().includes(query));
  if(!filtered.length)addText(listingContainer,'p',listings.length?(query?'Tidak ada listing yang cocok.':'Belum ada penjualan aktif.'):'Belum ada penjualan aktif.','panel-note');
  filtered.forEach(listing=>{
   const row=document.createElement('div');row.className='panel-row';
   const label=document.createElement('span');label.textContent=(itemNames.get(listing.item_id)||listing.item_id)+' ×'+listing.quantity+' • '+listing.unit_price+' '+listing.currency+' / item • '+(profileNames.get(listing.seller_id)||'Explorer');
   const action=addText(row,'button',listing.seller_id===onlineUser.id?'BATAL':'BELI');
   action.onclick=async()=>{action.disabled=true;const {error}=await sb.rpc(listing.seller_id===onlineUser.id?'orbit_cancel_listing':'orbit_buy_listing',{p_listing_id:listing.id});action.disabled=false;if(error){const msg=error.message;toast(msg.includes('INSUFFICIENT_FUNDS')?'Saldo tidak cukup':msg.includes('INVENTORY_LIMIT')?'Inventaris penuh, kosongkan ruang dahulu':msg.includes('LISTING_UNAVAILABLE')?'Listing sudah tidak tersedia':'Transaksi gagal: '+msg);return}toast(listing.seller_id===onlineUser.id?'Listing dibatalkan':'Pembelian berhasil');await syncOnlineInventory();await loadProfile();openPanel('market')};
   row.prepend(label);listingContainer.append(row);
  });
  more.hidden=!hasMore;
 };
 await loadNames(listings);renderListings();
 search.addEventListener('input',renderListings);
 more.onclick=async()=>{if(loadingMore||!hasMore)return;loadingMore=true;more.disabled=true;more.textContent='MEMUAT…';const {data,error}=await sb.from('market_listings').select('id,seller_id,item_id,quantity,unit_price,currency,created_at').eq('status','active').order('created_at',{ascending:false}).range(listingOffset,listingOffset+39);loadingMore=false;more.disabled=false;more.textContent='MUAT LEBIH BANYAK';if(error){toast('Listing berikutnya gagal dimuat');return}const page=data||[],known=new Set(listings.map(x=>x.id));listings.push(...page.filter(x=>!known.has(x.id)));listingOffset+=page.length;hasMore=page.length===40;await loadNames(page);renderListings()};
}
const oldOpenPanel=openPanel;openPanel=function(name){if(name!=='worlds'&&name!=='social'&&name!=='market')return oldOpenPanel(name);if(name==='worlds'&&(!sb||!onlineUser)){name='social'}const modal=$('#modal'),title=$('#modal-title'),content=$('#modal-content');modal.classList.remove('hidden');content.replaceChildren();if(name==='social'){authPanel();return}if(name==='market'){title.textContent='🏪 ORBIT Market';refreshMarketPanel(content);return}title.textContent='🌍 World Gate';refreshWorldList(content)};
function initializeOnlineClient(){
 if(!window.supabase||!cfg?.supabaseUrl||!cfg?.supabaseKey)return;
 sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
 sb.auth.getSession().then(async({data,error})=>{if(error){toast('Online belum tersambung');return}onlineUser=data.session?.user||null;setAccountLabel();if(onlineUser)await loadProfile()}).catch(()=>toast('Gagal menyambung ke server'));
 sb.auth.onAuthStateChange(async(_event,session)=>{
  const nextUser=session?.user||null;
  if(onlineUser?.id!==nextUser?.id){
   if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}
   if(positionTimer){clearInterval(positionTimer);positionTimer=null}
   if(worldChannel){sb.removeChannel(worldChannel);worldChannel=null}
   onlineConnectionReady=false;activeWorldId=null;onlineSavedPosition=null;activeWorld='ONLINE';inv={};remotePlayers=[];
   $('#world-name').textContent=nextUser?'WORLD GATE':'LOGIN';$('#coins').textContent='0';
  }
  onlineUser=nextUser;setAccountLabel();
  if(onlineUser)await loadProfile();
  else{equippedTool='starter_pickaxe';toast('Login diperlukan untuk bermain online')}
 });
}
function loadOnlineSdk(){
 if(window.supabase){initializeOnlineClient();return}
 const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0';script.async=true;
 script.onload=initializeOnlineClient;script.onerror=()=>{onlineConnectionReady=false;toast('Layanan online tidak tersedia. ORBIT tidak dapat dimainkan tanpa server.')};
 document.head.append(script);
}
const orbitOpenPanelWithAudio=openPanel;openPanel=function(name){if(!onlineConnectionReady&&!['social','worlds','settings'].includes(name)){toast('Login dan masuk ke dunia online terlebih dahulu');name='social'}if(name==='worlds'&&!onlineUser)name='social';orbitOpenPanelWithAudio(name);if(name==='settings')window.ORBITAudio?.renderSettings($('#modal-content'))};
loadOnlineSdk();

})();