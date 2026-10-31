/**
 * Unfire OS · public, deterministic tiny local-model evaluation fixtures.
 * No user content, external tool access, private data, API keys or live effects.
 */
export const FIXTURES=Object.freeze([
  Object.freeze({
    id:"arithmetic",
    prompt:"Compute 17 + 25. Reply with only the integer. No explanation.",
    kind:"exact",expected:"42"
  }),
  Object.freeze({
    id:"code_uppercase",
    prompt:"Convert the code ax-7b to uppercase. Reply with only the converted code.",
    kind:"exact",expected:"AX-7B"
  }),
  Object.freeze({
    id:"json_format",
    prompt:'Return a valid single-line JSON object with exactly two keys: "ok" true and "count" 3. No markdown, no extra text.',
    kind:"json",expected:Object.freeze({ok:true,count:3})
  })
]);
export const ALLOWED_MODEL="qwen2.5:1.5b";
export const FIXTURE_IDS=Object.freeze(FIXTURES.map(f=>f.id));
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
export function fixtureById(id){
  if(typeof id!=="string")throw new TypeError("Invalid fixture");
  const fixture=FIXTURES.find(f=>f.id===id);
  if(!fixture)throw new TypeError("Only synthetic approved evaluation fixtures are allowed");
  return fixture;
}
export function evaluateAnswer(fixture,output) {
  if(!fixture || !FIXTURES.some(f=>f===fixture) || typeof output!=="string" ||
     output.length>2048) throw new TypeError("Invalid evaluation payload");
  const text=output.trim();
  if(fixture.kind==="exact") {
    const valid=text===fixture.expected;
    return Object.freeze({id:fixture.id,passed:valid,score:valid?1:0,criterion:"strict_exact_match"});
  }
  try{
    const parsed=JSON.parse(text);
    const keys=parsed && !Array.isArray(parsed) && typeof parsed==="object"
      ?Object.keys(parsed).sort():[];
    const valid=keys.length===2 && keys[0]==="count"&&keys[1]==="ok"&&
      own(parsed,"ok")&&own(parsed,"count")&&parsed.ok===true&&parsed.count===3;
    return Object.freeze({id:fixture.id,passed:valid,score:valid?1:0,criterion:"strict_json_schema"});
  }catch {
    return Object.freeze({id:fixture.id,passed:false,score:0,criterion:"strict_json_schema"});
  }
}
