/**
 * Unit tests for STT client (config, API shape). No live Google API calls.
 * Run: node --test stt_client.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  createSpeechClient,
  getStreamingConfig,
  startStreamingRecognize,
  DEFAULT_LANGUAGE,
  DEFAULT_SAMPLE_RATE,
  ENCODING_MULAW,
} = require('./stt_client.js');

describe('stt_client', () => {
  it('getStreamingConfig returns config with MULAW 8kHz and en-US', () => {
    const config = getStreamingConfig();
    assert.strictEqual(config.config.encoding, ENCODING_MULAW);
    assert.strictEqual(config.config.sampleRateHertz, DEFAULT_SAMPLE_RATE);
    assert.strictEqual(config.config.languageCode, DEFAULT_LANGUAGE);
    assert.strictEqual(config.config.enableAutomaticPunctuation, true);
    assert.strictEqual(config.interimResults, true);
  });

  it('getStreamingConfig accepts overrides', () => {
    const config = getStreamingConfig({
      languageCode: 'es-US',
      sampleRateHertz: 16000,
      interimResults: false,
    });
    assert.strictEqual(config.config.languageCode, 'es-US');
    assert.strictEqual(config.config.sampleRateHertz, 16000);
    assert.strictEqual(config.interimResults, false);
  });

  it('createSpeechClient returns an object with streamingRecognize', () => {
    const client = createSpeechClient();
    assert.strictEqual(typeof client.streamingRecognize, 'function');
  });

  it('startStreamingRecognize returns writeAudioChunk and end', () => {
    const mockStream = {
      writable: true,
      write: () => {},
      end: () => {},
      on: () => mockStream,
    };
    const mockClient = {
      streamingRecognize: () => mockStream,
    };
    const result = startStreamingRecognize(mockClient, {}, {
      onTranscript: () => {},
    });
    assert.strictEqual(typeof result.writeAudioChunk, 'function');
    assert.strictEqual(typeof result.end, 'function');
    assert.ok(result.stream);
    result.writeAudioChunk(Buffer.from('test'));
    result.writeAudioChunk('dGVzdA==');
    result.end();
  });

  it('startStreamingRecognize invokes onTranscript for final result', () => {
    const mockStream = {
      writable: true,
      write: () => {},
      end: () => {},
      on: (ev, handler) => {
        if (ev === 'data') {
          setImmediate(() => handler({
            results: [{
              isFinal: true,
              alternatives: [{ transcript: '  hello world  ' }],
            }],
          }));
        }
        return mockStream;
      },
    };
    const mockClient = { streamingRecognize: () => mockStream };
    const received = [];
    startStreamingRecognize(mockClient, {}, {
      onTranscript: (text, isFinal) => { received.push({ text, isFinal }); },
    });
    return new Promise((resolve) => {
      setImmediate(() => {
        assert.strictEqual(received.length, 1);
        assert.strictEqual(received[0].text, 'hello world');
        assert.strictEqual(received[0].isFinal, true);
        resolve();
      });
    });
  });
});
