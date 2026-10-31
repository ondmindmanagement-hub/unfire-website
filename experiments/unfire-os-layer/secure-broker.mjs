/**
 * Unfire OS · Secure Broker RESEARCH ONLY.
 *
 * Trusted host broker for ONE previously signed, strictly sandbox-entitled,
 * deterministic Swift test worker. No model calls, no network/API access,
 * shell mode, browser, project file I/O, worker-supplied instructions or
 * arbitrary executable paths in task payloads.
 *
 * IMPORTANT: the Node parent itself is not sandboxed. Signing checks do
 * not establish production identity or close every TOCTOU attack.
 */
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { lstat, readFile, realpath } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import { ResearchCoordinator } from "./coordinator.mjs";
import { independentlyVerify, validatePureTask } from "./pure-verifier.mjs";

const execFileAsync = promisify(execFile);
const NAME = /^[a-z][a-z0-9_-]{0,39}$/u;
const WORKER_NAME = "UnfireResearchWorker";
const APP_NAME = "UnfireResearchWorker.app";
const MAX_BINARY_BYTES = 30 * 1024 * 1024;
const cleanEnv = Object.freeze({ PATH:"/usr/bin:/bin", LANG:"C" });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const exactKeys = (v,fields) => v !== null && typeof v === "object" &&
  Object.getPrototypeOf(v) === Object.prototype &&
  Object.keys(v).every(x=>fields.includes(x));

