/**
 * Unfire OS · deterministic, measurement-gated synthetic concurrency choice.
 * Profiles are local research data, not attested measurements or AI performance.
 */
import { createHash } from "node:crypto";
import { validateTasks, hashFold } from "../unfire-concurrency-lab/compute.mjs";

export const MODES = Object.freeze(["sequential","1","2","4","8"]);
export const MIN_SAMPLES = 3;
export const MIN_ABSOLUTE_SAVING_MS = 5;
export const MIN_RELATIVE_SAVING = 0.15;
export const TIE_TOLERANCE = 0.03;
const MAX_MEASURED_MS = 30000;

function digest(data) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}
export function taskSignature(input) {
  const tasks = validateTasks(input);
  return digest(tasks.map(({id,operation,rounds,salt})=>[id,operation,rounds,salt]));
}
export function expectedDigest(input) {
  const tasks=validateTasks(input);
  return digest(tasks.map(task=>[task.id,hashFold(task)]));
}
function median(numbers) {
  const ordered=[...numbers].sort((a,b)=>a-b);
  return ordered[Math.floor(ordered.length/2)];
}
function evaluateSamples(mode, data, expected, count) {
  if (!Array.isArray(data) || data.length < MIN_SAMPLES || data.length > 10)
    return null;
  const durations=[];
  for(const item of data){
    if(!item || Object.getPrototypeOf(item)!==Object.prototype ||
       Object.keys(item).sort().join(",")!=="elapsedMs,resultDigest,verified" ||
       typeof item.elapsedMs!=="number" || !Number.isFinite(item.elapsedMs) ||
       item.elapsedMs<=0 || item.elapsedMs>MAX_MEASURED_MS ||
       item.verified!==count || item.resultDigest!==expected) return null;
    durations.push(item.elapsedMs);
  }
  return Object.freeze({mode,medianMs:median(durations),samples:durations.length});
}
/** Fail closed to sequential on missing/stale/malformed/unverified research evidence. */
export function decide(input, profile, {minAbsoluteMs=MIN_ABSOLUTE_SAVING_MS,
    minRelative=MIN_RELATIVE_SAVING}={}) {
  const tasks=validateTasks(input);
  if(typeof minAbsoluteMs!=="number" || !Number.isFinite(minAbsoluteMs) ||
     minAbsoluteMs<0 || minAbsoluteMs>1000 ||
     typeof minRelative!=="number" || !Number.isFinite(minRelative) ||
     minRelative<0 || minRelative>0.95) throw new TypeError("Invalid selection threshold");
  const fallback=(reason)=>Object.freeze({
    mode:"sequential",lanes:0,reason,
    profileTrusted:false,baselineMedianMs:null,chosenMedianMs:null
  });
  if(!profile || Object.getPrototypeOf(profile)!==Object.prototype ||
     Object.keys(profile).sort().join(",")!=="samples,signature,version" ||
     profile.version!==1 || profile.signature!==taskSignature(tasks) ||
     !profile.samples || Object.getPrototypeOf(profile.samples)!==Object.prototype ||
     Object.keys(profile.samples).some(name=>!MODES.includes(name)))
    return fallback("missing_or_incompatible_evidence");
  const target=expectedDigest(tasks);
  const baseline=evaluateSamples("sequential",profile.samples.sequential,target,tasks.length);
  if(!baseline) return fallback("unverified_sequential_baseline");
  // If a submitted mode has corrupt or failed evidence, reject the entire profile.
  // Omitted modes are allowed: a calibration may have intentionally measured fewer lanes.
  const candidates=[];
  for (const mode of MODES.slice(1)) {
    if (!Object.hasOwn(profile.samples,mode)) continue;
    const sample=evaluateSamples(mode,profile.samples[mode],target,tasks.length);
    if (!sample) return fallback("invalid_parallel_evidence");
    candidates.push(sample);
  }
  const valid=[baseline,...candidates];
  let best=baseline;
  for(const candidate of valid.slice(1)) {
    const benefit=baseline.medianMs-candidate.medianMs;
    const relative=benefit/baseline.medianMs;
    if(benefit<minAbsoluteMs || relative<minRelative)continue;
    // Favor fewer workers when candidate timings are within 3% of current best.
    if(best.mode==="sequential" || candidate.medianMs < best.medianMs*(1-TIE_TOLERANCE))
      best=candidate;
  }
  const winning=best.mode!=="sequential";
  return Object.freeze({
    mode:best.mode,lanes:winning?Number(best.mode):0,
    reason:winning?"measured_advantage":"no_proven_parallel_benefit",
    profileTrusted:false, // Local synthetic measurements are never trusted attestation.
    baselineMedianMs:baseline.medianMs,chosenMedianMs:best.medianMs
  });
}
