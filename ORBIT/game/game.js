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
{id:'pickaxe',name:'Copper Pickaxe',icon:'⛏️',tile:0,stack:1,desc:'Peralatan tambang tembaga.'}
];
let map=Array.from({length:WH},()=>Array(WW).fill(0)),inv=JSON.parse(localStorage.getItem('orbit_v2_inv')||'{}'),selected=0,tool='mine',cameraX=0,cameraY=0,screenW=1,screenH=1,last=0,toastTimer=0,coins=0;
const player={x:100,y:100,vx:0,vy:0,w:17,h:27,ground:false,face:1};const input={left:false,right:false,jump:false,mine:false};
let miningState={key:'',progress:0,tx:-1,ty:-1};
function mineDuration(tile){return ({1:420,2:300,3:850,4:1150,5:1500,6:520,7:180})[tile]||650}
function advanceMining(tx,ty,delta){const tile=map[ty]?.[tx];if(!tile)return false;const key=tx+','+ty;if(miningState.key!==key)miningState={key,progress:0,tx,ty};miningState.progress=Math.min(mineDuration(tile),miningState.progress+Math.max(0,delta));return miningState.progress>=mineDuration(tile)}
function resetMining(){miningState={key:'',progress:0,tx:-1,ty:-1}}let activeWorld='MEADOW-01',worlds=JSON.parse(localStorage.getItem('orbit_v2_worlds')||'["MEADOW-01"]');
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
function save(){const snapshot={map,inv,player:{x:player.x,y:player.y},coins};localStorage.setItem('orbit_v2_world_'+activeWorld,JSON.stringify(snapshot));localStorage.setItem('orbit_v2_map',JSON.stringify(map));localStorage.setItem('orbit_v2_inv',JSON.stringify(inv));localStorage.setItem('orbit_v2_player',JSON.stringify(snapshot.player));localStorage.setItem('orbit_v2_worlds',JSON.stringify(worlds));toast('Dunia tersimpan di perangkat')}
function load(){try{const saved=JSON.parse(localStorage.getItem('orbit_v2_world_'+activeWorld));if(saved?.map?.length===WH&&saved.map[0]?.length===WW){map=saved.map;inv=saved.inv||{};coins=Number(saved.coins)||0;if(saved.player&&Number.isFinite(saved.player.x)&&Number.isFinite(saved.player.y))Object.assign(player,saved.player);return}if(activeWorld==='MEADOW-01'){const m=JSON.parse(localStorage.getItem('orbit_v2_map'));if(m?.length===WH&&m[0]?.length===WW)map=m;const oldInv=JSON.parse(localStorage.getItem('orbit_v2_inv')||'{}');if(oldInv&&typeof oldInv==='object')inv=oldInv;const p=JSON.parse(localStorage.getItem('orbit_v2_player'));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))Object.assign(player,p)}}catch{}}
function setSpawn(){const tx=Math.max(0,Math.min(WW-1,Math.floor((player.x+player.w/2)/T)));const surface=map.findIndex(row=>row[tx]===1);if(surface>0){player.y=surface*T-player.h;player.vy=0;player.ground=false}}
function switchLocalWorld(name){save();activeWorld=name;map=Array.from({length:WH},()=>Array(WW).fill(0));inv={};coins=0;player.x=100;player.y=100;player.vx=0;player.vy=0;generate();setSpawn();load();$('#world-name').textContent=activeWorld;$('#coins').textContent=coins;renderHotbar();localStorage.setItem('orbit_v2_worlds',JSON.stringify(worlds));save();toast('Masuk ke '+name)}
function getItem(id){return catalog.find(x=>x.id===id)}
function addItem(id,n=1){inv[id]=(inv[id]||0)+n;renderHotbar()}
function renderHotbar(){const bar=$('#hotbar');bar.replaceChildren();catalog.slice(0,5).forEach((it,i)=>{let b=document.createElement('button');b.className='slot'+(i===selected?' selected':'');b.textContent=it.icon;let s=document.createElement('small');s.textContent=inv[it.id]||0;b.append(s);b.onclick=()=>{selected=i;renderHotbar()};bar.append(b)})}
function renderInventory(){let e=$('#modal-content');e.replaceChildren();let grid=document.createElement('div');grid.className='inventory-grid';catalog.forEach(it=>{let d=document.createElement('div');d.className='inventory-item';let b=document.createElement('b');b.textContent=it.icon;let n=document.createElement('strong');n.textContent=it.name;let q=document.createElement('div');q.textContent='× '+(inv[it.id]||0);d.append(b,n,q);grid.append(d)});e.append(grid)}
function openPanel(name){const modal=$('#modal'),title=$('#modal-title'),content=$('#modal-content');content.replaceChildren();modal.classList.remove('hidden');if(name==='inventory'){title.textContent='🎒 Backpack';renderInventory()}else if(name==='craft'){
 title.textContent='⚒ Workshop';
 const note=document.createElement('p');note.className='panel-note';note.textContent=activeWorldId?'Resep diproses aman oleh server.':'Resep mode lokal tersimpan di perangkat.';content.append(note);
 const recipes=[
  {id:'glow_seed',label:'Glow Seed ×2 • 4 Soil + 1 Wood',inputs:[['dirt',4],['wood',1]],output:'seed',amount:2},
  {id:'copper_pickaxe',label:'Copper Pickaxe ×1 • 12 Copper + 8 Wood',inputs:[['copper',12],['wood',8]],output:'pickaxe',amount:1}
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
    if(error){toast(error.message.includes('MATERIALS_MISSING')?'Material belum cukup':'Craft gagal: '+error.message);return}
    await syncOnlineInventory();toast('Berhasil membuat '+(recipe.output==='seed'?'Glow Seed':'Copper Pickaxe'));openPanel('craft');return;
   }
   const enough=recipe.inputs.every(([id,n])=>(inv[id]||0)>=n);
   if(!enough){btn.disabled=false;toast('Material belum cukup');return}
   recipe.inputs.forEach(([id,n])=>{inv[id]-=n});
   addItem(recipe.output,recipe.amount);save();btn.disabled=false;toast('Craft berhasil');openPanel('craft');
  };
  row.append(span,btn);content.append(row);
 });
 }else if(name==='worlds'){title.textContent='🌍 World Gate';let p=document.createElement('p');p.className='panel-note';p.textContent='Pilih dunia lokal atau buat dunia baru. Multiplayer online sedang dikembangkan.';content.append(p);worlds.forEach(w=>{let row=document.createElement('div');row.className='panel-row';let s=document.createElement('span');s.textContent='🌐 '+w;let b=document.createElement('button');b.textContent=w===activeWorld?'AKTIF':'MASUK';b.onclick=()=>{switchLocalWorld(w);$('#modal').classList.add('hidden')};row.append(s,b);content.append(row)});let input=document.createElement('input');input.className='world-input';input.maxLength=18;input.placeholder='Nama dunia baru';let create=document.createElement('button');create.className='primary';create.textContent='+ BUAT DUNIA';create.onclick=()=>{let n=input.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'-');if(n.length<3){toast('Nama minimal 3 karakter');return}if(worlds.includes(n)){toast('Nama dunia sudah ada');return}worlds.push(n);switchLocalWorld(n);openPanel('worlds')};content.append(input,create)}else if(name==='social'){title.textContent='👥 Social Hub';content.innerHTML='<p class="panel-note">Daftar pemain, chat, undangan world, dan trade langsung akan aktif setelah layanan multiplayer ORBIT selesai dipasang. Saat ini game berjalan dalam mode lokal.</p><div class="panel-row"><span>Player status</span><b>Solo Explorer</b></div><div class="panel-row"><span>Trade</span><b>Belum aktif</b></div>'}else{title.textContent='⚙ Settings';content.innerHTML='<p class="panel-note">ORBIT build awal • kontrol sentuh dan keyboard • penyimpanan lokal.</p>';let b=document.createElement('button');b.textContent='SIMPAN DUNIA';b.onclick=save;content.append(b)}}
