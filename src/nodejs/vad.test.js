/**
 * Unit tests for Voice Activity Detection (VAD) — BE-005.
 * Run: node --test vad.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  mulawDecode,
  mulawDecodeToLinear,
  rms,
  createVadState,
  processChunk,
  FRAME_SAMPLES,
  DEFAULT_ENERGY_THRESHOLD,
} = require('./vad.js');

describe('vad', () => {
  it('mulawDecode returns 0 for mulaw 0xff (silence)', () => {
    assert.strictEqual(mulawDecode(0xff), 0);
  });

  it('mulawDecodeToLinear returns Int16Array of same length', () => {
    const mulaw = Buffer.from([0xff, 0x7f, 0x00]);
    const linear = mulawDecodeToLinear(mulaw);
    assert.strictEqual(linear.length, 3);
    assert.strictEqual(linear.constructor, Int16Array);
  });

  it('rms returns 0 for empty array', () => {
    assert.strictEqual(rms(new Int16Array(0)), 0);
  });

  it('rms returns correct value for known samples', () => {
    const samples = new Int16Array([1000, 1000, 1000, 1000]);
    assert.ok(Math.abs(rms(samples) - 1000) < 1);
  });

  it('createVadState returns state with buffer and threshold', () => {
    const state = createVadState();
    assert.strictEqual(state.buffer.length, 0);
    assert.strictEqual(state.consecutiveSpeechFrames, 0);
    assert.strictEqual(state.energyThreshold, DEFAULT_ENERGY_THRESHOLD);
  });

  it('processChunk with silent payload does not detect speech', () => {
    const state = createVadState({ energyThreshold: 1000 });
    const silent = Buffer.alloc(320, 0xff);
    const base64 = silent.toString('base64');
    const { speechDetected } = processChunk(base64, state);
    assert.strictEqual(speechDetected, false);
  });

  it('processChunk with loud payload detects speech when above threshold', () => {
    const state = createVadState({ energyThreshold: 1000, speechFrameCount: 2 });
    const loud = Buffer.alloc(320, 0x00);
    const base64 = loud.toString('base64');
    const r1 = processChunk(base64, state);
    const r2 = processChunk(base64, state);
    assert.strictEqual(r1.speechDetected || r2.speechDetected, true);
  });

  it('processChunk accumulates partial frames', () => {
    const state = createVadState({ energyThreshold: 100000 });
    const small = Buffer.alloc(80, 0xff);
    const { speechDetected } = processChunk(small.toString('base64'), state);
    assert.strictEqual(speechDetected, false);
    assert.strictEqual(state.buffer.length, 80);
  });

  it('when VAD detects speech, greeting can be interrupted (consumer sets greetingAborted)', () => {
    const state = createVadState({ energyThreshold: 1000, speechFrameCount: 2 });
    const loud = Buffer.alloc(320, 0x00);
    const base64 = loud.toString('base64');
    let greetingAborted = false;
    const r1 = processChunk(base64, state);
    if (r1.speechDetected) greetingAborted = true;
    const r2 = processChunk(base64, state);
    if (r2.speechDetected) greetingAborted = true;
    assert.strictEqual(greetingAborted, true, 'call handler should set greetingAborted when speechDetected');
  });
});
