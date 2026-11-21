/* Run: node --test apps/archer-web/dsp.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const dsp = require("./dsp.js");
const defaults = { gainDb: 0, thresholdDb: -9, mix: 1 };
const dry = { gainDb: 10, thresholdDb: -24, mix: 0 };
function sampleBuffer(channels, sampleRate = 48000) {
  return { numberOfChannels: channels.length, sampleRate,
    length: channels[0].length, getChannelData: index => channels[index] };
}
test("curve is bounded, monotonic and symmetric", () => {
  const values = dsp.curve(defaults, 4097);
  assert.equal(values.length, 4097);
  assert.ok(Math.abs(values[0] + 1) < .000001);
  assert.equal(values[2048], 0);
  assert.ok(Math.abs(values[4096] - 1) < .000001);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] >= values[i-1]);
    assert.ok(Math.abs(values[i] + values[4096-i]) < .000001);
  }
});
test("dry blend preserves original signal and ignores input gain", () => {
  for (const x of [-1, -.5, 0, .5, 1]) {
    assert.ok(Math.abs(dsp.processSample(x, dry) - x) < .000001);
  }
});
test("wet blend saturates, stays bounded and retains sign", () => {
  const v = dsp.processSample(.7, defaults);
  assert.ok(v > .7 && v <= 1);
  assert.ok(Math.abs(v + dsp.processSample(-.7, defaults)) < .000001);
  assert.equal(dsp.processSample(0, defaults), 0);
});
test("invalid parameters are rejected", () => {
  for (const cfg of [{ ...defaults, gainDb: 20 }, { ...defaults, thresholdDb: -30 },
    { ...defaults, mix: -1 }, { ...defaults, mix: Number.NaN }]) {
    assert.throws(() => dsp.factors(cfg), RangeError);
  }
});
test("16-bit WAV mono header, length and PCM are correct", () => {
  const original = Float32Array.from([-1, -.5, 0, .5, 1]);
  const file = dsp.encodeWav(sampleBuffer([original], 44100), dry);
  const data = new DataView(file);
  const str = (pos, n) => [...Array(n)].map((_, i) => String.fromCharCode(data.getUint8(pos+i))).join("");
  assert.equal(str(0,4), "RIFF"); assert.equal(str(8,4), "WAVE");
  assert.equal(str(12,4), "fmt "); assert.equal(str(36,4), "data");
  assert.equal(data.getUint16(20,true), 1);
  assert.equal(data.getUint16(22,true), 1);
  assert.equal(data.getUint32(24,true), 44100);
  assert.equal(data.getUint32(40,true), 10);
  assert.equal(data.getInt16(44,true), -32768);
  assert.equal(data.getInt16(48,true), 0);
  assert.equal(data.getInt16(52,true), 32767);
  assert.deepEqual([...original], [-1,-.5,0,.5,1]);
});
test("stereo samples are interleaved", () => {
  const out = dsp.encodeWav(sampleBuffer([Float32Array.from([1,0]), Float32Array.from([0,-1])]), dry);
  const dv = new DataView(out);
  assert.equal(dv.getUint16(22, true), 2);
  assert.equal(dv.getInt16(44, true), 32767);
  assert.equal(dv.getInt16(46, true), 0);
  assert.equal(dv.getInt16(48, true), 0);
  assert.equal(dv.getInt16(50, true), -32768);
});
test("rejects empty, multichannel and oversized buffers safely", () => {
  assert.throws(() => dsp.encodeWav(sampleBuffer([]), defaults));
  assert.throws(() => dsp.encodeWav(sampleBuffer([new Float32Array(0)]), defaults));
  assert.throws(() => dsp.encodeWav(sampleBuffer([new Float32Array(1), new Float32Array(1), new Float32Array(1)]), defaults));
  assert.throws(() => dsp.encodeWav({numberOfChannels:2,length:12000001,sampleRate:48000},defaults));
});
test("non-finite samples become safe silence", () => {
  const out = dsp.encodeWav(sampleBuffer([Float32Array.from([Number.NaN, Number.POSITIVE_INFINITY])]), defaults);
  const dv = new DataView(out);
  assert.equal(dv.getInt16(44,true), 0); assert.equal(dv.getInt16(46,true), 0);
});
