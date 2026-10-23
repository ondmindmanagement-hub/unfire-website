import test from 'node:test';
import assert from 'node:assert/strict';
import collector from '../analytics/unfire-audio/worker.mjs';

const UUID='0c8a7b17-c826-42f8-8c6e-b3ff897f9b34';
const payload=Object.freeze({event:'game_enter',session:UUID});
const allowed='https://unfire.technology';

function request(value=payload) {
  return new Request('https://metrics.example/v1/event', {
    method:'POST',headers:{Origin:allowed,'Content-Type':'application/json'},
    body:JSON.stringify(value)
  });
}
function fixtures(options={}) {
  const recorded=[];
  const db={
    prepare(sql) {recorded.push(sql);return {bind(){return this;}};},
    async batch(){return [{results:[]},{results:[]}];}
  };
  const allowedRate = {
    limit:async args => {
      recorded.push(args);
      return {success:true};
    }
  };
  return {recorded,db,env:{
    DB:db,EVENT_RATE_LIMITER:options.global || allowedRate,
    SESSION_RATE_LIMITER:options.session || allowedRate
  }};
}

test('collector refuses to ingest without both explicit rate limiting bindings', async()=>{
  const f=fixtures();
  delete f.env.EVENT_RATE_LIMITER;
  const response=await collector.fetch(request(),f.env);
  assert.equal(response.status,503);
  assert.equal(f.recorded.length,0);
});

test('rate-limiter denies abuse without writing D1',async()=>{
  const f=fixtures({global:{limit:async()=>({success:false})}});
  const response=await collector.fetch(request(),f.env);
  assert.equal(response.status,429);
  assert.ok(!f.recorded.some(x=>typeof x==='string'));
});

test('session-limit rejection blocks D1 writes too',async()=>{
  const f=fixtures({session:{limit:async()=>({success:false})}});
  assert.equal((await collector.fetch(request(),f.env)).status,429);
  assert.ok(!f.recorded.some(x=>typeof x==='string'));
});

test('valid event invokes per-edge global and ephemeral session limiter',async()=>{
  const f=fixtures();
  const res=await collector.fetch(request(),f.env);
  assert.equal(res.status,202);
  assert.equal(f.recorded.filter(x=>typeof x==='string').length,2);
  assert.deepEqual(f.recorded.filter(x=>typeof x==='object').map(x=>x.key),
    ['audio-events',UUID]);
});

test('payload larger than 512 bytes rejected before accessing limiter or D1',async()=>{
  const f=fixtures();
  const invalid={...payload, unwanted:'x'.repeat(800)};
  const res=await collector.fetch(request(invalid),f.env);
  assert.equal(res.status,413);
  assert.equal(f.recorded.length,0);
});

test('missing Content-Length still enforces bounded streaming body',async()=>{
  const f=fixtures();
  const req=new Request('https://metrics.example/v1/event',{
    method:'POST',
    headers:{Origin:allowed,'Content-Type':'application/json'},
    body:new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(payload) + 'x'.repeat(650)));
        controller.close();
      }
    }),
    duplex:'half'
  });
  const res=await collector.fetch(req,f.env);
  assert.equal(res.status,413);
  assert.equal(f.recorded.length,0);
});

test('request fails closed if rate limiting service errors',async()=>{
  const f=fixtures({global:{limit:async()=>{throw new Error('failure');}}});
  assert.equal((await collector.fetch(request(),f.env)).status,503);
  assert.ok(!f.recorded.some(x=>typeof x==='string'));
});
