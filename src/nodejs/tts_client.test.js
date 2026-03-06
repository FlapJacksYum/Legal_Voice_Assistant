/**
 * Unit tests for TTS client (config, chunking, WAV strip). No live Google TTS calls.
 * Run: node --test tts_client.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  createTtsClient,
  getSynthesisRequest,
  stripWavHeaderIfPresent,
  streamChunksAsBase64,
  synthesize,
  synthesizeAndStream,
  synthesizeWithRetry,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE,
  TWILIO_SAMPLE_RATE,
  MULAW_ENCODING,
  CHUNK_SIZE,
} = require('./tts_client.js');

describe('tts_client', () => {
  it('getSynthesisRequest returns MULAW 8kHz and default voice', () => {
    const req = getSynthesisRequest({ text: 'Hello' });
    assert.strictEqual(req.audioConfig.audioEncoding, MULAW_ENCODING);
    assert.strictEqual(req.audioConfig.sampleRateHertz, TWILIO_SAMPLE_RATE);
    assert.strictEqual(req.voice.languageCode, DEFAULT_LANGUAGE);
    assert.ok(req.voice.name);
    assert.strictEqual(req.input.text, 'Hello');
  });

  it('getSynthesisRequest accepts SSML and overrides', () => {
    const req = getSynthesisRequest({
      ssml: '<speak>Hi</speak>',
      voiceName: 'en-US-Custom-1',
      languageCode: 'en-GB',
    });
    assert.strictEqual(req.input.ssml, '<speak>Hi</speak>');
    assert.strictEqual(req.voice.name, 'en-US-Custom-1');
    assert.strictEqual(req.voice.languageCode, 'en-GB');
  });

  it('createTtsClient returns client with synthesizeSpeech', () => {
    const client = createTtsClient();
    assert.strictEqual(typeof client.synthesizeSpeech, 'function');
  });

  it('stripWavHeaderIfPresent leaves non-WAV buffer unchanged', () => {
    const raw = Buffer.from([0x00, 0xff, 0x7f]);
    const out = stripWavHeaderIfPresent(raw);
    assert.strictEqual(out.length, 3);
    assert.strictEqual(out[0], 0x00);
  });

  it('stripWavHeaderIfPresent strips RIFF WAV data chunk', () => {
    const data = Buffer.alloc(100);
    data.write('RIFF', 0);
    data.writeUInt32LE(92, 4);
    data.write('WAVE', 8);
    data.write('fmt ', 12);
    data.writeUInt32LE(16, 16);
    data.write('data', 36);
    data.writeUInt32LE(50, 40);
    for (let i = 0; i < 50; i++) data[44 + i] = i;
    const out = stripWavHeaderIfPresent(data);
    assert.strictEqual(out.length, 50);
    assert.strictEqual(out[0], 0);
    assert.strictEqual(out[49], 49);
  });

  it('streamChunksAsBase64 invokes onChunk per chunk', () => {
    const chunks = [];
    const buf = Buffer.alloc(400);
    streamChunksAsBase64(buf, (b64) => chunks.push(b64), 100);
    assert.strictEqual(chunks.length, 4);
    assert.strictEqual(Buffer.from(chunks[0], 'base64').length, 100);
  });

  it('synthesize returns buffer from mock client', async () => {
    const mulawSamples = Buffer.alloc(160);
    const mockClient = {
      synthesizeSpeech: async () => [{
        audioContent: mulawSamples,
      }],
    };
    const out = await synthesize(mockClient, { input: { text: 'Hi' }, voice: {}, audioConfig: {} });
    assert.ok(Buffer.isBuffer(out));
    assert.strictEqual(out.length, 160);
  });

  it('synthesize strips WAV header when mock returns WAV', async () => {
    const wav = Buffer.alloc(44 + 80);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(80 + 36, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.write('data', 36);
    wav.writeUInt32LE(80, 40);
    for (let i = 0; i < 80; i++) wav[44 + i] = i;
    const mockClient = {
      synthesizeSpeech: async () => [{ audioContent: wav }],
    };
    const out = await synthesize(mockClient, { input: { text: 'Hi' }, voice: {}, audioConfig: {} });
    assert.strictEqual(out.length, 80);
    assert.strictEqual(out[0], 0);
  });

  it('synthesize throws when response is empty', async () => {
    const mockClient = {
      synthesizeSpeech: async () => [{ audioContent: null }],
    };
    await assert.rejects(
      () => synthesize(mockClient, { input: { text: 'Hi' }, voice: {}, audioConfig: {} }),
      /empty audio/
    );
  });

  it('synthesizeAndStream sends chunks to onChunk callback', async () => {
    const mulawSamples = Buffer.alloc(400);
    const mockClient = {
      synthesizeSpeech: async () => [{ audioContent: mulawSamples }],
    };
    const chunks = [];
    await synthesizeAndStream(mockClient, 'Hello', (b64) => chunks.push(b64), { chunkSize: 160 });
    assert.ok(chunks.length >= 2);
    const totalLen = chunks.reduce((acc, b64) => acc + Buffer.from(b64, 'base64').length, 0);
    assert.strictEqual(totalLen, 400);
  });

  it('synthesizeWithRetry retries on retryable error then succeeds', async () => {
    let callCount = 0;
    const mockClient = {
      synthesizeSpeech: async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Unavailable');
          err.code = 14;
          throw err;
        }
        return [{ audioContent: Buffer.alloc(80) }];
      },
    };
    const out = await synthesizeWithRetry(mockClient, { input: { text: 'Hi' }, voice: {}, audioConfig: {} }, 2);
    assert.strictEqual(callCount, 2);
    assert.strictEqual(out.length, 80);
  });
});
