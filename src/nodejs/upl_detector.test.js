/**
 * Unit tests for UPL detection and deflection (BE-007).
 * Run: node --test upl_detector.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  processGeminiResponse,
  detectUplFromActionTags,
  extractActionTags,
  stripActionTags,
  isUplDeflection,
  UPL_DEFLECT_TAG,
} = require('./upl_detector.js');

describe('upl_detector', () => {
  it('processGeminiResponse with deflect_upl sets uplDetected and questionToFlag', () => {
    const response = "That's an important question. [deflect_upl] I'll note it for the attorney. What is your household income?";
    const userMessage = 'Will I lose my house?';
    const out = processGeminiResponse(response, undefined, userMessage);
    assert.strictEqual(out.uplDetected, true);
    assert.strictEqual(out.questionToFlag, 'Will I lose my house?');
    assert.ok(!out.textForTts.includes('[deflect_upl]'));
    assert.ok(out.textForTts.includes("That's an important question"));
  });

  it('processGeminiResponse without deflect_upl sets uplDetected false and questionToFlag null', () => {
    const response = 'What is your approximate monthly income?';
    const out = processGeminiResponse(response, [], 'I make about 3000 a month');
    assert.strictEqual(out.uplDetected, false);
    assert.strictEqual(out.questionToFlag, null);
    assert.strictEqual(out.textForTts, response);
  });

  it('processGeminiResponse with pre-extracted actionTags detects UPL', () => {
    const response = 'I will note that. [deflect_upl] Next, do you own a vehicle?';
    const out = processGeminiResponse(response, ['deflect_upl', 'ask_assets'], 'Should I file Chapter 7?');
    assert.strictEqual(out.uplDetected, true);
    assert.strictEqual(out.questionToFlag, 'Should I file Chapter 7?');
  });

  it('processGeminiResponse with empty userMessage sets questionToFlag null', () => {
    const out = processGeminiResponse('Note it. [deflect_upl]', ['deflect_upl'], '');
    assert.strictEqual(out.uplDetected, true);
    assert.strictEqual(out.questionToFlag, null);
  });

  it('detectUplFromActionTags returns true when deflect_upl in tags', () => {
    assert.strictEqual(detectUplFromActionTags(['ask_income', 'deflect_upl']), true);
    assert.strictEqual(detectUplFromActionTags(['deflect_upl']), true);
  });

  it('detectUplFromActionTags returns false when deflect_upl not in tags', () => {
    assert.strictEqual(detectUplFromActionTags(['ask_income']), false);
    assert.strictEqual(detectUplFromActionTags([]), false);
    assert.strictEqual(detectUplFromActionTags(undefined), false);
  });

  it('extractActionTags and stripActionTags match gemini_client behavior', () => {
    const text = 'Hello [ask_income] [deflect_upl]  Next question.';
    assert.deepStrictEqual(extractActionTags(text), ['ask_income', 'deflect_upl']);
    const stripped = stripActionTags(text);
    assert.ok(!stripped.includes('deflect_upl'));
    assert.ok(stripped.includes('Hello') && stripped.includes('Next question'));
  });

  it('isUplDeflection and UPL_DEFLECT_TAG are exported', () => {
    assert.strictEqual(UPL_DEFLECT_TAG, 'deflect_upl');
    assert.strictEqual(isUplDeflection(['deflect_upl']), true);
  });

  it('tagging in conversation: questionToFlag is passed to appendFlaggedQuestion in flow', () => {
    const { createConversationContext } = require('./gemini_client.js');
    const ctx = createConversationContext();
    const out = processGeminiResponse('Noted. [deflect_upl]', ['deflect_upl'], 'Will the court take my car?');
    if (out.uplDetected && out.questionToFlag) {
      ctx.appendFlaggedQuestion(out.questionToFlag);
    }
    assert.deepStrictEqual(ctx.getFlaggedQuestions(), ['Will the court take my car?']);
  });

  it('processGeminiResponse with conclude_call sets concludeCall true', () => {
    const response = "Thank you. We have what we need. [conclude_call]";
    const out = processGeminiResponse(response, undefined);
    assert.strictEqual(out.concludeCall, true);
    assert.ok(!out.textForTts.includes('[conclude_call]'));
  });

  it('processGeminiResponse without conclude_call sets concludeCall false', () => {
    const out = processGeminiResponse('What is your monthly income?', []);
    assert.strictEqual(out.concludeCall, false);
  });
});
