/**
 * Google Cloud Speech-to-Text streaming client for Legal Intake Voice Service.
 * Consumes mulaw 8kHz audio (Twilio Media Streams format) and emits real-time transcriptions.
 */

const speech = require('@google-cloud/speech').v1;

const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_SAMPLE_RATE = 8000;
const ENCODING_MULAW = 'MULAW';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

/**
 * Create a Speech client. Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS
 * or gcloud auth application-default login).
 * @param {object} options - Optional { keyFilename, credentials } for SpeechClient
 * @returns {speech.SpeechClient}
 */
function createSpeechClient(options = {}) {
  return new speech.SpeechClient(options);
}

/**
 * Build streaming recognition config for Twilio mulaw 8kHz audio, conversational speech.
 * @param {object} overrides - Override languageCode, sampleRateHertz, etc.
 * @returns {object} streamingConfig for streamingRecognize
 */
function getStreamingConfig(overrides = {}) {
  return {
    config: {
      encoding: ENCODING_MULAW,
      sampleRateHertz: overrides.sampleRateHertz ?? DEFAULT_SAMPLE_RATE,
      languageCode: overrides.languageCode ?? DEFAULT_LANGUAGE,
      enableAutomaticPunctuation: overrides.enableAutomaticPunctuation !== false,
      model: overrides.model || 'default',
      ...overrides,
    },
    interimResults: overrides.interimResults !== false,
  };
}

/**
 * Start a streaming recognize session. Write mulaw audio buffers with writeAudioChunk();
 * listen for 'transcript' (interim/final) and 'error' events.
 * @param {speech.SpeechClient} client - From createSpeechClient()
 * @param {object} configOverrides - Overrides for getStreamingConfig()
 * @param {object} callbacks - { onTranscript: (text, isFinal) => void, onError: (err) => void }
 * @returns {{ stream: import('stream'), writeAudioChunk: (base64OrBuffer: string|Buffer) => void, end: () => void }}
 */
function startStreamingRecognize(client, configOverrides, callbacks = {}) {
  const streamingConfig = getStreamingConfig(configOverrides);
  const stream = client.streamingRecognize(streamingConfig);

  stream.on('data', (response) => {
    if (!response.results || response.results.length === 0) return;
    for (const result of response.results) {
      const alternative = result.alternatives && result.alternatives[0];
      if (!alternative || !alternative.transcript) continue;
      const isFinal = result.isFinal === true;
      try {
        callbacks.onTranscript?.(alternative.transcript.trim(), isFinal);
      } catch (err) {
        callbacks.onError?.(err);
      }
    }
  });

  stream.on('error', (err) => {
    callbacks.onError?.(err);
  });

  function writeAudioChunk(base64OrBuffer) {
    if (!stream.writable) return;
    const buf = Buffer.isBuffer(base64OrBuffer)
      ? base64OrBuffer
      : Buffer.from(base64OrBuffer, 'base64');
    if (buf.length > 0) stream.write(buf);
  }

  function end() {
    if (stream.writable) stream.end();
  }

  return { stream, writeAudioChunk, end };
}

/**
 * Retry wrapper: run startStreamingRecognize; on transient error, retry up to MAX_RETRIES times.
 * @param {speech.SpeechClient} client
 * @param {object} configOverrides
 * @param {object} callbacks
 * @returns {{ stream: import('stream'), writeAudioChunk: (base64OrBuffer: string|Buffer) => void, end: () => void }}
 */
function startStreamingRecognizeWithRetry(client, configOverrides, callbacks = {}) {
  let attempt = 0;
  let current = null;

  function isRetryable(err) {
    const code = err.code || err.message;
    return (
      code === 4 ||
      code === 14 ||
      code === 8 ||
      (typeof code === 'number' && code >= 1 && code <= 16) ||
      /unavailable|deadline|resource exhausted/i.test(String(err.message))
    );
  }

  function tryStart() {
    attempt++;
    current = startStreamingRecognize(client, configOverrides, {
      onTranscript: callbacks.onTranscript,
      onError: (err) => {
        if (isRetryable(err) && attempt < MAX_RETRIES) {
          setTimeout(() => {
            tryStart();
          }, RETRY_DELAY_MS * attempt);
        } else {
          callbacks.onError?.(err);
        }
      },
    });
    return current;
  }

  return tryStart();
}

module.exports = {
  createSpeechClient,
  getStreamingConfig,
  startStreamingRecognize,
  startStreamingRecognizeWithRetry,
  DEFAULT_LANGUAGE,
  DEFAULT_SAMPLE_RATE,
  ENCODING_MULAW,
};
