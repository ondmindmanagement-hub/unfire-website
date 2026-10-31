/**
 * Unfire OS Layer · in-process research coordinator (not a remote service).
 * Credential checks happen before every journal request. The journal then
 * checks ownership, fencing and STOP under its single exclusive writer lock.
 * Zero external agents are provisioned by default.
 */
import { AgentCredentialRegistry } from "./agent-identity.mjs";
import { UnifiedControlPlane } from "./control-plane.mjs";

export class ResearchCoordinator {
  #registry;#plane;#stopListeners=new Set();
  constructor(registry,plane){
    if(!(registry instanceof AgentCredentialRegistry)||
      !(plane instanceof UnifiedControlPlane))throw new TypeError("Invalid coordinator dependencies");
    this.#registry=registry;this.#plane=plane;
  }
  static async open({directory,mission="demo",agentSpecs=[]}={}){
    const registry=new AgentCredentialRegistry(mission);
    if(!Array.isArray(agentSpecs)||agentSpecs.length>8)throw new TypeError("Invalid agent list");
    const credentials=agentSpecs.map(s=>registry.issue(s));
    const plane=await UnifiedControlPlane.open(directory,mission);
    const coordinator=new ResearchCoordinator(registry,plane);
    return {coordinator,credentials:Object.freeze(credentials)};
  }
  #allow(header,action,artifact=null){
    const identity=this.#registry.authorize(header,action,artifact);
    if(!identity)throw new Error("Research role denied");
    return identity.actor;
  }
  async createMission(now){return this.#plane.createMission(now)}
  async stopMission(now){
    const accepted=await this.#plane.stopMission(now);
    // Only same-process subscribers receive immediate cancellation.
    // The journal remains authoritative for accepted STOP and attestation.
    for(const listener of this.#stopListeners) {
      try {listener();} catch { /* Never undo committed STOP. */ }
    }
    return accepted;
  }
  onStop(callback){
    if(typeof callback!=="function")throw new TypeError("STOP callback required");
    this.#stopListeners.add(callback);
    return ()=>this.#stopListeners.delete(callback);
  }
  async read(header){
    this.#allow(header,"state:read");
    return this.#plane.inspect();
  }
  async acquire(header,{artifact,ttlMs,now}){
    const actor=this.#allow(header,"artifact:claim",artifact);
    return this.#plane.acquire({actor,artifact,ttlMs,now});
  }
  async attest(header,{artifact,generation,token,task,resultDigest,now}){
    const actor=this.#allow(header,"artifact:claim",artifact);
    if(this.#allow(header,"task:complete")!==actor)throw new Error("Research role denied");
    return this.#plane.attest({actor,artifact,generation,token,task,resultDigest,now});
  }
  async release(header,{artifact,generation,token,now}){
    const actor=this.#allow(header,"artifact:release",artifact);
    return this.#plane.release({actor,artifact,generation,token,now});
  }
  revoke(actor){return this.#registry.revokeActor(actor)}
  roster(){return this.#registry.roster()}
}
