const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const ENGINE=fs.readFileSync(path.join(ROOT,'audio/maletin/game-engine-v50.js'),'utf8');
const HTML=fs.readFileSync(path.join(ROOT,'audio/maletin/index.html'),'utf8');
const COINS=fs.readFileSync(path.join(ROOT,'audio/maletin/coins-shop.js'),'utf8');

test('ventanal retains only its perimeter, without white or wooden internal slats',()=>{
  assert.match(ENGINE,/Ventanal diáfano/);
  assert.doesNotMatch(ENGINE,/for \(const x of \[-WX \/ 2, WX \/ 2\]\)/);
  assert.doesNotMatch(ENGINE,/\[0\.25, WY1 - WY0, 0, \(WY0 \+ WY1\) \/ 2\]/);
  assert.match(ENGINE,/const sill = mesh\(/);
});
test('nano robot keeps free-roam coordinates, input modes and proportional mobility',()=>{
  const robot=ENGINE.match(/robotMode: \(\) => \{(.+?)\}, isNano:/)?.[1];
  assert.ok(robot,'story robot mode remains exposed');
  assert.doesNotMatch(robot,/ROAMS\.p\.set\(/,'no teleport on size toggle');
  assert.match(robot,/ROAMS\.mini = !ROAMS\.mini/);
  assert.doesNotMatch(ENGINE,/ROAMS\.p\.x = clamp\(ROAMS\.p\.x, -12\.6, 12\.6\)/,'desk bounds removed');
  assert.match(ENGINE,/const ms = ROAMS\.mini \? NANO_SCALE : 1/);
  assert.match(ENGINE,/const NANO_SCALE = 0\.24 \/ 10\.5/, 'nano robot is precisely the 0.24-unit model size of the minis inside the case');
  assert.match(ENGINE,/isNano: \(\) => !!ROAMS\.mini/);
  assert.match(ENGINE,/zone: window\.ATM_OUT \? 'island' : 'house'/, 'nano roaming uses actual world zone, not table-only map');
  assert.doesNotMatch(ENGINE,/const mini = !!ROAMS\.mini, out = !!window\.ATM_OUT/, 'minimap no longer confuses nano with case-table');
  assert.match(HTML,/id="stR"[^>]*aria-pressed="false"[^>]*>🔬 NANO ROBOT/, 'Nano control is in the configuration HUD');
  assert.match(HTML,/id = 'cfgB'/, 'configuration gear remains present');
  assert.match(HTML,/H\.isNano\(\)/, 'button state updates after exiting or changing mode');

  assert.match(ENGINE,/const GTA = \(\(ROAMS\.mode \|\| '3p'\) === '3p' \|\| ROAMS\.mode === '3pl'\)/);
  assert.match(ENGINE,/AV\.w\.scale\.setScalar\(AV\.baseScale\*\(ROAMS\.mini\?NANO_SCALE:1\)\)/);
  assert.match(ENGINE,/miniCameraRatio = ROAMS\.mini \? NANO_SCALE : 1/);
  assert.match(ENGINE,/ROAMS\.fly\) \{ const miniFlight = ROAMS\.mini \? NANO_SCALE : 1/);
});
test('coin HUD lives centrally, clear of the radio and settings touch targets',()=>{
  assert.match(COINS, /#unfireCoinHud\{[^\n]*top:calc\(env\(safe-area-inset-top\) \+ 78px\);left:50%;right:auto;transform:translateX\(-50%\)/,
    'wallet must be below the left radio and clear of the right settings button');
  assert.match(COINS, /@media\(max-height:480px\)\{#unfireCoinHud\{top:calc\(env\(safe-area-inset-top\) \+ 58px\);/,
    'short landscape central wallet must not cover the minimap');
  assert.match(COINS, /body:has\(#wradio\.expanded\) #unfireCoinHud\{visibility:hidden;pointer-events:none\}/,
    'expanded radio temporarily owns the upper HUD, without click-through wallet');
});

test('offline coin module is loaded before engine and avoids payments / online sharing',()=>{
  assert.ok(HTML.indexOf('coins-shop.js')>0&&HTML.indexOf('coins-shop.js')<HTML.indexOf('<script src="game-engine-v50.js'));
  assert.match(ENGINE,/UNFIRE_COINS_BOOT\(\{ROAMS,THREE,S,MUTANTS\}\)/);
  assert.match(ENGINE,/UNFIRE_COINS\.tick\(dt,t\)/);
  assert.match(COINS,/!\(window\.ONL(INE_ON)? && window\.ONLINE_ON\(\)\)/);
  assert.doesNotMatch(COINS,/Stripe|checkout|payment|cardNumber|paypal/i);
});
function makeContext(savedBalance=0){
  class El {
    constructor(){this.children=[];this.userData={};this.style={};this.dataset={};this.attrs={};
      const classes=new Set();
      this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};
      this.slots={};this.innerHTML='';this.textContent='';}
    querySelector(s){return this.slots[s]||(this.slots[s]=new El());}
    appendChild(c){this.children.push(c);return c;}
    addEventListener(){}setAttribute(k,v){this.attrs[k]=v;}focus(){}
  }
  class Obj {
    constructor(){this.userData={};this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
      this.scale={setScalar(v){this.value=v;}};this.rotation={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
      this.material={color:{set(){}},opacity:0};this.visible=true;}
    updateMatrix(){this.matrix={};}setMatrixAt(){}}
  class Mesh extends Obj {constructor(g,m){super();this.geometry=g;if(m)this.material=m;}}
  const material=()=>({color:{set(){}},opacity:0});
  const THREE={MeshStandardMaterial:class{constructor(){Object.assign(this,material());}},
    MeshBasicMaterial:class{constructor(){Object.assign(this,material());}},
    TorusGeometry:class{},RingGeometry:class{},BoxGeometry:class{},
    Mesh,InstancedMesh:class extends Mesh{constructor(g,m,n){super(g,m);this.instanceMatrix={needsUpdate:false};this.count=n;}},
    Object3D:Obj,DoubleSide:2};
  const store=new Map();
  if(savedBalance)store.set('unfire_offline_coins_v1',JSON.stringify({balance:savedBalance,owned:['robot-4','robot-1'],morph:'robot-4'}));
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const document={body:new El(),createElement:()=>new El()};
  const window={};let inRoom=false;
  window.ONLINE_ON=()=>inRoom;
  const sandbox={window,document,THREE,localStorage,addEventListener(){},Date,Math,JSON,Set};
  vm.runInNewContext(COINS,sandbox,{timeout:2000});
  const ROAMS={on:true,mini:false,p:{x:-30,z:24},h:0,k:{},moving:false};
  const S={scene:{add(){},remove(){}}};
  const MUTANTS={list:Array.from({length:20},(_,n)=>({name:'Robot '+n}))};
  const api=window.UNFIRE_COINS_BOOT({ROAMS,THREE,S,MUTANTS});
  return {api,window,ROAMS,store,setOnline:v=>inRoom=v};
}
test('coin collection gives 1 coin only once per spawn; online yields none',()=>{
  const x=makeContext();
  for(let i=0;i<5;i++)x.api.tick(0.033,i/30);
  assert.equal(x.api.balance,1);
  for(let i=0;i<15;i++)x.api.tick(0.033,i/30);
  assert.equal(x.api.balance,1);
  x.setOnline(true);x.ROAMS.p.x=-44;x.ROAMS.p.z=37;
  for(let i=0;i<5;i++)x.api.tick(0.033,i/30);
  assert.equal(x.api.balance,1);
  assert.equal(JSON.parse(x.store.get('unfire_offline_coin_claims_v1')).ids.length,1);
});
test('shop buys existing robot transform and one extra with persisted local balance',()=>{
  const x=makeContext(70);
  x.api.open();
  assert.equal(x.api.buy('robot-7'),true);
  assert.equal(x.ROAMS.myType,7);
  assert.equal(x.api.balance,50);
  assert.equal(x.api.buy('aura-cyan'),true);
  assert.equal(x.api.balance,38);
  assert.equal(x.api.owned.includes('robot-7'),true);
  assert.equal(JSON.parse(x.store.get('unfire_offline_coins_v1')).aura,'cyan');
  x.setOnline(true);
  assert.equal(x.api.buy('color-gold'),false);
  x.api.tick(0.033,1);
});
