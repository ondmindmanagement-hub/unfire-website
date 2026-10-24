// Cloudflare Worker + D1: daily aggregate events, anonymous tab sessions.
// Deployment requires an existing Cloudflare account and D1 binding DB.
const headers={'Access-Control-Allow-Origin':'https://unfire.technology','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
export default {async fetch(req,env){
  const url=new URL(req.url);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST'||url.pathname!=='/event')return new Response('Not found',{status:404});
  if(req.headers.get('Origin')!=='https://unfire.technology')return new Response('Forbidden',{status:403});
  let data;try{data=await req.json()}catch{try{data=JSON.parse(await req.text())}catch{return new Response('Invalid body',{status:400,headers})}}
  if(!['visit','play'].includes(data?.event)||!/^[-a-f0-9]{36}$/i.test(data?.session||''))return new Response('Invalid event',{status:400,headers});
  const date=new Date().toISOString().slice(0,10);
  const key=`${date}:${data.event}:${data.session}`;
  // Unique counts are per browser tab session, not unique people. No IP or user-agent stored.
  const result=await env.DB.prepare('INSERT OR IGNORE INTO seen (id, day, event) VALUES (?, ?, ?)').bind(key,date,data.event).run();
  if(result.meta.changes)await env.DB.prepare('INSERT INTO daily(day,event,total) VALUES(?,?,1) ON CONFLICT(day,event) DO UPDATE SET total=total+1').bind(date,data.event).run();
  return new Response(null,{status:204,headers});
}};
