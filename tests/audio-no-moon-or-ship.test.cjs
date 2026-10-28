'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('ship and moon trip assets and load hooks removed, no ghosts in map or dialog',()=>{
  assert(!fs.existsSync(path.join(root,'audio/maletin/lunar-world.js')));
  const host=read('audio/index.html'),html=read('audio/maletin/index.html'),eng=read('audio/maletin/game-engine-v50.js');
  const map=read('audio/maletin/expanded-map.js'),dialog=read('audio/maletin/unfire-conversations.js');
  for(const file of [html,eng,map,dialog])assert.doesNotMatch(file,/lunar-world\.js|UnfireLunarWorld|lunarShip|titan-ship|ufMapShip|ROBOT-NAVE|🛸|shipLore/);
  assert.match(host,/maletin\/index\.html\?v=20261028flight2/);
  assert.match(html,/game-engine-v50\.js\?v=20261028flight2/);
  assert.match(html,/expanded-map\.js\?v=20261028flight2/);
  assert.match(eng,/titan-island-roamer/);
});
