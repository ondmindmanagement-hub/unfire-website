/** Offline synthetic demonstration, never runs an AI agent. */
import { EvidenceRunner } from './runner.mjs';
const runner = new EvidenceRunner();
for (const spec of [
  {id:'research',operation:'text.wordCount',input:'Evidence before conclusions',dependsOn:[],requiresApproval:false},
  {id:'analysis',operation:'math.sum',input:[5,8,13],dependsOn:['research'],requiresApproval:false},
  {id:'delivery',operation:'text.uppercase',input:'Verified synthetic results',dependsOn:['analysis'],requiresApproval:true}
]) runner.register(spec);
for (const id of ['research','analysis','delivery']) {
  if (id === 'delivery') runner.approve(id,runner.snapshot(id).revision);
  const claimed = runner.claim(id,{worker:'demo-worker',now:1,leaseMs:100,expectedRevision:runner.snapshot(id).revision});
  runner.start(id,{worker:'demo-worker',generation:claimed.generation,now:2});
  const evidence = runner.perform(id,{worker:'demo-worker',generation:claimed.generation,now:3});
  runner.submit(id,{worker:'demo-worker',generation:claimed.generation,now:4,evidence});
  const verified = runner.verify(id,{worker:'demo-worker',generation:claimed.generation,now:5});
  if (verified.state !== 'VERIFIED') throw new Error('Synthetic evidence verification failed');
  console.log(JSON.stringify({id,state:verified.state,operation:verified.spec.operation,output:verified.evidence.output}));
}
console.log(JSON.stringify({simulationOnly:true,verified:runner.snapshots().filter(t=>t.state==='VERIFIED').length,total:runner.snapshots().length,events:runner.events().length}));
