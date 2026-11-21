/**
 * Unfire OS Layer · local, manually started research mission service.
 *
 * This is NOT an authenticated OS-user identity service, sandbox or remote
 * agent bridge. A fresh token in the URL fragment gates access per launch.
 * The operator is the ONLY actor. No models, shell execution or external APIs.
 */
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LocalMissionMemory, MemoryPolicy, AuthorizedMission } from "./memory.mjs";
import { AgentCredentialRegistry } from "./agent-identity.mjs";

const codeDir = dirname(fileURLToPath(import.meta.url));
const SAFE_HOST = "127.0.0.1";
const MAX_BODY = 1800;
const ROUTES = Object.freeze({
  "/mission-console.html": ["mission-console.html","text/html; charset=utf-8"],
  "/mission-console.mjs": ["mission-console.mjs","text/javascript; charset=utf-8"]
});
const IDENT = /^[a-z][a-z0-9_-]{0,39}$/u;
const OPERATIONS = Object.freeze(["MISSION_CREATED","ARTIFACT_CLAIMED","ARTIFACT_RELEASED","TASK_COMPLETED","MISSION_STOPPED"]);
function json(res,status,value) {
  const body=JSON.stringify(value);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body)});
  res.end(body);
}
function allowedToken(given,expected) {
  if(typeof given!=="string" || !/^Bearer [a-f0-9]{64}$/u.test(given)) return false;
  return timingSafeEqual(Buffer.from(given.slice(7),"hex"),Buffer.from(expected,"hex"));
}
function exact(object,fields) {
  return object !== null && typeof object==="object" && !Array.isArray(object) &&
    Object.getPrototypeOf(object)===Object.prototype &&
    Object.keys(object).every(key=>fields.includes(key));
}
async function bodyJson(req) {
  let size=0, chunks=[];
  for await(const chunk of req) {
    size+=chunk.length;
    if(size>MAX_BODY) throw new Error("Request payload too large");
    chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString("utf8"));}
  catch {throw new Error("Invalid JSON");}
}
function reject(res,status,message) {json(res,status,{error:message});}
export async function createMissionServer({directory,mission="demo",port=4178,token=randomBytes(32).toString("hex"),agentSpecs=[]}={}) {
  if(typeof directory!=="string" || !isAbsolute(directory)) throw new TypeError("Absolute, dedicated workspace required");
  if(typeof mission!=="string" || !IDENT.test(mission)) throw new TypeError("Invalid mission identifier");
  if(!Number.isInteger(port) || port<0 || port>65535) throw new TypeError("Invalid port");
  if(!/^[a-f0-9]{64}$/u.test(token)) throw new TypeError("Invalid session token");
  if (!Array.isArray(agentSpecs) || agentSpecs.length>8) throw new TypeError("Invalid agent bootstrap list");
  const registry = new AgentCredentialRegistry(mission);
  const agentCredentials = agentSpecs.map(spec=>registry.issue(spec));
  const store=await LocalMissionMemory.open(directory);
  const expiry=Date.now()+2*60*60*1000;
  const grants=OPERATIONS.map(type=>({
    actor:"operator",mission,
    capability:({
      MISSION_CREATED:"mission:create",ARTIFACT_CLAIMED:"artifact:claim",
      ARTIFACT_RELEASED:"artifact:release",TASK_COMPLETED:"task:complete",
      MISSION_STOPPED:"mission:stop"
    })[type],
    expires:new Date(expiry).toISOString()
  }));
  const missionSession=new AuthorizedMission(store,new MemoryPolicy(grants));
  const server=createServer(async(req,res)=>{
    const authority=req.headers.host;
    const origin="http://"+SAFE_HOST+":"+server.address()?.port;
    const localAddress=req.socket.remoteAddress;
    res.setHeader("Cache-Control","no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","DENY");
    res.setHeader("Referrer-Policy","no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy","same-origin");
    res.setHeader("Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'");
    if(localAddress!=="127.0.0.1" || authority!==SAFE_HOST+":"+server.address()?.port) {
      reject(res,403,"Invalid host or network origin"); return;
    }
    if(req.url==="/") {
      res.writeHead(302,{"Location":"/mission-console.html"}); res.end();return;
    }
    if(Object.hasOwn(ROUTES,req.url) && req.method==="GET") {
      try {
        const [file,mime]=ROUTES[req.url];
        const data=await readFile(join(codeDir,file));
        res.writeHead(200,{"Content-Type":mime,"Content-Length":data.length});res.end(data);
      } catch {reject(res,500,"Static file not available");}
      return;
    }
    if(!req.url?.startsWith("/api/")) {reject(res,404,"Not found");return;}
    if (req.url==="/api/agent/state" && req.method==="GET") {
      const identity=registry.authorize(req.headers.authorization,"state:read");
      if(!identity) {reject(res,401,"Agent credential invalid or insufficient");return;}
      try {
        const view=await store.read();
        json(res,200,{mission,actor:identity.actor,summary:view.summary,
          count:view.count,realAgentExecutions:0});
      } catch{reject(res,409,"Local mission journal invalid");}
      return;
    }
    if (req.url==="/api/agent/events" && req.method==="POST") {
      if(req.headers.origin && req.headers.origin!==origin) {reject(res,403,"Origin rejected");return;}
      if(req.headers["content-type"]?.split(";")[0]?.toLowerCase()!=="application/json") {
        reject(res,415,"JSON content required");return;
      }
      try {
        const submitted=await bodyJson(req);
        if(!exact(submitted,["type","artifact","task"])) throw new Error("Invalid event fields");
        const action=({
          ARTIFACT_CLAIMED:"artifact:claim",
          ARTIFACT_RELEASED:"artifact:release",
          TASK_COMPLETED:"task:complete"
        })[submitted.type];
        if (!action) throw new Error("Unsupported agent operation");
        const identity=registry.authorize(req.headers.authorization,action,submitted.artifact);
        if(!identity) {reject(res,403,"Agent permission denied");return;}
        const event={type:submitted.type,mission,actor:identity.actor};
        if(submitted.artifact!==undefined) event.artifact=submitted.artifact;
        if(submitted.task!==undefined) event.task=submitted.task;
        const output=await store.append(event);
        json(res,201,{seq:output.seq,hash:output.hash,actor:identity.actor});
      } catch(e) {reject(res,409,"Research event rejected: "+e.message);}
      return;
    }
    if(Date.now()>=expiry) {reject(res,401,"Research session expired. Restart locally.");return;}
    if(!allowedToken(req.headers.authorization,token)) {reject(res,401,"Session token required");return;}
    if(req.url==="/api/state" && req.method==="GET") {
      try {
        const state=await missionSession.inspect();
        json(res,200,{mission,records:state.records,summary:state.summary,connectedAgents:0});
      } catch{reject(res,409,"Local journal unavailable or invalid");}
      return;
    }
    if(req.url==="/api/events" && req.method==="POST") {
      if(req.headers.origin!==origin) {reject(res,403,"Origin rejected");return;}
      if(req.headers["content-type"]?.split(";")[0]?.toLowerCase()!=="application/json") {
        reject(res,415,"JSON content required");return;
      }
      try {
        const submitted=await bodyJson(req);
        if(!exact(submitted,["type","artifact","task"])) throw new Error("Invalid event fields");
        if(!OPERATIONS.includes(submitted.type)) throw new Error("Operation forbidden");
        const event={type:submitted.type,mission,actor:"operator"};
        if(submitted.artifact!==undefined) event.artifact=submitted.artifact;
        if(submitted.task!==undefined) event.task=submitted.task;
        const result=await missionSession.record(event);
        json(res,201,{seq:result.seq,hash:result.hash});
      } catch(e) {
        if(e.message==="Access denied by explicit policy") reject(res,403,"Operation authorization expired");
        else reject(res,409,"Operation rejected: "+e.message);
      }
      return;
    }
    reject(res,405,"Method or route not allowed");
  });
  server.requestTimeout=5_000;
  server.headersTimeout=5_000;
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(port,SAFE_HOST,resolve);
  });
  const address=SAFE_HOST+":"+server.address().port;
  return {
    server, token, port:server.address().port,
    agentCredentials: Object.freeze(agentCredentials),
    revokeResearchAgent: actor=>registry.revokeActor(actor),
    researchRoster: ()=>registry.roster(),
    url:"http://"+address+"/mission-console.html#"+token,
    close:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))
  };
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const directory=process.argv[2];
  const mission=process.argv[3]??"demo";
  if(!directory) {
    console.error("Usage: node mission-service.mjs /absolute/isolated/workspace [mission_id]");
    process.exitCode=2;
  } else {
    createMissionServer({directory,mission}).then(({url})=>{
      console.log("Unfire OS · isolated local research service");
      console.log("Open locally (token is a temporary secret): "+url);
      console.log("Expires in 2 hours. Press Ctrl+C to stop. No external agents connected.");
    }).catch(error=>{
      console.error("Research service failed: "+error.message);
      process.exitCode=1;
    });
  }
}