async function readPinnedBinary(path) {
  const st=await lstat(path);
  if(!st.isFile() || st.isSymbolicLink() || st.size<1 || st.size>MAX_BINARY_BYTES)
    throw new Error("Worker binary is missing, symlinked or oversized");
  if(await realpath(path)!==path) throw new Error("Worker binary path must be canonical");
  return sha(await readFile(path));
}
async function verifyMacSignature(app,executable) {
  try {
    await execFileAsync("/usr/bin/codesign",
      ["--verify","--strict","--deep",app],
      {timeout:5000,maxBuffer:32768,env:cleanEnv});
    const {stdout}=await execFileAsync("/usr/bin/codesign",
      ["--display","--entitlements",":-",executable],
      {timeout:5000,maxBuffer:32768,env:cleanEnv});
    const keys=[...stdout.matchAll(/<key>([^<]+)<\/key>/gu)].map(x=>x[1]);
    if (keys.length!==1 || keys[0]!=="com.apple.security.app-sandbox" ||
        !/<key>com\.apple\.security\.app-sandbox<\/key>\s*<true\s*\/>/u.test(stdout))
      throw new Error("Worker entitlements are not the exact minimal allowlist");
  }catch {
    throw new Error("Worker signature or minimal App Sandbox entitlement verification failed");
  }
}
function spawnBounded(executable,payload,timeoutMs,signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted) {reject(new Error("Task aborted before launch"));return;}
    let done=false,reason=null,out="",errorBytes=0;
    const child=spawn(executable,["transform"],{
      shell:false,detached:false,stdio:["pipe","pipe","pipe"],
      cwd:"/",env:cleanEnv
    });
    const fail=message=>{
      if(reason===null)reason=new Error(message);
      child.kill("SIGKILL");
    };
    const onAbort=()=>fail("Task stopped before worker completion");
    signal?.addEventListener("abort",onAbort,{once:true});
    const timer=setTimeout(()=>fail("Worker exceeded its time limit"),timeoutMs);
    child.on("error",()=>{if(reason===null)reason=new Error("Unable to start signed worker");});
    child.stdout.setEncoding("utf8");
    child.stdout.on("data",part=>{
      out+=part;
      if(Buffer.byteLength(out,"utf8")>8192)fail("Worker output limit exceeded");
    });
    child.stderr.on("data",part=>{
      errorBytes+=part.length;
      if(errorBytes>1024)fail("Worker error output limit exceeded");
    });
    child.once("close",(code,signalName)=>{
      if(done)return;done=true;clearTimeout(timer);
      signal?.removeEventListener("abort",onAbort);
      if(reason)reject(reason);
      else if(code!==0 || signalName)reject(new Error("Sandboxed worker exited unsuccessfully"));
      else resolve(out.trim());
    });
    child.stdin.on("error",()=>{});
    child.stdin.end(payload);
  });
}
export class ResearchSecureBroker {
  #app;#executable;#digest;#active=0;
  constructor(app,executable,digest) {
    this.#app=app;this.#executable=executable;this.#digest=digest;
  }
  static async open({workerApp}={}) {
    if(process.platform!=="darwin")throw new Error("macOS host required");
    if(typeof workerApp!=="string" || !isAbsolute(workerApp) ||
       basename(workerApp)!==APP_NAME ||
       await realpath(workerApp).catch(()=>null)!==workerApp ||
       !(await lstat(workerApp)).isDirectory())
      throw new Error("Expected canonical signed research .app path");
    const executable=join(workerApp,"Contents","MacOS",WORKER_NAME);
    const digest=await readPinnedBinary(executable);
    await verifyMacSignature(workerApp,executable);
    return new ResearchSecureBroker(workerApp,executable,digest);
  }
  async execute(task,{timeoutMs=2000,signal}={}) {
    const validated=validatePureTask(task);
    if(!Number.isSafeInteger(timeoutMs) || timeoutMs<100 || timeoutMs>5000)
      throw new TypeError("Worker timeout must be bounded between 100 and 5000 ms");
    if(signal!==undefined && !(signal instanceof AbortSignal))
      throw new TypeError("Invalid cancellation signal");
    // Reserve capacity before ANY asynchronous checks, so a second caller
    // cannot race this single-worker research broker into parallel execution.
    if(this.#active!==0)throw new Error("Research worker capacity exceeded");
    this.#active=1;
    try {
      if(signal?.aborted)throw new Error("Task aborted before launch");
      if(await readPinnedBinary(this.#executable)!==this.#digest)
        throw new Error("Signed worker binary changed after verification");
      await verifyMacSignature(this.#app,this.#executable);
      if(signal?.aborted)throw new Error("Task aborted before launch");
      // This research checksum is a guard against replacement, NOT a complete
      // atomic open-and-execute implementation.
      const request=JSON.stringify(validated);
      const stdout=await spawnBounded(this.#executable,request,timeoutMs,signal);
      if(await readPinnedBinary(this.#executable)!==this.#digest)
        throw new Error("Signed worker binary changed during execution");
      if(signal?.aborted)throw new Error("Task stopped before verification");
      return independentlyVerify(validated,stdout);
    } finally {
      this.#active=0;
    }
  }
  async executeAndAttest({coordinator,credential,artifact,taskId,operation,input,
                          timeoutMs=2000,signal}={}) {
    if(!(coordinator instanceof ResearchCoordinator))throw new TypeError("Trusted coordinator required");
    if(typeof credential!=="string" || !/^Bearer [a-f0-9]{64}$/u.test(credential))
      throw new TypeError("Research role credential required");
    if(typeof artifact!=="string" || !NAME.test(artifact) ||
       typeof taskId!=="string" || !NAME.test(taskId))
      throw new TypeError("Invalid artifact or task identifier");
    const work=validatePureTask({operation,input});
    const stopping=new AbortController();
    const abortWhenStopped=()=>stopping.abort();
    const unsubscribe=coordinator.onStop(abortWhenStopped);
    signal?.addEventListener("abort",abortWhenStopped,{once:true});
    let lease,attested=false,released=false;
    try {
      if(signal?.aborted)throw new Error("Task aborted before lease acquisition");
      // Lease + immutable input are selected only by trusted local caller.
      lease=await coordinator.acquire(credential,{artifact,ttlMs:30_000});
      if(stopping.signal.aborted)throw new Error("Task stopped before launch");
      const verified=await this.execute(work,{timeoutMs,signal:stopping.signal});
      if(stopping.signal.aborted)throw new Error("Task stopped before attestation");
      // This final commit is serialized with STOP, and validates generation,
      // current lease owner and the scoped role credential again.
      const receipt=await coordinator.attest(credential,{
        artifact,generation:lease.generation,token:lease.token,
        task:taskId,resultDigest:verified.resultDigest
      });
      attested=true;
      try {
        await coordinator.release(credential,{
          artifact,generation:lease.generation,token:lease.token
        });
        released=true;
      }catch {
        // A racing operator STOP or a busy fail-closed lock can prevent
        // the release. The existing lease expires; do not hide attestation.
      }
      return Object.freeze({
        value:verified.value,digest:verified.resultDigest,
        generation:lease.generation,attested,released,
        sequence:receipt.seq,verifiedBy:verified.verification
      });
    }catch(error){
      if(lease && !attested) {
        // On failed verification, never attest. Cleanup is best-effort;
        // an expired lease can be reclaimed with a higher generation.
        try {await coordinator.release(credential,{
          artifact,generation:lease.generation,token:lease.token
        });}catch{}
      }
      throw error;
    }finally{
      signal?.removeEventListener("abort",abortWhenStopped);
      unsubscribe();
    }
  }
}
