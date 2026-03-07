/**
 * Gemini system prompt and RAG integration for Legal Intake Voice Service.
 * Loads firm-specific intake guidelines and deflection scripts, builds the full system
 * instruction for Gemini, and keeps prompt length optimized for low TTFT.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_BASE_PROMPT = `You are an AI intake assistant for a bankruptcy law practice. You speak on behalf of the attorney's office. Your role is to gather initial information from callers only. You do not give legal advice.

When the caller asks for legal advice (e.g. "Will I lose my house?", "Should I file Chapter 7?", "What will happen to my car?"), you must: (1) respond with a grounding deflection using the pre-approved deflection scripts below, and (2) include the tag [deflect_upl] in your response so the system can flag the question for attorney review. Then steer the conversation back to information gathering.

Do not interpret laws or recommend specific legal actions. Keep responses concise and suitable for voice (1-2 short sentences). Be empathetic and professional.`;

const RAG_FILES = {
  intakeGuidelines: 'intake_guidelines.md',
  deflectionScripts: 'deflection_scripts.json',
};

const MAX_RAG_CHARS = 4000;

/**
 * Resolve the directory containing RAG config (intake_guidelines.md, deflection_scripts.json).
 * Order: RAG_CONFIG_DIR env, then process.cwd()/config/rag, then repo root config/rag from __dirname.
 * @returns {string}
 */
function getRagConfigDir() {
  if (process.env.RAG_CONFIG_DIR) {
    return process.env.RAG_CONFIG_DIR;
  }
  const fromCwd = path.join(process.cwd(), 'config', 'rag');
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromNode = path.join(__dirname, '..', '..', 'config', 'rag');
  return fromNode;
}

/**
 * Load a text file (e.g. intake_guidelines.md). Returns trimmed string or empty string if missing.
 * @param {string} dir - RAG config directory
 * @param {string} filename
 * @returns {string}
 */
function loadTextFile(dir, filename) {
  const filePath = path.join(dir, filename);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch (_) {
    // ignore
  }
  return '';
}

/**
 * Load deflection scripts JSON and return a short summary for the prompt (to keep TTFT low).
 * @param {string} dir - RAG config directory
 * @returns {string}
 */
function loadDeflectionSummary(dir) {
  const filePath = path.join(dir, RAG_FILES.deflectionScripts);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      const deflections = data.deflections || [];
      const instructions = data.instructions || '';
      const parts = deflections.map((d) => (d.script ? `- ${d.script}` : '')).filter(Boolean);
      if (instructions) parts.push(instructions);
      return parts.join('\n');
    }
  } catch (_) {
    // ignore
  }
  return '';
}

/**
 * Build the full system prompt: base (persona, role, ethical) + RAG (guidelines + deflection).
 * RAG content is truncated to MAX_RAG_CHARS to keep TTFT low.
 * @param {object} options - { basePrompt?: string, ragConfigDir?: string, includeRag?: boolean }
 * @returns {string}
 */
function buildSystemPrompt(options = {}) {
  const basePrompt = options.basePrompt != null ? options.basePrompt : DEFAULT_BASE_PROMPT;
  const includeRag = options.includeRag !== false;
  const ragDir = options.ragConfigDir != null ? options.ragConfigDir : getRagConfigDir();

  if (!includeRag) {
    return basePrompt;
  }

  const sections = [basePrompt];

  const guidelines = loadTextFile(ragDir, RAG_FILES.intakeGuidelines);
  if (guidelines) {
    sections.push('## Intake guidelines\n' + guidelines);
  }

  const deflectionSummary = loadDeflectionSummary(ragDir);
  if (deflectionSummary) {
    sections.push('## Deflection scripts (use when caller asks for legal advice)\n' + deflectionSummary);
  }

  let combined = sections.join('\n\n');
  if (combined.length > MAX_RAG_CHARS) {
    combined = combined.slice(0, MAX_RAG_CHARS) + '\n[...truncated for length]';
  }
  return combined;
}

/**
 * Get the system instruction object for Vertex AI (Gemini): { parts: [{ text: string }] }.
 * @param {object} options - Same as buildSystemPrompt
 * @returns {{ parts: Array<{ text: string }> }}
 */
function getSystemInstruction(options = {}) {
  const text = buildSystemPrompt(options);
  return { parts: [{ text }] };
}

/**
 * Load and return raw RAG content (for tests or inspection). Does not apply max length.
 * @param {string} [ragConfigDir] - Optional override
 * @returns {{ intakeGuidelines: string, deflectionSummary: string }}
 */
function loadRagContent(ragConfigDir) {
  const dir = ragConfigDir != null ? ragConfigDir : getRagConfigDir();
  return {
    intakeGuidelines: loadTextFile(dir, RAG_FILES.intakeGuidelines),
    deflectionSummary: loadDeflectionSummary(dir),
  };
}

module.exports = {
  DEFAULT_BASE_PROMPT,
  RAG_FILES,
  MAX_RAG_CHARS,
  getRagConfigDir,
  loadTextFile,
  loadDeflectionSummary,
  buildSystemPrompt,
  getSystemInstruction,
  loadRagContent,
};
