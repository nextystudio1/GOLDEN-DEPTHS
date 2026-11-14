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
let map=Array.from({length:WH},()=>Array(WW).fill(0)),inv=JSON.parse(localStorage.getItem('orbit_v2_inv')||'{}'),selected=0,tool='mine',cameraX=0,cameraY=0,screenW=1,screenH=1,last=0,toastTimer=0,coins=0;
const player={x:100,y:100,vx:0,vy:0,w:17,h:27,ground:false,face:1};const input={left:false,right:false,jump:false,mine:false};
let miningState={key:'',progress:0,tx:-1,ty:-1};
let equippedTool='starter_pickaxe';function mineDuration(tile){const base=({1:420,2:300,3:850,4:1150,5:1500,6:520,7:180,8:180})[tile]||650;const factor=({starter_pickaxe:1,stone_pickaxe:.88,copper_pickaxe:.72,crystal_pickaxe:.52})[equippedTool]||1;return Math.ceil(base*factor)}
function advanceMining(tx,ty,delta){const tile=map[ty]?.[tx];if(!tile)return false;const key=tx+','+ty;if(miningState.key!==key)miningState={key,progress:0,tx,ty};miningState.progress=Math.min(mineDuration(tile),miningState.progress+Math.max(0,delta));return miningState.progress>=mineDuration(tile)}
function resetMining(){miningState={key:'',progress:0,tx:-1,ty:-1}}let activeWorld='MEADOW-01',activeBiome='verdant',worlds=JSON.parse(localStorage.getItem('orbit_v2_worlds')||'["MEADOW-01"]');
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
function toast(t){const e=$('#toast');e.textContent=t;e.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.style.opacity=0,1500)}
function save(){const snapshot={map,inv,player:{x:player.x,y:player.y},coins,equippedTool};localStorage.setItem('orbit_v2_world_'+activeWorld,JSON.stringify(snapshot));localStorage.setItem('orbit_v2_map',JSON.stringify(map));localStorage.setItem('orbit_v2_inv',JSON.stringify(inv));localStorage.setItem('orbit_v2_player',JSON.stringify(snapshot.player));localStorage.setItem('orbit_v2_worlds',JSON.stringify(worlds));toast('Dunia tersimpan di perangkat')}
function load(){try{const saved=JSON.parse(localStorage.getItem('orbit_v2_world_'+activeWorld));if(saved?.map?.length===WH&&saved.map[0]?.length===WW){map=saved.map;inv=saved.inv||{};coins=Number(saved.coins)||0;equippedTool=saved.equippedTool||'starter_pickaxe';if(saved.player&&Number.isFinite(saved.player.x)&&Number.isFinite(saved.player.y))Object.assign(player,saved.player);return}if(activeWorld==='MEADOW-01'){const m=JSON.parse(localStorage.getItem('orbit_v2_map'));if(m?.length===WH&&m[0]?.length===WW)map=m;const oldInv=JSON.parse(localStorage.getItem('orbit_v2_inv')||'{}');if(oldInv&&typeof oldInv==='object')inv=oldInv;const p=JSON.parse(localStorage.getItem('orbit_v2_player'));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))Object.assign(player,p)}}catch{}}
function setSpawn(){const tx=Math.max(0,Math.min(WW-1,Math.floor((player.x+player.w/2)/T)));const surface=map.findIndex(row=>row[tx]===1);if(surface>0){player.y=surface*T-player.h;player.vy=0;player.ground=false}}
function switchLocalWorld(name){save();activeWorld=name;activeBiome='verdant';map=Array.from({length:WH},()=>Array(WW).fill(0));inv={};coins=0;equippedTool='starter_pickaxe';player.x=100;player.y=100;player.vx=0;player.vy=0;generate();setSpawn();load();$('#world-name').textContent=activeWorld;$('#coins').textContent=coins;renderHotbar();localStorage.setItem('orbit_v2_worlds',JSON.stringify(worlds));save();toast('Masuk ke '+name)}
function getItem(id){return catalog.find(x=>x.id===id)}
function addItem(id,n=1){const item=getItem(id),limit=item?.stack||999,current=inv[id]||0;if(current+n>limit){toast('Inventaris penuh');return false}inv[id]=current+n;renderHotbar();return true}
function renderHotbar(){const bar=$('#hotbar');bar.replaceChildren();catalog.slice(0,5).forEach((it,i)=>{let b=document.createElement('button');b.className='slot'+(i===selected?' selected':'');b.textContent=it.icon;let s=document.createElement('small');s.textContent=inv[it.id]||0;b.append(s);b.onclick=()=>{selected=i;renderHotbar()};bar.append(b)})}
function renderInventory(){let e=$('#modal-content');e.replaceChildren();let grid=document.createElement('div');grid.className='inventory-grid';catalog.forEach(it=>{let d=document.createElement('div');d.className='inventory-item';let b=document.createElement('b');b.textContent=it.icon;let n=document.createElement('strong');n.textContent=it.name;let q=document.createElement('div');q.textContent='× '+(inv[it.id]||0);d.append(b,n,q);grid.append(d)});e.append(grid);const gear=document.createElement('div');gear.className='panel-row';const label=document.createElement('span');label.textContent='Pilih alat tambang';const picker=document.createElement('select');picker.className='world-input';const tools=[['starter_pickaxe','Starter Pickaxe',true],['stone_pickaxe','Stone Pickaxe',!!(inv.stonepick>0)],['copper_pickaxe','Copper Pickaxe',!!(inv.pickaxe>0)],['crystal_pickaxe','Crystal Pickaxe',!!(inv.crystalpick>0)]];tools.filter(x=>x[2]).forEach(x=>{const o=document.createElement('option');o.value=x[0];o.textContent=x[1];picker.append(o)});picker.value=tools.some(x=>x[0]===equippedTool&&x[2])?equippedTool:'starter_pickaxe';const button=document.createElement('button');button.textContent='PAKAI';button.onclick=async()=>{const next=picker.value;if(activeWorldId&&onlineUser){button.disabled=true;const {error}=await sb.rpc('orbit_equip_tool',{p_item_id:next});button.disabled=false;if(error){toast('Gagal memasang alat: '+error.message);return}}else if(next!=='starter_pickaxe'&&!tools.some(x=>x[0]===next&&x[2])){toast('Alat belum dimiliki');return}equippedTool=next;if(!activeWorldId)save();renderInventory();toast('Alat berhasil dipasang')};gear.append(label,picker,button);e.append(gear)}
function openPanel(name){const modal=$('#modal'),title=$('#modal-title'),content=$('#modal-content');content.replaceChildren();modal.classList.remove('hidden');if(name==='inventory'){title.textContent='🎒 Backpack';renderInventory()}else if(name==='craft'){
 title.textContent='⚒ Workshop';
 const note=document.createElement('p');note.className='panel-note';note.textContent=activeWorldId?'Resep diproses aman oleh server.':'Resep mode lokal tersimpan di perangkat.';content.append(note);
 const recipes=[
  {id:'glow_seed',label:'Glow Seed ×2 • 4 Soil + 1 Wood',inputs:[['dirt',4],['wood',1]],output:'seed',amount:2},
  {id:'stone_pickaxe',label:'Stone Pickaxe ×1 • 12 Stone + 8 Wood',inputs:[['stone',12],['wood',8]],output:'stonepick',amount:1},
  {id:'copper_pickaxe',label:'Copper Pickaxe ×1 • 12 Copper + 8 Wood',inputs:[['copper',12],['wood',8]],output:'pickaxe',amount:1},
  {id:'crystal_pickaxe',label:'Crystal Pickaxe ×1 • 10 Crystal + 12 Wood',inputs:[['crystal',10],['wood',12]],output:'crystalpick',amount:1}
 ];
 recipes.forEach(recipe=>{
  const row=document.createElement('div');row.className='panel-row';
  const span=document.createElement('span');span.textContent=recipe.label;
  const btn=document.createElement('button');btn.textContent='BUAT';
  btn.onclick=async()=>{
   btn.disabled=true;
   if(activeWorldId&&onlineUser){
    const {data,error}=await sb.rpc('orbit_craft_item',{p_recipe_id:recipe.id});
    btn.disabled=false;
    if(error){toast(error.message.includes('MATERIALS_MISSING')?'Material belum cukup':error.message.includes('OUTPUT_STACK_LIMIT')?'Kapasitas item sudah penuh':'Craft gagal: '+error.message);return}
    await syncOnlineInventory();toast('Berhasil membuat '+({seed:'Glow Seed',stonepick:'Stone Pickaxe',pickaxe:'Copper Pickaxe',crystalpick:'Crystal Pickaxe'}[recipe.output]||'item'));openPanel('craft');return;
   }
   const outputItem=getItem(recipe.output);if((inv[recipe.output]||0)+recipe.amount>(outputItem?.stack||999)){btn.disabled=false;toast('Kapasitas item sudah penuh');return}const enough=recipe.inputs.every(([id,n])=>(inv[id]||0)>=n);
   if(!enough){btn.disabled=false;toast('Material belum cukup');return}
   recipe.inputs.forEach(([id,n])=>{inv[id]-=n});
   addItem(recipe.output,recipe.amount);save();btn.disabled=false;toast('Craft berhasil');openPanel('craft');
  };
  row.append(span,btn);content.append(row);
 });
  const farmRow=document.createElement('div');farmRow.className='panel-row';
  const farmLabel=document.createElement('span');farmLabel.textContent='🌱 Glow Seed Farm • tumbuh dalam 5 menit';
  const plant=document.createElement('button');plant.textContent='TANAM DI DEPAN';plant.disabled=!activeWorldId||!onlineUser;
  plant.onclick=async()=>{const tx=Math.floor((player.x+(player.face>0?player.w+5:-5))/T),ty=Math.floor((player.y+player.h-1)/T);plant.disabled=true;const {error}=await sb.rpc('orbit_plant_seed',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty});plant.disabled=false;if(error){const m=error.message;toast(m.includes('SEED_REQUIRED')?'Butuh Glow Seed':m.includes('NEEDS_SOIL')?'Tanam di atas rumput atau tanah':m.includes('TARGET_NOT_EMPTY')?'Tempat tanam terisi':'Gagal menanam: '+m);return}map[ty][tx]=8;await syncOnlineInventory();toast('Benih ditanam • siap dipanen dalam 5 menit')};
  farmRow.append(farmLabel,plant);content.append(farmRow);
 }else if(name==='worlds'){title.textContent='🌍 World Gate';let p=document.createElement('p');p.className='panel-note';p.textContent='Pilih dunia lokal atau buat dunia baru. Multiplayer online sedang dikembangkan.';content.append(p);worlds.forEach(w=>{let row=document.createElement('div');row.className='panel-row';let s=document.createElement('span');s.textContent='🌐 '+w;let b=document.createElement('button');b.textContent=w===activeWorld?'AKTIF':'MASUK';b.onclick=()=>{switchLocalWorld(w);$('#modal').classList.add('hidden')};row.append(s,b);content.append(row)});let input=document.createElement('input');input.className='world-input';input.maxLength=18;input.placeholder='Nama dunia baru';let create=document.createElement('button');create.className='primary';create.textContent='+ BUAT DUNIA';create.onclick=()=>{let n=input.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'-');if(n.length<3){toast('Nama minimal 3 karakter');return}if(worlds.includes(n)){toast('Nama dunia sudah ada');return}worlds.push(n);switchLocalWorld(n);openPanel('worlds')};content.append(input,create)}else if(name==='social'){title.textContent='👥 Social Hub';content.innerHTML='<p class="panel-note">Daftar pemain, chat, undangan world, dan trade langsung akan aktif setelah layanan multiplayer ORBIT selesai dipasang. Saat ini game berjalan dalam mode lokal.</p><div class="panel-row"><span>Player status</span><b>Solo Explorer</b></div><div class="panel-row"><span>Trade</span><b>Belum aktif</b></div>'}else{title.textContent='⚙ Settings';content.innerHTML='<p class="panel-note">ORBIT build awal • kontrol sentuh dan keyboard • penyimpanan lokal.</p>';let b=document.createElement('button');b.textContent='SIMPAN DUNIA';b.onclick=save;content.append(b)}}
