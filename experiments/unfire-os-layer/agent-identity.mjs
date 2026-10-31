/**
 * Unfire OS Layer · research-only agent capability credentials.
 *
 * Only trusted local code can provision tokens. No credential issuance HTTP API.
 * A bearer token identifies an explicitly provisioned research role, NOT an
 * authenticated OS user, AI model, provider account, or sandboxed process.
 */
import { createHash, randomBytes } from "node:crypto";

const IDENT = /^[a-z][a-z0-9_-]{0,39}$/u;
const ACTIONS = Object.freeze([
  "state:read",
  "artifact:claim",
  "artifact:release",
  "task:complete"
]);
const MAX_AGENTS = 8;
const MAX_TTL_MS = 30 * 60 * 1000;
function validateName(value, label) {
  if (typeof value !== "string" || !IDENT.test(value)) {
    throw new TypeError("Invalid " + label);
  }
}
function record(value, fields) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).every(k => fields.includes(k));
}
const hash = token => createHash("sha256").update(token).digest("hex");

export class AgentCredentialRegistry {
  #entries = new Map();
  #mission;
  constructor(mission) {
    validateName(mission, "mission");
    this.#mission = mission;
  }
  /**
   * Trusted local bootstrap only. No HTTP call can invoke issue() or revoke().
   * Tokens are returned once; only SHA-256 digests remain in the registry.
   */
  issue(spec, now = Date.now()) {
    if (!record(spec, ["actor", "actions", "artifacts", "ttlMs"])) {
      throw new TypeError("Invalid credential specification");
    }
    validateName(spec.actor, "agent ID");
    if (spec.actor === "operator" || spec.actor === "admin") throw new Error("Reserved actor identity");
    if (!Array.isArray(spec.actions) || spec.actions.length < 1 ||
        spec.actions.length > ACTIONS.length ||
        spec.actions.some(a => !ACTIONS.includes(a)) ||
        new Set(spec.actions).size !== spec.actions.length) {
      throw new TypeError("Invalid agent action allowlist");
    }
    if (!Array.isArray(spec.artifacts) || spec.artifacts.length > 16 ||
        spec.artifacts.some(a => typeof a !== "string" || !IDENT.test(a)) ||
        new Set(spec.artifacts).size !== spec.artifacts.length) {
      throw new TypeError("Invalid artifact allowlist");
    }
    if (!Number.isSafeInteger(spec.ttlMs) || spec.ttlMs < 1000 ||
        spec.ttlMs > MAX_TTL_MS || !Number.isSafeInteger(now) || now < 0) {
      throw new TypeError("Invalid credential lifetime or clock");
    }
    if (this.#entries.size >= MAX_AGENTS ||
        [...this.#entries.values()].some(x => x.actor === spec.actor)) {
      throw new Error("Agent limit reached or duplicate identity");
    }
    if ((spec.actions.includes("artifact:claim") ||
         spec.actions.includes("artifact:release")) &&
        spec.artifacts.length === 0) {
      throw new Error("Write-capable agents require explicit artifact scopes");
    }
    // A task checkpoint is only an attestation by a token holder, not evidence
    // that a model performed, verified, or successfully delivered a real task.
    const token = randomBytes(32).toString("hex");
    const expiresAt = now + spec.ttlMs;
    this.#entries.set(hash(token), Object.freeze({
      actor: spec.actor, mission: this.#mission,
      actions: Object.freeze([...spec.actions]),
      artifacts: Object.freeze([...spec.artifacts]),
      expiresAt
    }));
    return Object.freeze({token, actor:spec.actor, expiresAt});
  }
  authorize(authorizationHeader, action, artifact = null, now = Date.now()) {
    if (typeof authorizationHeader !== "string" ||
        !/^Bearer [a-f0-9]{64}$/u.test(authorizationHeader) ||
        !ACTIONS.includes(action) ||
        !Number.isSafeInteger(now)) {
      return null;
    }
    const entry = this.#entries.get(hash(authorizationHeader.slice(7)));
    if (!entry || now >= entry.expiresAt || !entry.actions.includes(action)) return null;
    if (action.startsWith("artifact:") &&
        (!entry.artifacts.includes(artifact))) return null;
    return Object.freeze({actor:entry.actor, mission:entry.mission});
  }
  revoke(token) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/u.test(token)) return false;
    return this.#entries.delete(hash(token));
  }
  revokeActor(actor) {
    validateName(actor,"agent ID");
    let removed = 0;
    for (const [key,entry] of this.#entries) {
      if (entry.actor === actor) {
        this.#entries.delete(key);
        removed++;
      }
    }
    return removed;
  }
  roster(now = Date.now()) {
    return [...this.#entries.values()].map(x => ({
      actor:x.actor, mission:x.mission, actions:[...x.actions],
      artifacts:[...x.artifacts], expiresAt:x.expiresAt,
      active: now < x.expiresAt
    }));
  }
}
