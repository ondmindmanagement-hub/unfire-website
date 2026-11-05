'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../audio');
const names=[
 ['Audiowide','audiowide'],
 ['Michroma','michroma'],
 ['Orbitron','orbitron'],
 ['ShareTechMono','sharetechmono'],
 ['VT323','vt323']
];
const eula=fs.readFileSync(path.join(root,'game-license.html'),'utf8');
function fontNameField(bytes,id){
 const nTables=bytes.readUInt16BE(4);
 let off=null;
 for(let i=0;i<nTables;i++){
  const pos=12+i*16;
  if(bytes.toString('ascii',pos,pos+4)==='name'){off=bytes.readUInt32BE(pos+8);break;}
 }
 assert.notEqual(off,null,'TTF name metadata absent');
 const count=bytes.readUInt16BE(off+2),strBase=off+bytes.readUInt16BE(off+4);
 const results=[];
 for(let i=0;i<count;i++){
  const pos=off+6+i*12;
  const platform=bytes.readUInt16BE(pos),nameId=bytes.readUInt16BE(pos+6);
  if(nameId!==id)continue;
  const len=bytes.readUInt16BE(pos+8),p=strBase+bytes.readUInt16BE(pos+10);
  const data=bytes.subarray(p,p+len);
  try {results.push(platform===0||platform===3?new TextDecoder('utf-16be').decode(data):data.toString('latin1'));}
  catch(_) {}
 }
 return results;
}
for(const [filename,slug] of names){
 test('OFL notice bundled for '+filename,()=>{
  const font=fs.readFileSync(path.join(root,'maletin/fonts',filename+'.ttf'));
  const notice=fs.readFileSync(path.join(root,'maletin/fonts/LICENSES',slug+'-OFL.txt'),'utf8');
  const copyright=fontNameField(font,0).find(x=>/copyright/i.test(x));
  const license=fontNameField(font,13).find(x=>/SIL Open Font License,?\s*(?:Version\s*)?1\.1/i.test(x));
  assert.ok(copyright,filename+' lacks font copyright field');
  assert.ok(license,filename+' lacks embedded OFL notice');
  assert.match(notice,/SIL OPEN FONT LICENSE/i,filename+' missing full license');
  assert.match(notice,/Version 1\.1/,filename+' missing correct license version');
  assert.match(notice,/copyright/i,filename+' must retain copyright notice');
  assert.ok(eula.includes('maletin/fonts/LICENSES/'+slug+'-OFL.txt'),'Game EULA does not link '+filename+' license');
 });
}
