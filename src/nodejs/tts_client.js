/**
 * Google Cloud Text-to-Speech client for Legal Intake Voice Service.
 * Synthesizes Gemini text responses to mulaw 8kHz for Twilio Media Streams.
 * Supports Custom Voice via voice name; SSML input supported.
 */

const textToSpeech = require('@google-cloud/text-to-speech').v1;

const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_VOICE = 'en-US-Neural2-D'; // fallback when no custom voice configured
const TWILIO_SAMPLE_RATE = 8000;
const MULAW_ENCODING = 'MULAW';
const CHUNK_SIZE = 320; // ~20ms at 8kHz mulaw for low-latency streaming
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 400;

/**
 * Create a Text-to-Speech client. Uses Application Default Credentials.
 * @param {object} options - Optional { keyFilename, credentials }
 * @returns {textToSpeech.TextToSpeechClient}
 */
function createTtsClient(options = {}) {
  return new textToSpeech.TextToSpeechClient(options);
}

/**
 * Build synthesis request for Twilio (mulaw 8kHz). Optional custom voice name.
 * @param {object} overrides - { text, ssml, voiceName, languageCode }
 * @returns {object} request for synthesizeSpeech
 */
function getSynthesisRequest(overrides = {}) {
  const text = overrides.text != null ? overrides.text : '';
  const ssml = overrides.ssml;
  const voiceName = overrides.voiceName || process.env.GOOGLE_TTS_VOICE_NAME || DEFAULT_VOICE;
  const languageCode = overrides.languageCode || process.env.GOOGLE_TTS_LANGUAGE || DEFAULT_LANGUAGE;

  const input = ssml ? { ssml } : { text: text || ' ' };
  return {
    input,
    voice: {
      languageCode,
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: MULAW_ENCODING,
      sampleRateHertz: overrides.sampleRateHertz ?? TWILIO_SAMPLE_RATE,
    },
  };
}

/**
 * Strip WAV header if present (Google TTS may return WAV-wrapped mulaw). Twilio expects raw mulaw.
 * @param {Buffer} buf
 * @returns {Buffer}
 */
function stripWavHeaderIfPresent(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return buf;
  if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46) return buf;
  let i = 12;
  while (i + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', i, i + 4);
    const chunkSize = buf.readUInt32LE(i + 4);
    if (chunkId === 'data') return buf.subarray(i + 8, i + 8 + chunkSize);
    i += 8 + chunkSize;
  }
  return buf.subarray(44);
}

/**
 * Synthesize text or SSML to mulaw audio. Returns raw mulaw buffer (no WAV header).
 * @param {textToSpeech.TextToSpeechClient} client
 * @param {object} request - From getSynthesisRequest() or custom
 * @returns {Promise<Buffer>} raw mulaw audio
 */
async function synthesize(client, request) {
  const [response] = await client.synthesizeSpeech(request);
  const audioContent = response.audioContent;
  if (!audioContent || !(audioContent.length > 0)) {
    throw new Error('TTS returned empty audio');
  }
  const buf = Buffer.isBuffer(audioContent)
    ? audioContent
    : typeof audioContent === 'string'
      ? Buffer.from(audioContent, 'base64')
      : Buffer.from(audioContent);
  return stripWavHeaderIfPresent(buf);
}

/**
 * Chunk a buffer and invoke onChunk(base64String) for each chunk. For streaming to Twilio.
 * @param {Buffer} mulawBuffer
 * @param {function(string): void} onChunk - receives base64-encoded chunk
 * @param {number} chunkSize
 */
function streamChunksAsBase64(mulawBuffer, onChunk, chunkSize = CHUNK_SIZE) {
  if (!mulawBuffer || mulawBuffer.length === 0) return;
  for (let i = 0; i < mulawBuffer.length; i += chunkSize) {
    const chunk = mulawBuffer.subarray(i, i + chunkSize);
    if (chunk.length > 0) onChunk(chunk.toString('base64'));
  }
}

/**
 * Synthesize text to mulaw and stream base64 chunks via onChunk. Single API call then chunk.
 * @param {textToSpeech.TextToSpeechClient} client
 * @param {string} text - Plain text or pass request via getSynthesisRequest({ text })
 * @param {function(string): void} onChunk - (base64Chunk) => void
 * @param {object} options - { requestOverrides, chunkSize }
 * @returns {Promise<void>}
 */
async function synthesizeAndStream(client, text, onChunk, options = {}) {
  const request = options.requestOverrides
    ? { ...getSynthesisRequest(), ...options.requestOverrides }
    : getSynthesisRequest({ text: text || ' ' });
  const buffer = await synthesize(client, request);
  streamChunksAsBase64(buffer, onChunk, options.chunkSize ?? CHUNK_SIZE);
}

/**
 * Retry wrapper for synthesize. Retries on transient errors.
 * @param {textToSpeech.TextToSpeechClient} client
 * @param {object} request
 * @param {number} maxRetries
 * @returns {Promise<Buffer>}
 */
async function synthesizeWithRetry(client, request, maxRetries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await synthesize(client, request);
    } catch (err) {
      lastErr = err;
      const msg = (err.message || '').toLowerCase();
      const code = err.code || err.status;
      const isRetryable = attempt < maxRetries && (
        code === 14 || code === 8 || code === 4 ||
        /unavailable|deadline|resource exhausted|rate/i.test(msg)
      );
      if (!isRetryable) throw err;
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw lastErr;
}

module.exports = {
  createTtsClient,
  getSynthesisRequest,
  synthesize,
  synthesizeWithRetry,
  synthesizeAndStream,
  streamChunksAsBase64,
  stripWavHeaderIfPresent,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE,
  TWILIO_SAMPLE_RATE,
  MULAW_ENCODING,
  CHUNK_SIZE,
};
