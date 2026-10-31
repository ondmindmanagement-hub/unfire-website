/**
 * Explicit zero-spend *local only* research adapter.
 * Never contacts cloud endpoints, downloads models, reads personal files, or executes commands.
 */
import { performance } from "node:perf_hooks";
import { ALLOWED_MODEL, fixtureById, evaluateAnswer, FIXTURE_IDS } from "./fixtures.mjs";
export const LOOPBACK_URL="http://127.0.0.1:11499/api/generate";
const MAX_CALLS=3;
const MAX_OUTPUT_TOKENS=48;
const MAX_TIMEOUT_MS=20000;
function validResult(body) {
  return body && typeof body==="object" && !Array.isArray(body) &&
    typeof body.response==="string" && body.response.length<=2048 &&
    body.done===true && (body.eval_count===undefined ||
      Number.isSafeInteger(body.eval_count) && body.eval_count>=0 && body.eval_count<=1000);
}
export class LocalQualitySession {
  #used=0;
  #stopped=false;
  constructor({explicitlyApproved=false,endpoint=LOOPBACK_URL,model=ALLOWED_MODEL,
    timeoutMs=12000,fetchFn=fetch}={}) {
    if(explicitlyApproved!==true || endpoint!==LOOPBACK_URL ||
      model!==ALLOWED_MODEL || !Number.isSafeInteger(timeoutMs) ||
      timeoutMs<100||timeoutMs>MAX_TIMEOUT_MS || typeof fetchFn!=="function")
      throw new Error("Local model session denied by default: explicit local-only approval and exact model/endpoint required");
    this.endpoint=endpoint;this.model=model;this.timeoutMs=timeoutMs;
    this.fetchFn=fetchFn;
  }
  get used(){return this.#used;}
  get stopped(){return this.#stopped;}
  stop(){this.#stopped=true;}
  async run(fixtureId) {
    // Count every attempted request, including timeout and error, and NEVER retry.
    const fixture=fixtureById(fixtureId);
    if(this.#stopped || this.#used>=MAX_CALLS)
      throw new Error("Stopped or local call budget exhausted");
    this.#used++;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    const start=performance.now();
    try {
      const response=await this.fetchFn(this.endpoint,{
        method:"POST",
        redirect:"error",
        signal:controller.signal,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:this.model,prompt:fixture.prompt,stream:false,
          keep_alive:0,
          options:{temperature:0,seed:7,num_predict:MAX_OUTPUT_TOKENS,num_ctx:512}
        })
      });
      if(!response || response.ok!==true || typeof response.json!=="function")
        throw new Error("Local model failed; no retries or external fallback");
      const body=await response.json();
      if(!validResult(body))throw new Error("Unexpected local model response");
      const quality=evaluateAnswer(fixture,body.response);
      return Object.freeze({
        id:fixture.id,model:this.model,passed:quality.passed,criterion:quality.criterion,
        elapsedMs:Number((performance.now()-start).toFixed(2)),
        reportedOutputTokens:body.eval_count??null,
        reportedTotalDurationNs:Number.isSafeInteger(body.total_duration)&&
          body.total_duration>=0?body.total_duration:null,
        providerCostUsd:0,
        origin:"local_only",
        note:"Exact synthetic fixture criterion, not general model quality or successful external task execution."
      });
    }finally {
      clearTimeout(timer);
    }
  }
}
export async function evaluateAll(session) {
  if(!(session instanceof LocalQualitySession))throw new TypeError("Invalid local evaluation session");
  const runs=[];
  for(const id of FIXTURE_IDS)runs.push(await session.run(id));
  return Object.freeze({
    model:session.model,attempted:session.used,
    passed:runs.filter(r=>r.passed).length,total:runs.length,
    results:Object.freeze(runs),
    externalCalls:0,providerCostUsd:0,
    disclaimer:"A bounded on-device model test only. No real-world action, identity attestation or performance promise."
  });
}
