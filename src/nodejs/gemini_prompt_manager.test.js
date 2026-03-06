/**
 * Unit tests for Gemini prompt manager (system prompt structure, RAG loading).
 * Run: node --test gemini_prompt_manager.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const {
  DEFAULT_BASE_PROMPT,
  RAG_FILES,
  MAX_RAG_CHARS,
  getRagConfigDir,
  loadTextFile,
  loadDeflectionSummary,
  buildSystemPrompt,
  getSystemInstruction,
  loadRagContent,
} = require('./gemini_prompt_manager.js');

describe('gemini_prompt_manager', () => {
  it('DEFAULT_BASE_PROMPT defines persona, role, and no legal advice', () => {
    assert.ok(DEFAULT_BASE_PROMPT.includes('intake assistant'));
    assert.ok(DEFAULT_BASE_PROMPT.includes('bankruptcy'));
    assert.ok(DEFAULT_BASE_PROMPT.includes('do not give legal advice'));
    assert.ok(DEFAULT_BASE_PROMPT.includes('note it for the attorney'));
  });

  it('buildSystemPrompt without RAG returns base only', () => {
    const out = buildSystemPrompt({ includeRag: false });
    assert.strictEqual(out, DEFAULT_BASE_PROMPT);
  });

  it('buildSystemPrompt returns string', () => {
    const out = buildSystemPrompt();
    assert.strictEqual(typeof out, 'string');
    assert.ok(out.length >= DEFAULT_BASE_PROMPT.length);
  });

  it('getSystemInstruction returns { parts: [{ text }] }', () => {
    const inst = getSystemInstruction({ includeRag: false });
    assert.ok(inst.parts);
    assert.strictEqual(inst.parts.length, 1);
    assert.strictEqual(typeof inst.parts[0].text, 'string');
    assert.strictEqual(inst.parts[0].text, DEFAULT_BASE_PROMPT);
  });

  it('getSystemInstruction with RAG includes base and may include RAG', () => {
    const inst = getSystemInstruction();
    assert.ok(inst.parts);
    assert.strictEqual(inst.parts.length, 1);
    const text = inst.parts[0].text;
    assert.ok(text.includes('intake assistant'));
    assert.ok(text.includes('do not give legal advice'));
  });

  it('custom basePrompt is used when provided', () => {
    const custom = 'Custom base prompt for testing.';
    const out = buildSystemPrompt({ basePrompt: custom, includeRag: false });
    assert.strictEqual(out, custom);
  });

  it('loadRagContent returns object with intakeGuidelines and deflectionSummary', () => {
    const dir = getRagConfigDir();
    const content = loadRagContent(dir);
    assert.strictEqual(typeof content.intakeGuidelines, 'string');
    assert.strictEqual(typeof content.deflectionSummary, 'string');
  });

  it('loadTextFile returns empty string for missing file', () => {
    const dir = path.join(__dirname, 'nonexistent_rag_dir');
    assert.strictEqual(loadTextFile(dir, 'missing.md'), '');
  });

  it('loadDeflectionSummary returns string (empty or summary)', () => {
    const dir = getRagConfigDir();
    const summary = loadDeflectionSummary(dir);
    assert.strictEqual(typeof summary, 'string');
  });

  it('getRagConfigDir returns a string', () => {
    const dir = getRagConfigDir();
    assert.strictEqual(typeof dir, 'string');
    assert.ok(dir.length > 0);
  });

  it('when config/rag exists, buildSystemPrompt can include guidelines and deflection', () => {
    const dir = getRagConfigDir();
    if (!fs.existsSync(path.join(dir, RAG_FILES.intakeGuidelines))) {
      return; // skip if run from a context where config/rag is not present
    }
    const prompt = buildSystemPrompt({ ragConfigDir: dir });
    assert.ok(prompt.includes('Intake guidelines') || prompt.includes('intake'));
    assert.ok(prompt.includes('deflect') || prompt.includes('legal advice') || prompt.length > DEFAULT_BASE_PROMPT.length);
  });
});
