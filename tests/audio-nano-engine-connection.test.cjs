'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const eng=file('audio/maletin/game-engine-v50.js');
const page=file('audio/maletin/index.html');
const host=file('audio/index.html');
const phys=require('../audio/maletin/nano-physics.js');

test('isolated NANO size-aware physics is loaded before the live game engine',()=>{
 const a=page.indexOf('<script src="nano-physics.js?v='),b=page.indexOf('<script src="game-engine-v50.js?v=');
 assert.ok(a>0&&b>a);
 assert.match(eng,/const NANO_PHYSICS = window\.UnfireNanoPhysics/);
 assert.match(eng,/NANO_PHYSICS\.move2D/);
 assert.match(eng,/NANO_PHYSICS\.safeMorphPosition/);
 assert.doesNotMatch(eng,/stkN > 40/);
});

test('cache identifiers agree for iframe, physics script and engine',()=>{
 const v='20261024oracle1', previous='20261024organic1', shared='20261024combinedqa1';
 assert.match(host,/maletin\/index\.html\?v=20261024oracle1/);
 assert.ok(page.includes('nano-physics.js?v='+shared));
 assert.ok(page.includes('game-engine-v50.js?v='+v));
 assert.ok(page.includes('expanded-map.js?v=20261024shippin1'));
 assert.ok(page.includes('coins-shop.js?v='+previous));
 assert.ok(!page.includes('game-engine-v50.js?v=20261024storytop1'));
});

test('normal and nano 1st, 2nd, 3rd person modes use one camera-cycle control',()=>{
 assert.deepEqual([...phys.CAMERA_MODES],['3p','2p','1p']);
 assert.match(eng,/NANO_PHYSICS\.nextCameraMode\(ROAMS\.mode/);
 assert.match(eng,/MODE === '2p' \? 6\.8/);
 assert.match(eng,/MODE !== '2p' && MODE !== '1p'/);
 assert.match(eng,/const FP = \(ROAMS\.mode === '1p'\)/);
 assert.match(eng,/if \(FP\) \{ AV\.w\.updateMatrixWorld\(true\)/);
});

test('switching NANO freeplay exits the suitcase orbit, preserves coordinates, checks growth clearance',()=>{
 assert.match(eng,/robotMode: \(\) => \{ if \(!ROAMS\.on\) enterRoam\(\); if \(CASE_VIEW\.on\) showRobotView\(\)/);
 assert.match(eng,/ROAMS\.freeRobotMode = true/);
 assert.match(eng,/if \(!candidate\.safe\)/);
 assert.match(eng,/ROAMS\.p\.x = candidate\.x; ROAMS\.p\.z = candidate\.z/);
 assert.match(eng,/ROAMS\.touchStick = null/);
});

test('freeplay disables automatic story and side missions without deleting saved progress',()=>{
 assert.match(eng,/if \(!cur \|\| !ROAMS\.on \|\| ROAMS\.freeRobotMode\) return/);
 assert.match(eng,/!ROAMS\.mini && !ROAMS\.freeRobotMode/);
 assert.match(page,/function ev\(name\) \{ if \(window\.__roamAPI\?\.ROAMS\?\.freeRobotMode\) return/);
 assert.match(page,/window\.__roamAPI\.ROAMS\.freeRobotMode=false; runStep\(\)/);
 assert.ok(!/localStorage\.clear\(\)/.test(page));
});

test('house doorway remains traversable when using the full-sized collider radius',()=>{
 assert.match(eng,/const inDoorCorridor = !window\.ATM_OUT/);
 assert.match(eng,/bound\.z1 \+ \(inDoorCorridor \? 5 : -rim\)/);
 assert.match(eng,/if \(!window\.ATM_OUT && Math\.abs\(ROAMS\.p\.x \+ 30\) < 5 && ROAMS\.p\.z > 93\) ATM\.setOut\(true\)/);
 assert.match(eng,/Math\.hypot\(dx, dz\) \+ P\.radius \+ 1\.2/);
});

test('flight wings scale with mini avatar and gait speed avoids animation aliasing',()=>{
 assert.match(eng,/s0 = AV\.baseScale \|\| 1; AV\.WG\.scale\.setScalar/);
 assert.doesNotMatch(eng,/s0 = AV\.w\.scale\.x \|\| 1; AV\.WG\.scale\.setScalar/);
 assert.match(eng,/STEPPH\(ROAMS\.wd \|\| 0, 10\.5\*\(ROAMS\.mini\?avatarProfile\(\)\.speedScale:1\), ROAMS\.run\)/);
});

test('nano speed is usable and physics remains smaller than full-size',()=>{
 const n=phys.profile(true),p=phys.profile(false);
 assert.ok(n.walkSpeed>6&&n.walkSpeed<p.walkSpeed);
 assert.ok(n.radius<p.radius);
 assert.match(eng,/avatarProfile\(\)\.speedScale/);
 assert.match(eng,/avatarProfile\(\)\.gravity/);
 assert.match(eng,/const miniFlight = ROAMS\.mini && window\.ATM_OUT \? Math\.max\(0\.64, avatarProfile\(\)\.speedScale\) : avatarProfile\(\)\.speedScale/, 'nano accelerates only outdoors while preserving normal-size flight');
});