function solid(x,y){return y>=WH||x<0||x>=WW||y<0?true:([1,2,3,4,5,6].includes(map[y][x]))}
function mineAt(px,py,delta=0){let tx=Math.floor(px/T),ty=Math.floor(py/T),id=map[ty]?.[tx];if(!id){resetMining();return}let dist=Math.hypot((tx+.5)*T-(player.x+8),(ty+.5)*T-(player.y+12));if(dist>T*4.6){resetMining();toast('Dekati blok dahulu');return}if(!advanceMining(tx,ty,delta))return;let item=({1:'grass',2:'dirt',3:'stone',4:'copper',5:'crystal',6:'wood',7:'wood'})[id];if(item&&(inv[item]||0)>=(getItem(item)?.stack||999)){resetMining();toast('Inventaris penuh');return}map[ty][tx]=0;resetMining();if(item){addItem(item);if(id===5)coins+=2;$('#coins').textContent=coins} }
function placeAt(px,py){let tx=Math.floor(px/T),ty=Math.floor(py/T);if(map[ty]?.[tx]!==0)return;let id=['grass','dirt','stone'][selected],tile=getItem(id);if(!tile){toast('Pilih blok yang bisa dipasang');return}if(!(inv[id]>0)){toast('Blok tidak tersedia');return}map[ty][tx]=tile.tile;inv[id]--;renderHotbar()}
function actionAt(e,delta=0){const r=canvas.getBoundingClientRect(),px=e.clientX-r.left+cameraX,py=e.clientY-r.top+cameraY;if(tool==='mine')mineAt(px,py,delta);else placeAt(px,py)}
let mining=false,mineTimer;canvas.addEventListener('pointerdown',e=>{e.preventDefault();mining=true;resetMining();actionAt(e);mineTimer=setInterval(()=>{if(mining&&tool==='mine')actionAt(e,50)},50)});['pointerup','pointercancel','pointerleave'].forEach(n=>canvas.addEventListener(n,()=>{mining=false;clearInterval(mineTimer);resetMining()}));
function bind(id,key){let e=$(id);e.addEventListener('pointerdown',v=>{v.preventDefault();input[key]=true;e.currentTarget.setPointerCapture(v.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(n=>e.addEventListener(n,()=>{input[key]=false;if(key==='mine')resetMining()}))}bind('#left','left');bind('#right','right');bind('#jump','jump');bind('#mine','mine');addEventListener('keydown',e=>{if(['a','ArrowLeft'].includes(e.key))input.left=true;if(['d','ArrowRight'].includes(e.key))input.right=true;if([' ','w','ArrowUp'].includes(e.key))input.jump=true;if(e.key==='e')openPanel('inventory')});addEventListener('keyup',e=>{if(['a','ArrowLeft'].includes(e.key))input.left=false;if(['d','ArrowRight'].includes(e.key))input.right=false;if([' ','w','ArrowUp'].includes(e.key))input.jump=false});
function drawTile(id,x,y,wx,wy){
 if(id===0)return;
 let colors={1:['#83d76b','#579f50','#347241'],2:['#bd8a5b','#94613f','#65432f'],3:['#a0afbb','#687d90','#43566a'],4:['#f0ad69','#b96b43','#713e35'],5:['#b5fff5','#5ed7dc','#2b8ca8'],6:['#c18a52','#80502f','#492e25'],7:['#9ce7a2','#4da97e','#246c65'],8:['#a7ec8b','#579f50','#347241']};
 const variants={frost:{1:['#f2fbff','#a9cbd8','#6d9daf'],2:['#c4d8df','#829eaa','#536f80'],7:['#e8fff9','#a6e5df','#5aabb1']},ember:{1:['#d98b61','#a84e42','#713b42'],2:['#a56d5b','#714b4a','#493342'],3:['#8a737b','#594c5e','#383247'],7:['#f2a36d','#c95f48','#8b3e43']},mystic:{1:['#b7a1e8','#7c69b5','#51477e'],2:['#9b83b6','#6b587f','#473956'],3:['#a0a2c4','#6b6d91','#414568'],7:['#a9e6c8','#6bbaaa','#477d83']},deep:{1:['#5daea7','#347d7b','#20545e'],2:['#6f777f','#4a5965','#303c4b'],3:['#788e9c','#4c6575','#2e465a'],7:['#7fd6c1','#3c9e91','#27636b']}};
 if(variants[activeBiome]?.[id])colors[id]=variants[activeBiome][id];
 const p=colors[id];if(!p)return;
 const seed=wx*97+wy*193,side=Math.max(2,T*.13),top=ctx.createLinearGradient(x,y,x+T,y+T);
 top.addColorStop(0,p[0]);top.addColorStop(.55,p[1]);top.addColorStop(1,p[2]);
 // Soft contact shadow and beveled right/bottom faces create a tactile 2.5D block.
 ctx.fillStyle='#101d2b35';ctx.fillRect(x+2,y+T-1,T-1,3);
 ctx.fillStyle=p[2];ctx.fillRect(x+T-side,y+side,side,T-side);
 ctx.fillStyle=p[1];ctx.fillRect(x,y,T-side,T-side);
 ctx.fillStyle=top;ctx.fillRect(x+1,y+1,T-side-1,T-side-1);
 ctx.fillStyle='#ffffff55';ctx.fillRect(x+1,y+1,T-side-2,Math.max(1,T*.09));ctx.fillRect(x+1,y+2,Math.max(1,T*.07),T-side-3);
 ctx.fillStyle='#17283b38';ctx.fillRect(x+1,y+T-side-1,T-side-2,2);ctx.fillRect(x+T-side-1,y+2,2,T-side-2);
 // Fine material grain, deterministic per tile so it does not flicker.
 for(let k=0;k<5;k++){const rx=Math.floor(rand(seed+k*17)*(T-7))+3,ry=Math.floor(rand(seed+k*29)*(T-8))+4;ctx.fillStyle=k%2?'#ffffff24':'#182b3a2b';ctx.fillRect(x+rx,y+ry,Math.max(1,T*.09),Math.max(1,T*.07))}
 if(id===1){ctx.fillStyle='#b8ef82';ctx.fillRect(x,y,T-side,2);ctx.fillStyle='#e7ffad';if(rand(wx*11+7)>.76){ctx.fillRect(x+5,y+5,2,3);ctx.fillRect(x+8,y+3,2,2)}}
 if(id===4){ctx.fillStyle='#6a3a2d';ctx.fillRect(x+6,y+9,7,8);ctx.fillStyle='#ffd49c';ctx.fillRect(x+7,y+8,5,7);ctx.fillStyle='#fff1c9';ctx.fillRect(x+8,y+9,2,3)}
 if(id===5){ctx.fillStyle='#1c667c';ctx.fillRect(x+8,y+7,7,12);ctx.fillStyle='#b9ffff';ctx.fillRect(x+10,y+5,3,12);ctx.fillRect(x+6,y+10,11,3);ctx.fillStyle='#ffffff77';ctx.fillRect(x+5,y+4,2,2);ctx.fillRect(x+17,y+14,2,2)}
 if(id===6){ctx.fillStyle='#4b3026';ctx.fillRect(x+8,y+7,7,13);ctx.fillStyle='#d39b62';ctx.fillRect(x+9,y+6,5,12);ctx.fillStyle='#f0c58a';ctx.fillRect(x+10,y+7,2,8)}
 if(id===7){ctx.fillStyle='#173f4c';ctx.fillRect(x+5,y+8,14,8);ctx.fillStyle='#d2ffad';ctx.fillRect(x+6,y+7,12,6);ctx.fillStyle='#f3ffe0';ctx.fillRect(x+9,y+6,4,3)}
 if(id===8){ctx.fillStyle='#397b4d';ctx.fillRect(x+10,y+8,4,12);ctx.fillStyle='#8de18a';ctx.fillRect(x+4,y+7,7,4);ctx.fillRect(x+13,y+4,7,4);ctx.fillStyle='#e8ff9a';ctx.fillRect(x+10,y+2,4,4)}
 ctx.strokeStyle='#10243838';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,T-side-1,T-side-1);
}
function drawMiningProgress(){if(!miningState.key||miningState.tx<0)return;const tile=map[miningState.ty]?.[miningState.tx];if(!tile)return;const x=miningState.tx*T-cameraX,y=miningState.ty*T-cameraY,p=Math.min(1,miningState.progress/mineDuration(tile));ctx.fillStyle='#091523b8';ctx.fillRect(x+2,y+T-7,T-4,5);ctx.fillStyle='#f6d47d';ctx.fillRect(x+2,y+T-7,(T-4)*p,5);ctx.strokeStyle='#fff1bf';ctx.lineWidth=1;ctx.strokeRect(x+2.5,y+T-6.5,T-5,4)}
function drawPlayer(x,y,remote=false){
 const t=performance.now()/120,walking=Math.abs(player.vx)>.15&&!remote,step=walking?Math.sin(t)*2.2:0,bob=walking?Math.abs(Math.sin(t))*1.5:0;
 ctx.save();ctx.translate(Math.round(x),Math.round(y-bob));
 // Contact shadow anchors the character to the terrain.
 ctx.fillStyle='#10233355';ctx.beginPath();ctx.ellipse(player.w/2,player.h+1,player.w*.62,3,0,0,Math.PI*2);ctx.fill();
 if(player.face<0){ctx.translate(player.w,0);ctx.scale(-1,1)}
 // Back arm and legs, with separate lit and shaded planes.
 const limb=ctx.createLinearGradient(0,17,0,29);limb.addColorStop(0,'#3f638b');limb.addColorStop(1,'#182d4a');
 ctx.fillStyle=limb;ctx.fillRect(2,17,5,9);ctx.fillRect(12,17,5,9);
 ctx.fillStyle='#101d33';ctx.fillRect(2,23+step,6,5-step);ctx.fillRect(11,23-step,6,5+step);
 ctx.fillStyle='#7292ad';ctx.fillRect(3,18,2,5);ctx.fillRect(13,18,2,5);
 const body=ctx.createLinearGradient(1,10,16,23);body.addColorStop(0,'#78b8dc');body.addColorStop(.38,'#356d9e');body.addColorStop(1,'#173b68');
 ctx.fillStyle='#13263d';ctx.fillRect(1,10,16,13);ctx.fillStyle=body;ctx.fillRect(2,11,13,10);
 ctx.fillStyle='#a5d8ed';ctx.fillRect(3,11,9,2);ctx.fillStyle='#21466e';ctx.fillRect(12,13,2,7);
 ctx.fillStyle='#e6b58f';ctx.fillRect(4,2,11,10);ctx.fillStyle='#f7d0a7';ctx.fillRect(5,3,8,7);ctx.fillStyle='#b77d68';ctx.fillRect(4,9,10,2);
 const hair=ctx.createLinearGradient(3,0,14,7);hair.addColorStop(0,'#8c6048');hair.addColorStop(.55,'#543b35');hair.addColorStop(1,'#2c2938');
 ctx.fillStyle=hair;ctx.fillRect(3,0,13,4);ctx.fillRect(3,2,3,5);ctx.fillRect(12,2,4,4);ctx.fillStyle='#c18b63';ctx.fillRect(6,0,5,1);
 ctx.fillStyle='#24334a';ctx.fillRect(11,5,2,2);ctx.fillStyle='#fff1cf';ctx.fillRect(12,5,1,1);
 ctx.fillStyle='#f1c77d';ctx.fillRect(15,13,4,3);ctx.fillStyle='#8a5d3d';ctx.fillRect(16,12,2,5);
 ctx.restore();
}
function frame(ts){let dt=Math.min((ts-last)/16.67||1,2);last=ts;if(input.mine&&tool==='mine'){const tx=player.x+(player.face>0?player.w+5:-5),ty=player.y+player.h*.58;mineAt(tx,ty,dt*16.67)}player.vx=((input.right?1:0)-(input.left?1:0))*2.5; if(player.vx)player.face=Math.sign(player.vx);if(input.jump&&player.ground){player.vy=-8.4;player.ground=false}player.vy=Math.min(10,player.vy+.38*dt);let nx=player.x+player.vx*dt;if(!solid(Math.floor((nx+(player.vx>0?player.w:0))/T),Math.floor((player.y+player.h-2)/T)))player.x=Math.max(0,Math.min(WW*T-player.w,nx));let ny=player.y+player.vy*dt;player.ground=false;if(player.vy>=0&&solid(Math.floor((player.x+player.w/2)/T),Math.floor((ny+player.h)/T))){player.y=Math.floor((ny+player.h)/T)*T-player.h;player.vy=0;player.ground=true}else if(player.vy<0&&solid(Math.floor((player.x+player.w/2)/T),Math.floor(ny/T))){player.y=Math.floor(ny/T+1)*T;player.vy=0}else player.y=ny;cameraX=Math.max(0,Math.min(WW*T-screenW,player.x-screenW*.46));cameraY=Math.max(0,Math.min(WH*T-screenH,player.y-screenH*.52));let sky=ctx.createLinearGradient(0,0,0,screenH);const skyColors=({frost:['#729eb9','#b9d9e5','#edf5ef'],ember:['#9e5c56','#d28a68','#eac39b'],mystic:['#625d91','#9c8fbd','#d5c4e3'],deep:['#244b63','#477e84','#93b6a8']})[activeBiome]||['#5d9fca','#a5d2d3','#e8d8a8'];sky.addColorStop(0,skyColors[0]);sky.addColorStop(.52,skyColors[1]);sky.addColorStop(1,skyColors[2]);ctx.fillStyle=sky;ctx.fillRect(0,0,screenW,screenH);ctx.fillStyle='#fff0bf';ctx.beginPath();ctx.arc(screenW*.78-cameraX*.025,screenH*.18,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff38';for(let i=0;i<5;i++){let cx=((i*211-cameraX*.16)%(screenW+180)+screenW+180)%(screenW+180)-90,cy=screenH*(.12+(i%3)*.1);ctx.fillRect(cx,cy,48,8);ctx.fillRect(cx+12,cy-7,28,8);ctx.fillRect(cx+34,cy+5,24,6)}for(let layer=0;layer<3;layer++){ctx.fillStyle=['#5e9e9a55','#467d8055','#345f6855'][layer];ctx.beginPath();ctx.moveTo(0,screenH*.68+layer*28);for(let x=0;x<=screenW+20;x+=20){let wx=x+cameraX*(.12+layer*.12);ctx.lineTo(x,screenH*.68+layer*28+Math.sin(wx*.009+layer*2)*18+Math.sin(wx*.021)*8)}ctx.lineTo(screenW,screenH);ctx.lineTo(0,screenH);ctx.closePath();ctx.fill()}let sx=Math.floor(cameraX/T),sy=Math.floor(cameraY/T),ex=Math.min(WW,sx+Math.ceil(screenW/T)+2),ey=Math.min(WH,sy+Math.ceil(screenH/T)+2);for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)drawTile(map[y][x],x*T-cameraX,y*T-cameraY,x,y);drawMiningProgress();remotePlayers.forEach(p=>drawPlayer(p.x*T-cameraX,p.y*T-cameraY,true));drawPlayer(player.x-cameraX,player.y-cameraY);$('#coords').textContent='X: '+Math.floor(player.x/T)+' • Y: '+Math.floor(player.y/T);requestAnimationFrame(frame)}
$('#modal-close').onclick=()=>$('#modal').classList.add('hidden');document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));$('#menu-button').onclick=()=>openPanel('settings');$('#mine').onclick=()=>{tool='mine';toast('Mode menambang')};$('#place').onclick=()=>{tool='place';resetMining();toast('Mode memasang blok')};generate();setSpawn();load();renderHotbar();$('#world-name').textContent=activeWorld;$('#coins').textContent=coins;requestAnimationFrame(frame);setInterval(()=>{localStorage.setItem('orbit_v2_world_'+activeWorld,JSON.stringify({map,inv,player:{x:player.x,y:player.y},coins,equippedTool}));localStorage.setItem('orbit_v2_inv',JSON.stringify(inv));localStorage.setItem('orbit_v2_player',JSON.stringify({x:player.x,y:player.y}))},5000);addEventListener('pagehide',()=>{localStorage.setItem('orbit_v2_world_'+activeWorld,JSON.stringify({map,inv,player:{x:player.x,y:player.y},coins,equippedTool}));localStorage.setItem('orbit_v2_map',JSON.stringify(map));localStorage.setItem('orbit_v2_inv',JSON.stringify(inv))});

let sb=null,onlineUser=null,activeWorldId=null,worldChannel=null,onlineSaveTimers=new Map(),remotePlayers=[],presenceTimer=null,playerDisplayName='Explorer',loadedChunkKeys=new Set(),positionTimer=null,onlineActionBusy=false;
let chatFeed=[],chatFeedElement=null;
const cfg=window.ORBIT_CONFIG;
function addText(parent,tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el}
function setAccountLabel(){const b=$('#world-name');if(onlineUser)b.title='Login: '+onlineUser.email;else b.title='Mode lokal'}
async function loadProfile(){if(!sb||!onlineUser)return;const {error:ensureError}=await sb.rpc('orbit_ensure_profile',{p_display_name:onlineUser.user_metadata?.display_name||'Explorer'});if(ensureError){toast('Profil gagal disiapkan: '+ensureError.message);return}const {data,error}=await sb.from('player_profiles').select('display_name,level,experience,coins,gems,equipped_tool').eq('user_id',onlineUser.id).maybeSingle();if(error){toast('Profil belum dapat dimuat');return}if(data){applyProgress(data);$('#coins').textContent=data.coins;coins=data.coins;playerDisplayName=data.display_name||'Explorer';equippedTool=data.equipped_tool||'starter_pickaxe'}}
function applyProgress(data){if(!data)return;const nextLevel=Math.max(1,Number(data.level)||1),previous=Number($('#level').textContent)||1;$('#level').textContent=nextLevel;const xp=Number(data.experience)||0;const xpLabel=$('#xp');if(xpLabel)xpLabel.textContent=xp+'/'+(nextLevel*nextLevel*100)+' XP';if(nextLevel>previous)toast('Level naik! Sekarang Lv '+nextLevel)}
function renderChatFeed(){if(!chatFeedElement)return;chatFeedElement.replaceChildren();chatFeed.slice(-40).forEach(m=>{const row=document.createElement('div');row.className='chat-message';const head=document.createElement('b');head.textContent=m.display_name||'Explorer';const body=document.createElement('span');body.textContent=m.body||'';const time=document.createElement('small');time.textContent=new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});row.append(head,body,time);chatFeedElement.append(row)});chatFeedElement.scrollTop=chatFeedElement.scrollHeight}
function appendChatMessage(m){if(!m||chatFeed.some(x=>String(x.id)===String(m.id)))return;chatFeed.push(m);chatFeed=chatFeed.slice(-60);renderChatFeed()}
async function loadWorldChat(){if(!activeWorldId||!sb)return;const {data,error}=await sb.from('world_chat_messages').select('id,display_name,body,created_at').eq('world_id',activeWorldId).order('created_at',{ascending:true}).limit(40);if(error){toast('Chat gagal dimuat: '+error.message);return}chatFeed=data||[];renderChatFeed()}
async function renderTradePanel(content){
 if(!activeWorldId||!onlineUser)return;
 addText(content,'p','🤝 Pemain di dunia','panel-note');
 if(!remotePlayers.length)addText(content,'p','Belum ada pemain lain yang terdeteksi di dunia ini.','panel-note');
 remotePlayers.forEach(p=>{
  const row=document.createElement('div');row.className='panel-row';
  const label=document.createElement('span');label.textContent=(p.display_name||'Explorer')+' • X '+p.x+' Y '+p.y;
  const request=addText(row,'button','AJAK TRADE');
  request.onclick=async()=>{request.disabled=true;const {error}=await sb.rpc('orbit_create_trade',{p_receiver_id:p.user_id});request.disabled=false;if(error){const m=error.message;toast(m.includes('PLAYER_TOO_FAR')?'Pemain terlalu jauh':m.includes('PLAYER_NOT_ACTIVE')?'Pemain tidak aktif':m.includes('TRADE_ALREADY_PENDING')?'Permintaan trade sudah ada':m.includes('TRADE_RATE_LIMIT')?'Tunggu sebentar sebelum mengirim permintaan lain':'Gagal mengajak trade: '+m);return}toast('Permintaan trade dikirim');openPanel('social')};
  row.prepend(label);content.append(row);
 });
 const {data:trades,error}=await sb.from('player_trades').select('id,sender_id,receiver_id,status,sender_offer,receiver_offer,expires_at').eq('status','pending').or('sender_id.eq.'+onlineUser.id+',receiver_id.eq.'+onlineUser.id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(20);
 if(error){addText(content,'p','Daftar trade gagal dimuat.','panel-note');return}
 addText(content,'p','📨 Permintaan & penawaran trade','panel-note');
 if(!trades?.length)addText(content,'p','Belum ada permintaan trade aktif.','panel-note');
 const otherIds=[...new Set((trades||[]).map(t=>t.sender_id===onlineUser.id?t.receiver_id:t.sender_id))];
 let names=new Map();
 if(otherIds.length){const p=await sb.rpc('orbit_get_public_profiles',{p_user_ids:otherIds});names=new Map((p.data||[]).map(x=>[x.user_id,x.display_name]))}
 const [itemRes,invRes]=await Promise.all([sb.from('item_catalog').select('item_id,display_name').eq('is_tradeable',true),sb.from('player_inventory').select('item_id,quantity').eq('user_id',onlineUser.id)]);
 const tradeItems=itemRes.data||[],owned=(invRes.data||[]).filter(x=>x.quantity>0&&tradeItems.some(i=>i.item_id===x.item_id));
 const itemNames=new Map(tradeItems.map(i=>[i.item_id,i.display_name]));
 const offerText=offer=>(offer||[]).map(x=>(itemNames.get(x.item_id)||x.item_id)+' ×'+x.quantity).join(', ')||'Kosong';
 (trades||[]).forEach(t=>{
  const incoming=t.receiver_id===onlineUser.id,other=incoming?t.sender_id:t.receiver_id;
  const card=document.createElement('div');card.className='panel-row';card.style.display='block';
  addText(card,'b',(incoming?'Dari ':'Kepada ')+(names.get(other)||'Explorer'),'');
  addText(card,'div','Tawaran mereka: '+offerText(incoming?t.sender_offer:t.receiver_offer));
  addText(card,'div','Tawaran kamu: '+offerText(incoming?t.receiver_offer:t.sender_offer));
  const select=document.createElement('select');select.className='world-input';
  owned.forEach(it=>{const o=document.createElement('option');o.value=it.item_id;o.textContent=(itemNames.get(it.item_id)||it.item_id)+' • '+it.quantity;select.append(o)});
  if(!owned.length){const o=document.createElement('option');o.textContent='Tidak ada item untuk ditawarkan';select.append(o)}
  const quantity=document.createElement('input');quantity.className='world-input';quantity.type='number';quantity.min='1';quantity.max='999';quantity.value='1';
  const offerButton=addText(card,'button','KIRIM TAWARAN');offerButton.disabled=!owned.length;
  offerButton.onclick=async()=>{const q=Number(quantity.value);if(!Number.isInteger(q)||q<1){toast('Jumlah tidak valid');return}offerButton.disabled=true;const {error}=await sb.rpc('orbit_set_trade_offer',{p_trade_id:t.id,p_offer:[{item_id:select.value,quantity:q}]});offerButton.disabled=false;if(error){toast(error.message.includes('INSUFFICIENT_TRADE_ITEMS')?'Jumlah item tidak cukup':'Tawaran gagal: '+error.message);return}toast('Tawaran diperbarui');openPanel('social')};
  card.append(select,quantity,offerButton);
  if(incoming){const accept=addText(card,'button','TERIMA TRADE');accept.style.marginLeft='6px';accept.onclick=async()=>{accept.disabled=true;const {error}=await sb.rpc('orbit_accept_trade',{p_trade_id:t.id});accept.disabled=false;if(error){const m=error.message;toast(m.includes('BOTH_OFFERS_REQUIRED')?'Kedua pemain harus mengirim tawaran':m.includes('TRADE_INVENTORY_LIMIT')?'Inventaris salah satu pemain penuh':m.includes('TRADE_ITEMS_CHANGED')?'Item berubah, perbarui tawaran':'Trade gagal: '+m);return}toast('Trade berhasil');await syncOnlineInventory();openPanel('social')}}
  const decline=addText(card,'button','TOLAK');decline.style.marginLeft='6px';decline.onclick=async()=>{const {error}=await sb.rpc('orbit_decline_trade',{p_trade_id:t.id});if(error)toast('Gagal menolak trade');else{toast('Trade ditolak');openPanel('social')}};
  content.append(card);
 });
}
function authPanel(){const title=$('#modal-title'),content=$('#modal-content');title.textContent='👥 Akun & Sosial';content.replaceChildren();chatFeedElement=null;if(!sb){addText(content,'p','Layanan online belum tersambung. Periksa koneksi internet.','panel-note');return}
 if(onlineUser){
  addText(content,'p','Login sebagai '+onlineUser.email,'panel-note');
  const status=addText(content,'div','Akun aktif • ID '+onlineUser.id.slice(0,8),'panel-row');
  if(activeWorldId){
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
 const login=addText(content,'button','MASUK');login.className='primary';login.onclick=async()=>{if(!email.value||!pass.value){toast('Isi email dan password');return}login.disabled=true;const {error}=await sb.auth.signInWithPassword({email:email.value.trim(),password:pass.value});login.disabled=false;if(error)toast('Login gagal: '+error.message);else{toast('Login berhasil');openPanel('worlds')}};
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
async function enterOnlineWorld(w){activeWorldId=w.id;activeWorld=w.name;activeBiome=w.biome||'verdant';$('#world-name').textContent=w.name;$('#modal').classList.add('hidden');toast('Memuat dunia online…');if(worldChannel){await sb.removeChannel(worldChannel);worldChannel=null}if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}if(positionTimer){clearInterval(positionTimer);positionTimer=null}remotePlayers=[];chatFeed=[];chatFeedElement=null;map=Array.from({length:WH},()=>Array(WW).fill(0));resetMining();
 loadedChunkKeys=new Set();const initial=[];for(let cy=0;cy<4;cy++)for(let cx=0;cx<4;cx++)initial.push(loadOnlineChunk(cx,cy));const results=await Promise.all(initial);if(results.some(x=>!x))toast('Sebagian area dunia belum termuat');const surface=map.findIndex(row=>row[Math.floor(player.x/T)]===1);if(surface>0){player.y=surface*T-player.h;player.vy=0;player.ground=false}await syncOnlineInventory();await syncOnlinePosition();
 await sb.realtime.setAuth();worldChannel=sb.channel('orbit-world:'+w.id,{config:{private:true,presence:{key:onlineUser.id}}}).on('presence',{event:'sync'},()=>{const state=worldChannel.presenceState();remotePlayers=Object.entries(state).filter(([id])=>id!==onlineUser.id).flatMap(([id,metas])=>metas.map(p=>({...p,user_id:id}))).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))}).on('postgres_changes',{event:'*',schema:'public',table:'world_chunks',filter:'world_id=eq.'+w.id},payload=>{const row=payload.new;if(row?.tile_data)applyChunk(row.chunk_x,row.chunk_y,row.tile_data)}).on('postgres_changes',{event:'INSERT',schema:'public',table:'world_chat_messages',filter:'world_id=eq.'+w.id},payload=>appendChatMessage(payload.new)).on('postgres_changes',{event:'*',schema:'public',table:'player_trades',filter:'receiver_id=eq.'+onlineUser.id},()=>{if(!$('#modal').classList.contains('hidden')&&$('#modal-title').textContent.includes('Akun'))openPanel('social')}).on('postgres_changes',{event:'*',schema:'public',table:'player_trades',filter:'sender_id=eq.'+onlineUser.id},()=>{if(!$('#modal').classList.contains('hidden')&&$('#modal-title').textContent.includes('Akun'))openPanel('social')}).subscribe(async status=>{if(status==='SUBSCRIBED'){await worldChannel.track({x:Math.floor(player.x/T),y:Math.floor(player.y/T),display_name:playerDisplayName})}});presenceTimer=setInterval(()=>{if(worldChannel&&onlineUser){worldChannel.track({x:Math.floor((player.x+player.w/2)/T),y:Math.floor((player.y+player.h/2)/T),display_name:playerDisplayName}).catch(()=>{});syncOnlinePosition();ensureNearbyChunks()}},1200);
 toast('Online: '+w.name);
}
function applyChunk(cx,cy,data){const tiles=data?.tiles;if(!Array.isArray(tiles))return;for(let y=0;y<16;y++)for(let x=0;x<16;x++){const wy=cy*16+y,wx=cx*16+x;if(map[wy]&&Number.isInteger(tiles[y]?.[x]))map[wy][wx]=tiles[y][x]}}
async function loadOnlineChunk(cx,cy){if(!sb||!activeWorldId||cx<0||cx>13||cy<0||cy>5)return false;const key=cx+','+cy;if(loadedChunkKeys.has(key))return true;loadedChunkKeys.add(key);const {data,error}=await sb.rpc('orbit_get_chunk',{p_world_id:activeWorldId,p_chunk_x:cx,p_chunk_y:cy});if(error){loadedChunkKeys.delete(key);return false}applyChunk(cx,cy,data);return true}
async function ensureNearbyChunks(){if(!activeWorldId)return;const cx=Math.floor(player.x/T/16),cy=Math.floor(player.y/T/16),tasks=[];for(let y=Math.max(0,cy-1);y<=Math.min(5,cy+3);y++)for(let x=Math.max(0,cx-1);x<=Math.min(13,cx+3);x++)if(!loadedChunkKeys.has(x+','+y))tasks.push(loadOnlineChunk(x,y));if(tasks.length)await Promise.all(tasks)}
async function syncOnlineInventory(){if(!sb||!onlineUser)return;const {data,error}=await sb.from('player_inventory').select('item_id,quantity').eq('user_id',onlineUser.id);if(error)return;const mapIds={grass_block:'grass',soil_block:'dirt',slate_block:'stone',copper_ore:'copper',sky_crystal:'crystal',amber_wood:'wood',glow_seed:'seed',copper_pickaxe:'pickaxe',stone_pickaxe:'stonepick',crystal_pickaxe:'crystalpick'};Object.keys(inv).forEach(k=>inv[k]=0);(data||[]).forEach(r=>{const k=mapIds[r.item_id];if(k)inv[k]=r.quantity});renderHotbar()}
async function syncOnlinePosition(){if(!sb||!onlineUser||!activeWorldId)return;const x=Math.floor((player.x+player.w/2)/T),y=Math.floor((player.y+player.h/2)/T);const {error}=await sb.rpc('orbit_update_position',{p_world_id:activeWorldId,p_x:x,p_y:y});if(error&&error.message!=='MOVEMENT_TOO_FAST')console.warn('position sync',error.message)}

const oldMineAt=mineAt;mineAt=function(px,py,delta=0){if(!activeWorldId){oldMineAt(px,py,delta);return}if(onlineActionBusy)return;const tx=Math.floor(px/T),ty=Math.floor(py/T);if(tx<0||tx>=WW||ty<0||ty>=WH){resetMining();return}if(map[ty]?.[tx]===8){if(!advanceMining(tx,ty,delta))return;onlineActionBusy=true;sb.rpc('orbit_harvest_crop',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty}).then(async({data,error})=>{if(error){resetMining();toast(error.message.includes('CROP_NOT_READY')?'Tanaman belum siap, tunggu sampai tumbuh':'Panen gagal: '+error.message);return}map[ty][tx]=0;resetMining();applyProgress(data);await syncOnlineInventory();toast('Panen berhasil: +2 Glow Seed • +8 XP')}).finally(()=>onlineActionBusy=false);return}if(!map[ty]?.[tx]||!advanceMining(tx,ty,delta))return;onlineActionBusy=true;sb.rpc('orbit_mine_tile',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty}).then(async({data,error})=>{if(error){resetMining();if(error.message.includes('TOO_FAR'))toast('Dekati blok dahulu');else if(!error.message.includes('MINING_COOLDOWN'))toast('Tidak bisa menambang: '+error.message);return}map[ty][tx]=0;resetMining();applyProgress(data);await syncOnlineInventory()}).finally(()=>onlineActionBusy=false)};
const oldPlaceAt=placeAt;placeAt=function(px,py){if(!activeWorldId){oldPlaceAt(px,py);return}if(onlineActionBusy)return;const tx=Math.floor(px/T),ty=Math.floor(py/T),items=['grass_block','soil_block','slate_block'];if(selected>2){toast('Item ini belum bisa dipasang');return}onlineActionBusy=true;sb.rpc('orbit_place_tile',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty,p_item_id:items[selected]}).then(async({data,error})=>{if(error){toast(error.message.includes('TOO_FAR')?'Dekati lokasi dahulu':'Tidak bisa memasang: '+error.message);return}map[ty][tx]=data.tile_id;await syncOnlineInventory()}).finally(()=>onlineActionBusy=false)};
async function refreshMarketPanel(content){
 if(!sb||!onlineUser){addText(content,'p','Login dahulu untuk memakai market.','panel-note');return}
 addText(content,'p','Jual dan beli item dari pemain lain. Semua pembayaran dan perpindahan item diproses oleh server.','panel-note');
 const [itemRes,invRes,listingRes]=await Promise.all([
  sb.from('item_catalog').select('item_id,display_name,stack_limit').eq('is_tradeable',true).order('display_name'),
  sb.from('player_inventory').select('item_id,quantity').eq('user_id',onlineUser.id),
  sb.from('market_listings').select('id,seller_id,item_id,quantity,unit_price,currency,created_at').eq('status','active').order('created_at',{ascending:false}).limit(40)
 ]);
 if(itemRes.error||invRes.error||listingRes.error){addText(content,'p','Market gagal dimuat. Periksa koneksi dan coba lagi.','panel-note');return}
 const items=itemRes.data||[],inventory=invRes.data||[],listings=listingRes.data||[];
 const itemNames=new Map(items.map(x=>[x.item_id,x.display_name]));
 const profileIds=[...new Set(listings.map(x=>x.seller_id))];
 let profiles=[];
 if(profileIds.length){const p=await sb.rpc('orbit_get_public_profiles',{p_user_ids:profileIds});profiles=p.data||[]}
 const profileNames=new Map(profiles.map(x=>[x.user_id,x.display_name]));
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
 if(!listings.length)addText(content,'p','Belum ada penjualan aktif.','panel-note');
 listings.forEach(listing=>{
  const row=document.createElement('div');row.className='panel-row';
  const label=document.createElement('span');label.textContent=(itemNames.get(listing.item_id)||listing.item_id)+' ×'+listing.quantity+' • '+listing.unit_price+' '+listing.currency+' / item • '+(profileNames.get(listing.seller_id)||'Explorer');
  const action=addText(row,'button',listing.seller_id===onlineUser.id?'BATAL':'BELI');
  action.onclick=async()=>{action.disabled=true;const {error}=await sb.rpc(listing.seller_id===onlineUser.id?'orbit_cancel_listing':'orbit_buy_listing',listing.seller_id===onlineUser.id?{p_listing_id:listing.id}:{p_listing_id:listing.id});action.disabled=false;if(error){const msg=error.message;toast(msg.includes('INSUFFICIENT_FUNDS')?'Saldo tidak cukup':msg.includes('INVENTORY_LIMIT')?'Inventaris penuh, kosongkan ruang dahulu':msg.includes('LISTING_UNAVAILABLE')?'Listing sudah tidak tersedia':'Transaksi gagal: '+msg);return}toast(listing.seller_id===onlineUser.id?'Listing dibatalkan':'Pembelian berhasil');await syncOnlineInventory();await loadProfile();openPanel('market')};
  row.prepend(label);content.append(row);
 });
}
const oldOpenPanel=openPanel;openPanel=function(name){if(name!=='worlds'&&name!=='social'&&name!=='market')return oldOpenPanel(name);const modal=$('#modal'),title=$('#modal-title'),content=$('#modal-content');modal.classList.remove('hidden');content.replaceChildren();if(name==='social'){authPanel();return}if(name==='market'){title.textContent='🏪 ORBIT Market';refreshMarketPanel(content);return}title.textContent='🌍 World Gate';refreshWorldList(content)};
if(window.supabase&&cfg?.supabaseUrl&&cfg?.supabaseKey){sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);sb.auth.getSession().then(async({data,error})=>{if(error){toast('Online belum tersambung');return}onlineUser=data.session?.user||null;setAccountLabel();if(onlineUser)await loadProfile()}).catch(()=>toast('Gagal menyambung ke server'));sb.auth.onAuthStateChange(async(_event,session)=>{onlineUser=session?.user||null;setAccountLabel();if(onlineUser)await loadProfile();else{activeWorldId=null;equippedTool='starter_pickaxe';if(worldChannel){sb.removeChannel(worldChannel);worldChannel=null}}})}

})();