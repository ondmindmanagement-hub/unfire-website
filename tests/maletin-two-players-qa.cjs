const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 let browser;
 const issues=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']});
  const hostCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const guestCtx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const host=await hostCtx.newPage();
  const guest=await guestCtx.newPage();
  for(const [page,who] of [[host,'host'],[guest,'guest']]){
   page.on('pageerror',err=>issues.push(who+': '+err.message.slice(0,160)));
   page.on('console',e=>{if(e.type()==='error'&&/peer|websocket/i.test(e.text()))issues.push(who+' console: '+e.text().slice(0,160));});
  }
  const base=process.env.UNFIRE_MULTIPLAYER_URL||'http://127.0.0.1:8769/audio/maletin/index.html';
  const load=async(page,who)=>{
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>Boolean(window.__mal?.S && window.__roamAPI?.enterRoam),null,{timeout:120000});
   await page.evaluate(()=>{window.__mal.setP(1);window.__mal.requestOpen();window.__roamAPI.enterRoam();document.getElementById('onlB').click();});
   await page.locator('#onl.on #onNew').waitFor({timeout:25000});
   console.log('READY',who);
  };
  await Promise.all([load(host,'host'),load(guest,'guest')]);
  await host.locator('#onN').fill('QAHost');
  await host.locator('#onNew').evaluate(e=>e.click());
  try {await host.waitForFunction(()=>/🌐\s*[A-Z0-9]{5}/.test(document.getElementById('onlT')?.textContent||''),null,{timeout:25000});}
  catch{console.log('HOST_MSG',await host.locator('#onMsg').textContent());throw Error('Host room did not start');}
  const hostStatus=await host.locator('#onlT').textContent();
  const code=(hostStatus.match(/[A-Z0-9]{5}/)||[])[0];
  assert(code,'No 5-character room code in '+hostStatus);
  console.log('HOST_CONNECTED',code,hostStatus);
  await guest.locator('#onN').fill('QAGuest');
  await guest.locator('#onCode').fill(code);
  await guest.locator('#onJoin').evaluate(e=>e.click());
  try{await guest.waitForFunction(()=>document.getElementById('onlHud')?.style.display==='flex',null,{timeout:35000});}
  catch{console.log('GUEST_MSG',await guest.locator('#onMsg').textContent());throw Error('Guest failed to join');}
  console.log('GUEST_JOINED',await guest.locator('#onlT').textContent());
  await host.waitForFunction(()=>/2\s*👥/.test(document.getElementById('onlT')?.textContent||''),null,{timeout:25000});
  await guest.waitForFunction(()=>/2\s*👥/.test(document.getElementById('onlT')?.textContent||''),null,{timeout:25000});
  const hs=await host.locator('#onlT').textContent(),gs=await guest.locator('#onlT').textContent();
  assert(hs.includes('2👥')&&gs.includes('2👥'),JSON.stringify({hs,gs}));
  console.log('PASS TWO_PLAYERS_HOST_GUEST',JSON.stringify({hs,gs}));
  await Promise.all([
   host.waitForFunction(()=>document.getElementById('onlT')?.textContent?.includes('QAGuest'),null,{timeout:12000}),
   guest.waitForFunction(()=>document.getElementById('onlT')?.textContent?.includes('QAHost'),null,{timeout:12000}),
  ]);
  console.log('PASS BOTH_AVATAR_NAMES_SYNCHRONIZED');
  await guest.locator('#onlQ').evaluate(e=>e.click());
  await host.waitForFunction(()=>/1\s*👥/.test(document.getElementById('onlT')?.textContent||''),null,{timeout:18000});
  console.log('PASS GUEST_LEAVE_HOST_STILL_PLAYING');
  await guest.evaluate(()=>document.getElementById('onlB').click());
  await guest.locator('#onCode').fill(code);
  await guest.locator('#onJoin').evaluate(e=>e.click());
  await host.waitForFunction(()=>/2\s*👥/.test(document.getElementById('onlT')?.textContent||''),null,{timeout:30000});
  await guest.waitForFunction(()=>/2\s*👥/.test(document.getElementById('onlT')?.textContent||''),null,{timeout:30000});
  console.log('PASS GUEST_REJOINED_SAME_ROOM');
  await host.locator('#onlQ').evaluate(e=>e.click());
  await guest.waitForFunction(()=>document.getElementById('onlHud')?.style.display==='none',null,{timeout:25000});
  console.log('PASS HOST_LEAVE_GUEST_DISCONNECTED_CLEANLY');
  assert.equal(issues.length,0,'Browser issues: '+issues.join(' | '));
  console.log('PASS WEBRTC TWO CLIENTS AND LEAVE, NO JS EXCEPTIONS');
 }catch(e){console.error('FAIL MULTIPLAYER',e.stack?.slice(0,1200)||e);console.error('ISSUES',issues.slice(0,10));process.exitCode=1;}
 finally{if(browser)await browser.close();}
})();
