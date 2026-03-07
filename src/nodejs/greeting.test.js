/**
 * Unit tests for AI disclosure greeting (BE-005).
 * Run: node --test greeting.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  getGreetingText,
  DEFAULT_GREETING_TEMPLATE,
  ATTORNEY_NAME_ENV,
  DEFAULT_ATTORNEY_LABEL,
} = require('./greeting.js');

describe('greeting', () => {
  it('getGreetingText includes mandatory AI disclosure', () => {
    const text = getGreetingText({ attorneyName: 'Test Attorney' });
    assert.ok(text.includes('AI intake assistant'));
    assert.ok(text.includes('gather'));
    assert.ok(text.includes('review your case'));
  });

  it('getGreetingText replaces [Attorney Name] and [Attorney] with option', () => {
    const text = getGreetingText({ attorneyName: 'Jane Smith' });
    assert.ok(text.includes('office of Jane Smith'));
    assert.ok(text.includes("Jane Smith's AI intake assistant"));
    assert.ok(text.includes('Jane Smith can review'));
    assert.ok(!text.includes('[Attorney'));
  });

  it('getGreetingText uses default label when no option and no env', () => {
    const orig = process.env[ATTORNEY_NAME_ENV];
    delete process.env[ATTORNEY_NAME_ENV];
    const text = getGreetingText();
    assert.ok(text.includes('the attorney'));
    if (orig !== undefined) process.env[ATTORNEY_NAME_ENV] = orig;
  });

  it('DEFAULT_GREETING_TEMPLATE contains placeholders', () => {
    assert.ok(DEFAULT_GREETING_TEMPLATE.includes('[Attorney Name]'));
    assert.ok(DEFAULT_GREETING_TEMPLATE.includes('[Attorney]'));
  });

  it('DEFAULT_ATTORNEY_LABEL is the attorney', () => {
    assert.strictEqual(DEFAULT_ATTORNEY_LABEL, 'the attorney');
  });

  it('greeting text is fixed template for mandatory disclosure', () => {
    const a = getGreetingText({ attorneyName: 'A' });
    const b = getGreetingText({ attorneyName: 'B' });
    assert.ok(a.startsWith('Hello, you\'ve reached the office of A.'));
    assert.ok(b.startsWith('Hello, you\'ve reached the office of B.'));
    assert.ok(a.includes('AI intake assistant') && b.includes('AI intake assistant'));
  });
});
