/**
 * Voice Activity Detection (VAD) for Legal Intake Voice Service.
 * Used during the AI greeting to detect caller speech and allow natural interruption (barge-in).
 * Processes Twilio mulaw 8kHz chunks; uses energy-based detection (no native deps).
 */

const SAMPLE_RATE = 8000;
/** Frame size for VAD: 20ms at 8kHz = 160 samples */
const FRAME_SAMPLES = 160;
/** Number of consecutive frames above threshold to declare "speech" */
const SPEECH_FRAME_COUNT = 2;
/** RMS threshold (0–32767 linear) above which frame is considered speech; tune for phone audio */
const DEFAULT_ENERGY_THRESHOLD = 400;

/**
 * Decode mulaw byte to 16-bit signed linear PCM.
 * @param {number} mulawByte - 0–255
 * @returns {number} -32768–32767
 */
function mulawDecode(mulawByte) {
  mulawByte = ~mulawByte & 0xff;
  const sign = (mulawByte & 0x80) ? -1 : 1;
  const exponent = (mulawByte >> 4) & 0x07;
  const mantissa = mulawByte & 0x0f;
  const sample = ((((mantissa << 3) + 0x84) << exponent) - 0x84) * sign;
  return sample;
}

/**
 * Decode a mulaw Buffer to 16-bit linear PCM (Int16Array).
 * @param {Buffer} mulawBuffer
 * @returns {Int16Array}
 */
function mulawDecodeToLinear(mulawBuffer) {
  const n = mulawBuffer.length;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = mulawDecode(mulawBuffer[i]);
  return out;
}

/**
 * Compute RMS of a typed array of 16-bit samples.
 * @param {Int16Array|ArrayLike<number>} samples
 * @returns {number}
 */
function rms(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Create initial VAD state for a call/session.
 * @param {object} options - { energyThreshold, speechFrameCount }
 * @returns {{ buffer: number[], consecutiveSpeechFrames: number, energyThreshold: number, speechFrameCount: number }}
 */
function createVadState(options = {}) {
  return {
    buffer: [],
    consecutiveSpeechFrames: 0,
    energyThreshold: options.energyThreshold ?? DEFAULT_ENERGY_THRESHOLD,
    speechFrameCount: options.speechFrameCount ?? SPEECH_FRAME_COUNT,
  };
}

/**
 * Process one incoming mulaw chunk (base64). Updates state and returns whether speech was detected.
 * Call this for each Twilio media payload during the greeting; when speechDetected is true,
 * interrupt the greeting and transition to conversation.
 * @param {string} base64Payload - Twilio media payload (mulaw 8kHz)
 * @param {object} state - From createVadState()
 * @returns {{ speechDetected: boolean, state: object }}
 */
function processChunk(base64Payload, state) {
  const buf = Buffer.from(base64Payload, 'base64');
  if (buf.length === 0) return { speechDetected: false, state };

  const linear = mulawDecodeToLinear(buf);
  for (let i = 0; i < linear.length; i++) {
    state.buffer.push(linear[i]);
  }

  let speechDetected = false;
  while (state.buffer.length >= FRAME_SAMPLES) {
    const frame = state.buffer.splice(0, FRAME_SAMPLES);
    const energy = rms(frame);
    if (energy >= state.energyThreshold) {
      state.consecutiveSpeechFrames++;
      if (state.consecutiveSpeechFrames >= state.speechFrameCount) {
        speechDetected = true;
        state.consecutiveSpeechFrames = 0;
        break;
      }
    } else {
      state.consecutiveSpeechFrames = 0;
    }
  }

  return { speechDetected, state };
}

module.exports = {
  mulawDecode,
  mulawDecodeToLinear,
  rms,
  createVadState,
  processChunk,
  SAMPLE_RATE,
  FRAME_SAMPLES,
  SPEECH_FRAME_COUNT,
  DEFAULT_ENERGY_THRESHOLD,
};
