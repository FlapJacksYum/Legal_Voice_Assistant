/**
 * Stress keyword detection and empathetic tone adjustment for Legal Intake Voice Service (BE-008).
 * Detects high-stress financial keywords in caller speech and wraps TTS input in SSML
 * (lower pitch, slower cadence) for a more empathetic response.
 */

/** High-stress financial keywords; detection is case-insensitive. */
const STRESS_KEYWORDS = [
  'foreclosure',
  'garnishment',
  'wage garnishment',
  'sheriff sale',
  'sheriff\'s sale',
  'repossess',
  'repossession',
  'repo',
  'shutoff',
  'shut off',
  'eviction',
  'evict',
  'bankruptcy',
  'losing my house',
  'lose my house',
  'auction',
  'utility shutoff',
  'disconnect',
  'collection',
  'debt collector',
  'lawsuit',
  'sued',
  'judgment',
  'levy',
];

/**
 * Check whether the given text (caller transcription) contains any high-stress keywords.
 * @param {string} text - Caller's transcribed message
 * @returns {boolean}
 */
function hasStressKeywords(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  const lower = text.toLowerCase();
  return STRESS_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Escape plain text for use inside SSML (avoid breaking tags and entities).
 * @param {string} raw
 * @returns {string}
 */
function escapeForSsml(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wrap plain text in SSML for empathetic tone: slightly lower pitch and slower rate.
 * Uses Google Cloud TTS prosody: pitch="-2st", rate="slow" for a subtle, natural effect.
 * @param {string} plainText - Response text to speak (will be escaped for SSML)
 * @returns {string} SSML string suitable for getSynthesisRequest({ ssml })
 */
function wrapWithEmpatheticSsml(plainText) {
  if (typeof plainText !== 'string' || !plainText.trim()) {
    return '<speak><prosody rate="slow" pitch="-2st"> </prosody></speak>';
  }
  const escaped = escapeForSsml(plainText.trim());
  return `<speak><prosody rate="slow" pitch="-2st">${escaped}</prosody></speak>`;
}

/**
 * Given the response text for TTS and the last user message, return synthesis options.
 * If the user message contains stress keywords, returns { useSsml: true, ssml }; otherwise null
 * so the caller can use plain text.
 * @param {string} textForTts - Plain text to speak
 * @param {string} lastUserMessage - Caller's last transcribed message
 * @returns {{ ssml: string } | null}
 */
function getTtsOptionsForTone(textForTts, lastUserMessage) {
  if (!hasStressKeywords(lastUserMessage)) return null;
  return { ssml: wrapWithEmpatheticSsml(textForTts) };
}

module.exports = {
  STRESS_KEYWORDS,
  hasStressKeywords,
  escapeForSsml,
  wrapWithEmpatheticSsml,
  getTtsOptionsForTone,
};
