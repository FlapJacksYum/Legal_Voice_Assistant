/**
 * UPL (Unauthorized Practice of Law) detection and deflection for Legal Intake Voice Service.
 * Processes Gemini responses to detect legal-advice requests, produce TTS-safe deflection text,
 * and tag questions for attorney review. Depends on BE-003 (Gemini) and BE-006 (prompt/RAG).
 */

const {
  extractActionTags,
  stripActionTags,
  isUplDeflection,
  isConcludeCall,
  UPL_DEFLECT_TAG,
} = require('./gemini_client.js');

/**
 * Process a Gemini response to detect UPL deflection, call conclusion, and produce outputs for TTS and tagging.
 * When [deflect_upl] is present, the caller's message is tagged for attorney review and the
 * response text (with tags stripped) is used as the grounding deflection for TTS.
 * When [conclude_call] is present, sufficient intake has been gathered; the app should play the closing and end the call.
 *
 * @param {string} responseText - Raw Gemini response (may contain [deflect_upl], [conclude_call], or other action tags)
 * @param {string[]} [actionTags] - Pre-extracted action tags; if omitted, extracted from responseText
 * @param {string} [userMessage] - The caller's transcribed message (to tag when UPL is detected)
 * @returns {{ uplDetected: boolean, concludeCall: boolean, textForTts: string, questionToFlag: string | null }}
 */
function processGeminiResponse(responseText, actionTags, userMessage = '') {
  const tags = Array.isArray(actionTags) ? actionTags : extractActionTags(responseText || '');
  const uplDetected = isUplDeflection(tags);
  const concludeCall = isConcludeCall(tags);
  const textForTts = stripActionTags(responseText || '');
  const questionToFlag = uplDetected && (userMessage || '').trim() ? userMessage.trim() : null;
  return {
    uplDetected,
    concludeCall,
    textForTts,
    questionToFlag,
  };
}

/**
 * Check whether action tags indicate a UPL deflection (for use without full processGeminiResponse).
 * @param {string[]} [actionTags]
 * @returns {boolean}
 */
function detectUplFromActionTags(actionTags) {
  return isUplDeflection(actionTags);
}

module.exports = {
  processGeminiResponse,
  detectUplFromActionTags,
  extractActionTags,
  stripActionTags,
  isUplDeflection,
  UPL_DEFLECT_TAG,
};
