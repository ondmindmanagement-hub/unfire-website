/* Run: node --test apps/ai-token-counter/engine.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const e = require("./engine.js");
const base = {
  inputText: "", outputText: "", charsPerToken: 4,
  exactInput: "", exactOutput: "", inputRate: "", outputRate: "", calls: 1
};
function calc(fields) { return e.calculate({ ...base, ...fields }); }
test("empty text never invents tokens or costs", () => {
  const r = calc({});
  assert.equal(r.input.estimate, 0);
  assert.equal(r.output.estimate, 0);
  assert.equal(r.input.words, 0);
  assert.equal(r.input.lines, 0);
  assert.equal(r.price, null);
  assert.equal(r.priced, false);
});
test("text estimates use Unicode code points, not UTF-16 halves", () => {
  const r = calc({ inputText:"hello👋", outputText:"你好" });
  assert.equal(r.input.characters, 6);
  assert.equal(r.input.units, 7);
  assert.equal(r.input.estimate, 2);
  assert.equal(r.output.estimate, 1);
});
test("words and lines handle Unicode, punctuation, blank text and newlines", () => {
  const r = calc({ inputText:"one-two 你好\nthree’s, 42\r\n" });
  assert.equal(r.input.words, 4);
  assert.equal(r.input.lines, 3);
});
test("manual exact counts override heuristic including exact zero", () => {
  const r = calc({ inputText:"a".repeat(80), exactInput:0, outputText:"abc", exactOutput:500 });
  assert.equal(r.input.estimate, 20);
  assert.equal(r.inputTokens, 0);
  assert.equal(r.outputTokens, 500);
  assert.equal(r.inputExact, true);
  assert.equal(r.outputExact, true);
});
test("different rates and volume produce unrounded arithmetic", () => {
  const r = calc({ exactInput:2000000, exactOutput:500000, inputRate:"2.5", outputRate:"10", calls:100 });
  assert.equal(r.price.input, 5);
  assert.equal(r.price.output, 5);
  assert.equal(r.price.total, 10);
  assert.equal(r.price.monthly, 1000);
});
test("one missing price leaves all costs explicitly unset", () => {
  const r = calc({ inputText:"Hello", inputRate:3 });
  assert.equal(r.inputRate, 3);
  assert.equal(r.outputRate, null);
  assert.equal(r.price, null);
});
test("zero-price free-tier scenario is 0 dollars, not a missing rate", () => {
  const r = calc({ exactInput:100, exactOutput:200, inputRate:0, outputRate:0 });
  assert.equal(r.priced, true);
  assert.equal(r.price.total, 0);
  assert.equal(e.money(0), "$0.00");
});
test("invalid values are rejected instead of silently clamped", () => {
  const bad = [
    { charsPerToken:"0" }, { charsPerToken:"" }, { charsPerToken:"13" },
    { exactInput:"-1" }, { exactInput:"12.1" }, { exactOutput:"Infinity" },
    { calls:"0" }, { calls:"1.2" }, { calls:"1000001" }, { inputRate:"-5" },
    { outputRate:"100001" }, { inputText:"x".repeat(e.MAX_TEXT + 1) }
  ];
  for (const fields of bad) assert.throws(() => calc(fields), { name:"RangeError" });
});
test("max lengths and fractional count calibration are supported", () => {
  const r = calc({ inputText:"a".repeat(e.MAX_TEXT), charsPerToken:2.5 });
  assert.equal(r.input.estimate, 100000);
  assert.equal(r.input.characters, e.MAX_TEXT);
});
test("CSV contains only derived metrics, never pasted original text", () => {
  const secret = "USER_PRIVATE_SECRET_93";
  const r = calc({ inputText: secret, outputText: "OUTPUT_SECRET_21", inputRate: 2, outputRate: 5 });
  const csv = e.report(r);
  assert.ok(csv.startsWith('"Metric","Value"\r\n'));
  assert.ok(csv.includes('"Input count source","Heuristic estimate"'));
  assert.ok(!csv.includes(secret));
  assert.ok(!csv.includes("OUTPUT_SECRET_21"));
  assert.ok(csv.includes('Estimated monthly cost (USD)'));
});
test("formatted money distinguishes tiny values and missing prices", () => {
  assert.equal(e.money(null), "Not set");
  assert.equal(e.money(0), "$0.00");
  assert.equal(e.money(0.0000001), "<$0.000001");
  assert.equal(e.money(1), "$1.00");
});