function solid(x,y){return y>=WH||x<0||x>=WW||y<0?true:([1,2,3,4,5,6].includes(map[y][x]))}
function mineAt(px,py,delta=0){let tx=Math.floor(px/T),ty=Math.floor(py/T),id=map[ty]?.[tx];if(!id){resetMining();return}let dist=Math.hypot((tx+.5)*T-(player.x+8),(ty+.5)*T-(player.y+12));if(dist>T*4.6){resetMining();toast('Dekati blok dahulu');return}if(!advanceMining(tx,ty,delta))return;map[ty][tx]=0;resetMining();let item=({1:'grass',2:'dirt',3:'stone',4:'copper',5:'crystal',6:'wood',7:'wood'})[id];if(item){addItem(item);if(id===5)coins+=2;$('#coins').textContent=coins} }
function placeAt(px,py){let tx=Math.floor(px/T),ty=Math.floor(py/T);if(map[ty]?.[tx]!==0)return;let id=['grass','dirt','stone','copper','crystal'][selected],tile=getItem(id);if(!tile||!(inv[id]>0)){toast('Pilih blok di hotbar yang tersedia');return}map[ty][tx]=tile.tile;inv[id]--;renderHotbar()}
function actionAt(e,delta=0){const r=canvas.getBoundingClientRect(),px=e.clientX-r.left+cameraX,py=e.clientY-r.top+cameraY;if(tool==='mine')mineAt(px,py,delta);else placeAt(px,py)}
let mining=false,mineTimer;canvas.addEventListener('pointerdown',e=>{e.preventDefault();mining=true;resetMining();actionAt(e);mineTimer=setInterval(()=>{if(mining&&tool==='mine')actionAt(e,50)},50)});['pointerup','pointercancel','pointerleave'].forEach(n=>canvas.addEventListener(n,()=>{mining=false;clearInterval(mineTimer);resetMining()}));
function bind(id,key){let e=$(id);e.addEventListener('pointerdown',v=>{v.preventDefault();input[key]=true;e.currentTarget.setPointerCapture(v.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(n=>e.addEventListener(n,()=>{input[key]=false;if(key==='mine')resetMining()}))}bind('#left','left');bind('#right','right');bind('#jump','jump');bind('#mine','mine');addEventListener('keydown',e=>{if(['a','ArrowLeft'].includes(e.key))input.left=true;if(['d','ArrowRight'].includes(e.key))input.right=true;if([' ','w','ArrowUp'].includes(e.key))input.jump=true;if(e.key==='e')openPanel('inventory')});addEventListener('keyup',e=>{if(['a','ArrowLeft'].includes(e.key))input.left=false;if(['d','ArrowRight'].includes(e.key))input.right=false;if([' ','w','ArrowUp'].includes(e.key))input.jump=false});
function drawTile(id,x,y,wx,wy){if(id===0)return;let colors={1:['#83d76b','#579f50','#347241'],2:['#bd8a5b','#94613f','#65432f'],3:['#a0afbb','#687d90','#43566a'],4:['#f0ad69','#b96b43','#713e35'],5:['#b5fff5','#5ed7dc','#2b8ca8'],6:['#c18a52','#80502f','#492e25'],7:['#9ce7a2','#4da97e','#246c65']},c=colors[id];if(!c)return;ctx.fillStyle=c[1];ctx.fillRect(x,y,T,T);ctx.fillStyle=c[0];ctx.fillRect(x,y,T,3);ctx.fillRect(x+1,y+3,3,2);ctx.fillStyle=c[2];ctx.fillRect(x,y+T-3,T,3);ctx.fillRect(x+T-3,y+2,3,T-5);ctx.fillStyle='#ffffff20';ctx.fillRect(x+3,y+7,4,3);ctx.fillRect(x+15,y+15,3,2);ctx.fillStyle='#17283b55';ctx.strokeRect(x+.5,y+.5,T-1,T-1);let seed=wx*97+wy*193;for(let k=0;k<3;k++){let rx=Math.floor(rand(seed+k*17)*17)+3,ry=Math.floor(rand(seed+k*29)*15)+5;ctx.fillStyle=id===1?'#a4e77b55':id===3?'#d6e4ed35':'#422b1c35';ctx.fillRect(x+rx,y+ry,2,2)}if(id===1){ctx.fillStyle='#b2ed7c';ctx.fillRect(x,y,T,2);if(rand(wx*11+7)>.83){ctx.fillStyle='#efffb1';ctx.fillRect(x+5,y+5,2,3);ctx.fillRect(x+8,y+3,2,2)}}if(id===4){ctx.fillStyle='#ffd49c';ctx.fillRect(x+7,y+9,5,7);ctx.fillRect(x+15,y+15,3,3)}if(id===5){ctx.fillStyle='#efffff';ctx.fillRect(x+10,y+6,3,11);ctx.fillRect(x+7,y+10,9,3);ctx.fillStyle='#d1ffff66';ctx.fillRect(x+5,y+4,14,15)}if(id===6){ctx.fillStyle='#d39b62';ctx.fillRect(x+9,y+6,6,14);ctx.fillStyle='#e8b87b';ctx.fillRect(x+10,y+8,2,9)}if(id===7){ctx.fillStyle='#d2ffad';ctx.fillRect(x+5,y+7,13,7);ctx.fillStyle='#c2ffdf';ctx.fillRect(x+8,y+4,3,3)}}
function drawMiningProgress(){if(!miningState.key||miningState.tx<0)return;const tile=map[miningState.ty]?.[miningState.tx];if(!tile)return;const x=miningState.tx*T-cameraX,y=miningState.ty*T-cameraY,p=Math.min(1,miningState.progress/mineDuration(tile));ctx.fillStyle='#091523b8';ctx.fillRect(x+2,y+T-7,T-4,5);ctx.fillStyle='#f6d47d';ctx.fillRect(x+2,y+T-7,(T-4)*p,5);ctx.strokeStyle='#fff1bf';ctx.lineWidth=1;ctx.strokeRect(x+2.5,y+T-6.5,T-5,4)}
function drawPlayer(x,y,remote=false){const t=performance.now()/120,walking=Math.abs(player.vx)>.15&&!remote,step=walking?Math.sin(t)*2:0,bob=walking?Math.abs(Math.sin(t))*1.5:0;ctx.save();ctx.translate(Math.round(x),Math.round(y-bob));if(player.face<0) {ctx.translate(player.w,0);ctx.scale(-1,1)}ctx.fillStyle='#182b42';ctx.fillRect(3,10,12,12);ctx.fillStyle='#284e78';ctx.fillRect(2,11,13,10);ctx.fillStyle='#e7b58f';ctx.fillRect(4,1,10,10);ctx.fillStyle='#533b36';ctx.fillRect(3,0,12,4);ctx.fillRect(4,-1,8,2);ctx.fillStyle='#f7e6c6';ctx.fillRect(11,4,2,2);ctx.fillStyle='#24334a';ctx.fillRect(3,20+step,5,7-step);ctx.fillRect(11,20-step,5,7+step);ctx.fillStyle='#d4a45d';ctx.fillRect(14,12,5,3);ctx.fillStyle='#f1c77d';ctx.fillRect(2,12,2,5);ctx.restore();}
function frame(ts){let dt=Math.min((ts-last)/16.67||1,2);last=ts;if(input.mine&&tool==='mine'){const tx=player.x+(player.face>0?player.w+5:-5),ty=player.y+player.h*.58;mineAt(tx,ty,dt*16.67)}player.vx=((input.right?1:0)-(input.left?1:0))*2.5; if(player.vx)player.face=Math.sign(player.vx);if(input.jump&&player.ground){player.vy=-8.4;player.ground=false}player.vy=Math.min(10,player.vy+.38*dt);let nx=player.x+player.vx*dt;if(!solid(Math.floor((nx+(player.vx>0?player.w:0))/T),Math.floor((player.y+player.h-2)/T)))player.x=Math.max(0,Math.min(WW*T-player.w,nx));let ny=player.y+player.vy*dt;player.ground=false;if(player.vy>=0&&solid(Math.floor((player.x+player.w/2)/T),Math.floor((ny+player.h)/T))){player.y=Math.floor((ny+player.h)/T)*T-player.h;player.vy=0;player.ground=true}else if(player.vy<0&&solid(Math.floor((player.x+player.w/2)/T),Math.floor(ny/T))){player.y=Math.floor(ny/T+1)*T;player.vy=0}else player.y=ny;cameraX=Math.max(0,Math.min(WW*T-screenW,player.x-screenW*.46));cameraY=Math.max(0,Math.min(WH*T-screenH,player.y-screenH*.52));let sky=ctx.createLinearGradient(0,0,0,screenH);sky.addColorStop(0,'#5d9fca');sky.addColorStop(.52,'#a5d2d3');sky.addColorStop(1,'#e8d8a8');ctx.fillStyle=sky;ctx.fillRect(0,0,screenW,screenH);ctx.fillStyle='#fff0bf';ctx.beginPath();ctx.arc(screenW*.78-cameraX*.025,screenH*.18,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff38';for(let i=0;i<5;i++){let cx=((i*211-cameraX*.16)%(screenW+180)+screenW+180)%(screenW+180)-90,cy=screenH*(.12+(i%3)*.1);ctx.fillRect(cx,cy,48,8);ctx.fillRect(cx+12,cy-7,28,8);ctx.fillRect(cx+34,cy+5,24,6)}for(let layer=0;layer<3;layer++){ctx.fillStyle=['#5e9e9a55','#467d8055','#345f6855'][layer];ctx.beginPath();ctx.moveTo(0,screenH*.68+layer*28);for(let x=0;x<=screenW+20;x+=20){let wx=x+cameraX*(.12+layer*.12);ctx.lineTo(x,screenH*.68+layer*28+Math.sin(wx*.009+layer*2)*18+Math.sin(wx*.021)*8)}ctx.lineTo(screenW,screenH);ctx.lineTo(0,screenH);ctx.closePath();ctx.fill()}let sx=Math.floor(cameraX/T),sy=Math.floor(cameraY/T),ex=Math.min(WW,sx+Math.ceil(screenW/T)+2),ey=Math.min(WH,sy+Math.ceil(screenH/T)+2);for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)drawTile(map[y][x],x*T-cameraX,y*T-cameraY,x,y);drawMiningProgress();remotePlayers.forEach(p=>drawPlayer(p.x*T-cameraX,p.y*T-cameraY,true));drawPlayer(player.x-cameraX,player.y-cameraY);$('#coords').textContent='X: '+Math.floor(player.x/T)+' • Y: '+Math.floor(player.y/T);requestAnimationFrame(frame)}
$('#modal-close').onclick=()=>$('#modal').classList.add('hidden');document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));$('#menu-button').onclick=()=>openPanel('settings');$('#mine').onclick=()=>{tool='mine';toast('Mode menambang')};$('#place').onclick=()=>{tool='place';resetMining();toast('Mode memasang blok')};generate();setSpawn();load();renderHotbar();$('#world-name').textContent=activeWorld;$('#coins').textContent=coins;requestAnimationFrame(frame);setInterval(()=>{localStorage.setItem('orbit_v2_world_'+activeWorld,JSON.stringify({map,inv,player:{x:player.x,y:player.y},coins}));localStorage.setItem('orbit_v2_inv',JSON.stringify(inv));localStorage.setItem('orbit_v2_player',JSON.stringify({x:player.x,y:player.y}))},5000);addEventListener('pagehide',()=>{localStorage.setItem('orbit_v2_world_'+activeWorld,JSON.stringify({map,inv,player:{x:player.x,y:player.y},coins}));localStorage.setItem('orbit_v2_map',JSON.stringify(map));localStorage.setItem('orbit_v2_inv',JSON.stringify(inv))});

let sb=null,onlineUser=null,activeWorldId=null,worldChannel=null,onlineSaveTimers=new Map(),remotePlayers=[],presenceTimer=null,playerDisplayName='Explorer',loadedChunkKeys=new Set(),positionTimer=null,onlineActionBusy=false;
const cfg=window.ORBIT_CONFIG;
function addText(parent,tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el}
function setAccountLabel(){const b=$('#world-name');if(onlineUser)b.title='Login: '+onlineUser.email;else b.title='Mode lokal'}
async function loadProfile(){if(!sb||!onlineUser)return;const {data,error}=await sb.from('player_profiles').select('display_name,level,coins,gems').eq('user_id',onlineUser.id).maybeSingle();if(error){toast('Profil belum dapat dimuat');return}if(data){$('#level').textContent=data.level;$('#coins').textContent=data.coins;coins=data.coins;playerDisplayName=data.display_name||'Explorer'}}
function authPanel(){const title=$('#modal-title'),content=$('#modal-content');title.textContent='👥 Akun & Sosial';content.replaceChildren();if(!sb){addText(content,'p','Layanan online belum tersambung. Periksa koneksi internet.','panel-note');return}
 if(onlineUser){addText(content,'p','Login sebagai '+onlineUser.email,'panel-note');const signout=addText(content,'button','KELUAR');signout.className='primary';signout.onclick=async()=>{await sb.auth.signOut();toast('Berhasil keluar');openPanel('social')};const status=addText(content,'div','Akun aktif • ID '+onlineUser.id.slice(0,8),'panel-row');return}
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
async function enterOnlineWorld(w){activeWorldId=w.id;activeWorld=w.name;$('#world-name').textContent=w.name;$('#modal').classList.add('hidden');toast('Memuat dunia online…');if(worldChannel){await sb.removeChannel(worldChannel);worldChannel=null}if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}if(positionTimer){clearInterval(positionTimer);positionTimer=null}remotePlayers=[];
 loadedChunkKeys=new Set();const initial=[];for(let cy=0;cy<4;cy++)for(let cx=0;cx<4;cx++)initial.push(loadOnlineChunk(cx,cy));const results=await Promise.all(initial);if(results.some(x=>!x))toast('Sebagian area dunia belum termuat');const surface=map.findIndex(row=>row[Math.floor(player.x/T)]===1);if(surface>0){player.y=surface*T-player.h;player.vy=0}await syncOnlineInventory();await syncOnlinePosition();
 await sb.realtime.setAuth();worldChannel=sb.channel('orbit-world:'+w.id,{config:{private:true,presence:{key:onlineUser.id}}}).on('presence',{event:'sync'},()=>{const state=worldChannel.presenceState();remotePlayers=Object.entries(state).filter(([id])=>id!==onlineUser.id).flatMap(([,metas])=>metas).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))}).on('postgres_changes',{event:'*',schema:'public',table:'world_chunks',filter:'world_id=eq.'+w.id},payload=>{const row=payload.new;if(row?.tile_data)applyChunk(row.chunk_x,row.chunk_y,row.tile_data)}).subscribe(async status=>{if(status==='SUBSCRIBED'){await worldChannel.track({x:Math.floor(player.x/T),y:Math.floor(player.y/T),display_name:playerDisplayName})}});presenceTimer=setInterval(()=>{if(worldChannel&&onlineUser){worldChannel.track({x:Math.floor((player.x+player.w/2)/T),y:Math.floor((player.y+player.h/2)/T),display_name:playerDisplayName}).catch(()=>{});syncOnlinePosition();ensureNearbyChunks()}},1200);
 toast('Online: '+w.name);
}
function applyChunk(cx,cy,data){const tiles=data?.tiles;if(!Array.isArray(tiles))return;for(let y=0;y<16;y++)for(let x=0;x<16;x++){const wy=cy*16+y,wx=cx*16+x;if(map[wy]&&Number.isInteger(tiles[y]?.[x]))map[wy][wx]=tiles[y][x]}}
async function loadOnlineChunk(cx,cy){if(!sb||!activeWorldId||cx<0||cx>13||cy<0||cy>5)return false;const key=cx+','+cy;if(loadedChunkKeys.has(key))return true;loadedChunkKeys.add(key);const {data,error}=await sb.rpc('orbit_get_chunk',{p_world_id:activeWorldId,p_chunk_x:cx,p_chunk_y:cy});if(error){loadedChunkKeys.delete(key);return false}applyChunk(cx,cy,data);return true}
async function ensureNearbyChunks(){if(!activeWorldId)return;const cx=Math.floor(player.x/T/16),cy=Math.floor(player.y/T/16),tasks=[];for(let y=Math.max(0,cy-1);y<=Math.min(5,cy+3);y++)for(let x=Math.max(0,cx-1);x<=Math.min(13,cx+3);x++)if(!loadedChunkKeys.has(x+','+y))tasks.push(loadOnlineChunk(x,y));if(tasks.length)await Promise.all(tasks)}
async function syncOnlineInventory(){if(!sb||!onlineUser)return;const {data,error}=await sb.from('player_inventory').select('item_id,quantity').eq('user_id',onlineUser.id);if(error)return;const mapIds={grass_block:'grass',soil_block:'dirt',slate_block:'stone',copper_ore:'copper',sky_crystal:'crystal',amber_wood:'wood',glow_seed:'seed',copper_pickaxe:'pickaxe'};Object.keys(inv).forEach(k=>inv[k]=0);(data||[]).forEach(r=>{const k=mapIds[r.item_id];if(k)inv[k]=r.quantity});renderHotbar()}
async function syncOnlinePosition(){if(!sb||!onlineUser||!activeWorldId)return;const x=Math.floor((player.x+player.w/2)/T),y=Math.floor((player.y+player.h/2)/T);const {error}=await sb.rpc('orbit_update_position',{p_world_id:activeWorldId,p_x:x,p_y:y});if(error&&error.message!=='MOVEMENT_TOO_FAST')console.warn('position sync',error.message)}

const oldMineAt=mineAt;mineAt=function(px,py,delta=0){if(!activeWorldId){oldMineAt(px,py,delta);return}if(onlineActionBusy)return;const tx=Math.floor(px/T),ty=Math.floor(py/T);if(tx<0||tx>=WW||ty<0||ty>=WH){resetMining();return}if(!map[ty]?.[tx]||!advanceMining(tx,ty,delta))return;onlineActionBusy=true;sb.rpc('orbit_mine_tile',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty}).then(async({data,error})=>{if(error){resetMining();toast(error.message.includes('TOO_FAR')?'Dekati blok dahulu':'Tidak bisa menambang: '+error.message);return}map[ty][tx]=0;resetMining();await syncOnlineInventory()}).finally(()=>onlineActionBusy=false)};
const oldPlaceAt=placeAt;placeAt=function(px,py){if(!activeWorldId){oldPlaceAt(px,py);return}if(onlineActionBusy)return;const tx=Math.floor(px/T),ty=Math.floor(py/T),items=['grass_block','soil_block','slate_block'];if(selected>2){toast('Item ini belum bisa dipasang');return}onlineActionBusy=true;sb.rpc('orbit_place_tile',{p_world_id:activeWorldId,p_tile_x:tx,p_tile_y:ty,p_item_id:items[selected]}).then(async({data,error})=>{if(error){toast(error.message.includes('TOO_FAR')?'Dekati lokasi dahulu':'Tidak bisa memasang: '+error.message);return}map[ty][tx]=data.tile_id;await syncOnlineInventory()}).finally(()=>onlineActionBusy=false)};
const oldOpenPanel=openPanel;openPanel=function(name){if(name!=='worlds'&&name!=='social')return oldOpenPanel(name);const modal=$('#modal'),title=$('#modal-title'),content=$('#modal-content');modal.classList.remove('hidden');content.replaceChildren();if(name==='social'){authPanel();return}title.textContent='🌍 World Gate';refreshWorldList(content)};
if(window.supabase&&cfg?.supabaseUrl&&cfg?.supabaseKey){sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);sb.auth.getSession().then(async({data,error})=>{if(error){toast('Online belum tersambung');return}onlineUser=data.session?.user||null;setAccountLabel();if(onlineUser)await loadProfile()}).catch(()=>toast('Gagal menyambung ke server'));sb.auth.onAuthStateChange(async(_event,session)=>{onlineUser=session?.user||null;setAccountLabel();if(onlineUser)await loadProfile();else{activeWorldId=null;if(worldChannel){sb.removeChannel(worldChannel);worldChannel=null}}})}

})();