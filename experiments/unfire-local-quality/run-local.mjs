/**
 * Invoke ONLY after operator starts a temporary existing Ollama loopback server.
 * No models are installed, started or downloaded by this script.
 */
import { LocalQualitySession, evaluateAll } from "./local-adapter.mjs";
if(process.env.UNFIRE_EXPLICIT_LOCAL_TEST!=="YES") {
  throw new Error("Operator must explicitly enable the zero-spend local fixture test");
}
const session=new LocalQualitySession({
  explicitlyApproved:true,
  timeoutMs:20000
});
try {
  const report=await evaluateAll(session);
  console.log(JSON.stringify({
    study:"Unfire OS local on-device model quality · public tiny fixtures",
    environment:"existing model via isolated loopback service",
    model:report.model,total:report.total,passed:report.passed,
    qualityGate:report.qualityGate,externalActionAllowed:report.externalActionAllowed,
    attempts:report.attempted,externalCalls:report.externalCalls,
    providerCostUsd:report.providerCostUsd,
    results:report.results.map(({id,passed,criterion,elapsedMs,reportedOutputTokens})=>
      ({id,passed,criterion,elapsedMs,reportedOutputTokens})),
    caveat:"3 hand-picked trivial prompts cannot establish agent quality, general intelligence, reliability, privacy or usable product performance. No API costs, but local compute and electricity are not free."
  },null,2));
}finally {
  session.stop();
}
