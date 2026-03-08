/**
 * Unit tests for stress keyword detection and empathetic SSML (BE-008).
 * Run: node --test tone_adjuster.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  STRESS_KEYWORDS,
  hasStressKeywords,
  escapeForSsml,
  wrapWithEmpatheticSsml,
  getTtsOptionsForTone,
} = require('./tone_adjuster.js');

describe('tone_adjuster', () => {
  it('STRESS_KEYWORDS includes foreclosure, garnishment, sheriff sale', () => {
    assert.ok(STRESS_KEYWORDS.includes('foreclosure'));
    assert.ok(STRESS_KEYWORDS.includes('garnishment'));
    assert.ok(STRESS_KEYWORDS.some((k) => k.includes('sheriff')));
  });

  it('hasStressKeywords returns true when keyword present', () => {
    assert.strictEqual(hasStressKeywords('I am facing foreclosure'), true);
    assert.strictEqual(hasStressKeywords('wage garnishment'), true);
    assert.strictEqual(hasStressKeywords('sheriff sale next week'), true);
    assert.strictEqual(hasStressKeywords('EVICTION notice'), true);
  });

  it('hasStressKeywords is case-insensitive', () => {
    assert.strictEqual(hasStressKeywords('FORECLOSURE'), true);
    assert.strictEqual(hasStressKeywords('Garnishment'), true);
  });

  it('hasStressKeywords returns false when no keyword', () => {
    assert.strictEqual(hasStressKeywords('What is my balance?'), false);
    assert.strictEqual(hasStressKeywords('I have credit card debt'), false);
    assert.strictEqual(hasStressKeywords(''), false);
    assert.strictEqual(hasStressKeywords('   '), false);
  });

  it('hasStressKeywords returns false for non-string or empty', () => {
    assert.strictEqual(hasStressKeywords(), false);
    assert.strictEqual(hasStressKeywords(null), false);
  });

  it('escapeForSsml escapes &, <, >, quotes', () => {
    assert.strictEqual(escapeForSsml('a & b'), 'a &amp; b');
    assert.strictEqual(escapeForSsml('x < y'), 'x &lt; y');
    assert.strictEqual(escapeForSsml('tag>'), 'tag&gt;');
    assert.strictEqual(escapeForSsml('Say "hello"'), 'Say &quot;hello&quot;');
  });

  it('wrapWithEmpatheticSsml wraps text in speak and prosody', () => {
    const out = wrapWithEmpatheticSsml('I understand.');
    assert.ok(out.startsWith('<speak>'));
    assert.ok(out.endsWith('</speak>'));
    assert.ok(out.includes('<prosody rate="slow" pitch="-2st">'));
    assert.ok(out.includes('I understand.'));
    assert.ok(out.includes('</prosody>'));
  });

  it('wrapWithEmpatheticSsml escapes content', () => {
    const out = wrapWithEmpatheticSsml('Cost < $100');
    assert.ok(out.includes('&lt;'));
    assert.ok(!out.includes('< $100'));
  });

  it('wrapWithEmpatheticSsml handles empty or whitespace', () => {
    const out = wrapWithEmpatheticSsml('   ');
    assert.ok(out.includes('<speak>'));
    assert.ok(out.includes('<prosody'));
  });

  it('getTtsOptionsForTone returns null when no stress keywords', () => {
    assert.strictEqual(getTtsOptionsForTone('What is your income?', 'I make 3000 a month'), null);
    assert.strictEqual(getTtsOptionsForTone('Okay.', ''), null);
  });

  it('getTtsOptionsForTone returns ssml when user message has stress keyword', () => {
    const opts = getTtsOptionsForTone('I understand. We will note that.', 'I got a foreclosure notice');
    assert.ok(opts !== null);
    assert.strictEqual(typeof opts.ssml, 'string');
    assert.ok(opts.ssml.includes('<speak>'));
    assert.ok(opts.ssml.includes('I understand'));
  });

  it('getTtsOptionsForTone ssml is valid for TTS (prosody wraps content)', () => {
    const opts = getTtsOptionsForTone('We will help.', 'garnishment');
    assert.ok(opts.ssml.includes('rate="slow"'));
    assert.ok(opts.ssml.includes('pitch="-2st"'));
    assert.ok(opts.ssml.includes('We will help'));
  });
});
