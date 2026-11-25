/* Source-only integration preview for the web-game owner.
 * Reads input, prints candidate HTML to stdout; never writes over the source.
 * Does NOT enable tracking or publish any changes.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
function once(source,anchor,change,label){
 const first=source.indexOf(anchor);
 if(first<0 || source.indexOf(anchor,first+anchor.length)>=0)
   throw new Error('Integration contract mismatch: '+label+' must match exactly once');
 return source.slice(0,first)+change+source.slice(first+anchor.length);
}
function render(source){
 if(typeof source!=='string' || !source.includes('id="malFrame"'))
   throw new Error('Unrecognized /audio/ game host');
 if(source.includes('window.UnfirePlayMetrics?.start()') || source.includes('/analytics/game-play/collector.js'))
   throw new Error('Metrics already integrated; refuse duplicate hooks');
 let out=source;
 out=once(out,'</head>',
   '<script defer src="/analytics/game-play/collector.js"></script>\n'+
   '<script defer src="/analytics/game-play/loader.js"></script>\n</head>','head');
 // enterGame is called from begin() ONLY when the game scene is ready.
 const enter="try{fr.contentWindow.postMessage({unfire:1,entryStart:true,vis:true},location.origin);}catch(_){}";
 out=once(out,enter,enter+"\n    try{window.UnfirePlayMetrics?.start();}catch(_){}",
   'genuine entry');
 const resume="try{fr.contentWindow.postMessage({unfire:1,vis:true,entryResume:true},location.origin);}catch(e){}";
 out=once(out,resume,resume+"\n    try{window.UnfirePlayMetrics?.start();}catch(_){}",
   'intentional resume');
 const exit="function exitGame(){\n    caseLocal=false;webReturn=true;parked=1;";
 out=once(out,exit,exit+"\n    try{window.UnfirePlayMetrics?.end();}catch(_){}",
   'genuine exit');
 return out;
}
module.exports={render};
if(require.main===module){
 if(process.argv.length!==3){console.error('Usage: node host-integration-preview.cjs <audio/index.html> > candidate.html');process.exitCode=2;}
 else{
  try{process.stdout.write(render(fs.readFileSync(path.resolve(process.argv[2]),'utf8')));}
  catch(err){console.error(String(err.message));process.exitCode=1;}
 }
}
