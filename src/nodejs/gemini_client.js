/**
 * Vertex AI Gemini 1.5 Flash client for Legal Intake Voice Service.
 * Sends transcribed text and conversation history to Gemini and returns text responses.
 */

const { VertexAI } = require('@google-cloud/vertexai');

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_LOCATION = 'us-central1';
const DEFAULT_SYSTEM_PROMPT = `You are an AI intake assistant for a bankruptcy law practice. Your role is to gather initial information from callers only. You do not give legal advice. Keep responses concise and suitable for voice (short sentences). Be empathetic and professional.`;

/**
 * Create a Vertex AI client. Uses Application Default Credentials
 * (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth application-default login).
 * @param {object} options - { projectId, location }
 * @returns {VertexAI}
 */
function createVertexAI(options = {}) {
  const projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  const location = options.location || process.env.VERTEX_AI_LOCATION || DEFAULT_LOCATION;
  if (!projectId) {
    throw new Error('Vertex AI requires projectId (options.projectId or GOOGLE_CLOUD_PROJECT)');
  }
  return new VertexAI({ project: projectId, location });
}

/**
 * Get a GenerativeModel for Gemini 1.5 Flash with optional system instruction.
 * @param {VertexAI} vertexAI - From createVertexAI()
 * @param {object} options - { model, systemInstruction }
 * @returns {import('@google-cloud/vertexai').GenerativeModel}
 */
function getGenerativeModel(vertexAI, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const systemInstruction = options.systemInstruction != null
    ? options.systemInstruction
    : { parts: [{ text: DEFAULT_SYSTEM_PROMPT }] };
  return vertexAI.getGenerativeModel({
    model,
    systemInstruction: typeof systemInstruction === 'string'
      ? { parts: [{ text: systemInstruction }] }
      : systemInstruction,
  });
}

/**
 * Build contents array for generateContent from conversation history plus new user message.
 * @param {Array<{ role: 'user'|'model', text: string }>} history - Previous turns (user/model)
 * @param {string} userText - New user message (transcribed text)
 * @returns {Array<{ role: string, parts: Array<{ text: string }> }>}
 */
function buildContents(history, userText) {
  const contents = [];
  for (const turn of history || []) {
    const role = turn.role === 'model' ? 'model' : 'user';
    const text = typeof turn.text === 'string' ? turn.text : (turn.parts && turn.parts[0]?.text) || '';
    if (text) contents.push({ role, parts: [{ text }] });
  }
  const trimmed = (userText || '').trim();
  if (trimmed) contents.push({ role: 'user', parts: [{ text: trimmed }] });
  return contents;
}

/**
 * Send user text and optional history to Gemini and return the generated text.
 * @param {import('@google-cloud/vertexai').GenerativeModel} model - From getGenerativeModel()
 * @param {string} userText - Current user message (e.g. from STT)
 * @param {Array<{ role: 'user'|'model', text: string }>} history - Previous conversation turns
 * @returns {Promise<{ text: string, actionTags?: string[] }>}
 */
async function generateResponse(model, userText, history = []) {
  const contents = buildContents(history, userText);
  if (contents.length === 0) {
    return { text: '' };
  }
  const result = await model.generateContent({ contents });
  const response = result.response;
  if (!response || !response.candidates || response.candidates.length === 0) {
    const reason = response?.promptFeedback?.blockReason || 'No candidates returned';
    throw new Error(`Gemini returned no content: ${reason}`);
  }
  const candidate = response.candidates[0];
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    return { text: '' };
  }
  const text = candidate.content.parts
    .map(p => (p && p.text) || '')
    .join('')
    .trim();
  const actionTags = extractActionTags(text);
  return { text, actionTags };
}

/** Action tag for UPL deflection; when present, the caller's question is flagged for attorney review. */
const UPL_DEFLECT_TAG = 'deflect_upl';

/**
 * Naive extraction of action tags from response (e.g. [ask_income], [deflect_upl]).
 * Can be extended when BE-006/BE-009 define tag format.
 * @param {string} text
 * @returns {string[]}
 */
function extractActionTags(text) {
  const tags = [];
  const re = /\[([a-z_]+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tags.push(m[1]);
  }
  return tags;
}

/**
 * Remove action tags from text so it can be sent to TTS (caller should not hear "[deflect_upl]" etc.).
 * @param {string} text - Model response that may contain [tag] tokens
 * @returns {string}
 */
function stripActionTags(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s*\[[a-z_]+\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Whether the response indicates a UPL deflection (caller asked for legal advice).
 * @param {string[]} [actionTags]
 * @returns {boolean}
 */
function isUplDeflection(actionTags) {
  return Array.isArray(actionTags) && actionTags.includes(UPL_DEFLECT_TAG);
}

/**
 * Wrapper that adds retries for transient errors (rate limit, unavailable).
 * @param {import('@google-cloud/vertexai').GenerativeModel} model
 * @param {string} userText
 * @param {Array<{ role: string, text: string }>} history
 * @param {object} options - { maxRetries: number }
 * @returns {Promise<{ text: string, actionTags?: string[] }>}
 */
async function generateResponseWithRetry(model, userText, history = [], options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateResponse(model, userText, history);
    } catch (err) {
      lastErr = err;
      const msg = (err.message || '').toLowerCase();
      const isRetryable = attempt < maxRetries && (
        msg.includes('resource exhausted') ||
        msg.includes('rate') ||
        msg.includes('unavailable') ||
        msg.includes('503') ||
        (err.code && [8, 14].includes(err.code))
      );
      if (!isRetryable) throw err;
      const delay = 500 * (attempt + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * In-memory conversation context: append turns, return history for API, and track flagged UPL questions.
 */
function createConversationContext() {
  const turns = [];
  const flaggedQuestions = [];
  return {
    appendUser(text) {
      if ((text || '').trim()) turns.push({ role: 'user', text: text.trim() });
    },
    appendModel(text) {
      if ((text || '').trim()) turns.push({ role: 'model', text: text.trim() });
    },
    getHistory() {
      return [...turns];
    },
    /** Flag a caller question for attorney review (UPL deflection). */
    appendFlaggedQuestion(questionText) {
      const q = (questionText || '').trim();
      if (q) flaggedQuestions.push(q);
    },
    /** Get questions flagged for attorney review (e.g. for IntakeCall.flagged_questions_summary). */
    getFlaggedQuestions() {
      return [...flaggedQuestions];
    },
    clear() {
      turns.length = 0;
      flaggedQuestions.length = 0;
    },
  };
}

module.exports = {
  createVertexAI,
  getGenerativeModel,
  buildContents,
  generateResponse,
  generateResponseWithRetry,
  createConversationContext,
  extractActionTags,
  stripActionTags,
  isUplDeflection,
  UPL_DEFLECT_TAG,
  DEFAULT_MODEL,
  DEFAULT_LOCATION,
  DEFAULT_SYSTEM_PROMPT,
};
