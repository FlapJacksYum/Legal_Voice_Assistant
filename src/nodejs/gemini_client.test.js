/**
 * Unit tests for Gemini client (config, context, API shape). No live Vertex AI calls.
 * Run: node --test gemini_client.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  createVertexAI,
  getGenerativeModel,
  buildContents,
  generateResponse,
  createConversationContext,
  extractActionTags,
  stripActionTags,
  isUplDeflection,
  UPL_DEFLECT_TAG,
  DEFAULT_MODEL,
  DEFAULT_LOCATION,
  DEFAULT_SYSTEM_PROMPT,
} = require('./gemini_client.js');

describe('gemini_client', () => {
  it('createVertexAI throws when projectId is missing', () => {
    const orig = process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    assert.throws(
      () => createVertexAI({}),
      /projectId|GOOGLE_CLOUD_PROJECT/
    );
    if (orig !== undefined) process.env.GOOGLE_CLOUD_PROJECT = orig;
  });

  it('createVertexAI returns VertexAI instance when projectId provided', () => {
    const vertex = createVertexAI({ projectId: 'test-project' });
    assert.strictEqual(vertex.project, 'test-project');
    assert.ok(vertex.location);
    assert.strictEqual(typeof vertex.getGenerativeModel, 'function');
  });

  it('getGenerativeModel returns model with generateContent', () => {
    const vertex = createVertexAI({ projectId: 'test-project' });
    const model = getGenerativeModel(vertex, { model: 'gemini-1.5-flash' });
    assert.strictEqual(typeof model.generateContent, 'function');
  });

  it('buildContents with empty history and user text returns single user message', () => {
    const contents = buildContents([], 'Hello');
    assert.strictEqual(contents.length, 1);
    assert.strictEqual(contents[0].role, 'user');
    assert.strictEqual(contents[0].parts[0].text, 'Hello');
  });

  it('buildContents with history includes previous turns and new user message', () => {
    const history = [
      { role: 'user', text: 'Hi' },
      { role: 'model', text: 'Hello, how can I help?' },
    ];
    const contents = buildContents(history, 'I need help with debt.');
    assert.strictEqual(contents.length, 3);
    assert.strictEqual(contents[0].role, 'user');
    assert.strictEqual(contents[0].parts[0].text, 'Hi');
    assert.strictEqual(contents[1].role, 'model');
    assert.strictEqual(contents[1].parts[0].text, 'Hello, how can I help?');
    assert.strictEqual(contents[2].role, 'user');
    assert.strictEqual(contents[2].parts[0].text, 'I need help with debt.');
  });

  it('buildContents with empty userText and history returns only history', () => {
    const contents = buildContents([{ role: 'user', text: 'Hi' }], '');
    assert.strictEqual(contents.length, 1);
  });

  it('generateResponse returns text from mock model', async () => {
    const mockModel = {
      generateContent: async ({ contents }) => {
        assert.ok(Array.isArray(contents));
        assert.strictEqual(contents[contents.length - 1].role, 'user');
        return {
          response: {
            candidates: [{
              content: { parts: [{ text: ' I can help gather some information. What is your name?' }] },
            }],
          },
        };
      },
    };
    const result = await generateResponse(mockModel, 'Hello', []);
    assert.strictEqual(typeof result.text, 'string');
    assert.ok(result.text.includes('help'));
  });

  it('generateResponse throws when no candidates returned', async () => {
    const mockModel = {
      generateContent: async () => ({ response: { candidates: [] } }),
    };
    await assert.rejects(
      () => generateResponse(mockModel, 'Hi', []),
      /no content|No candidates/
    );
  });

  it('createConversationContext append and getHistory', () => {
    const ctx = createConversationContext();
    ctx.appendUser('Hi');
    ctx.appendModel('Hello.');
    ctx.appendUser('I have debt.');
    const history = ctx.getHistory();
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].role, 'user');
    assert.strictEqual(history[0].text, 'Hi');
    assert.strictEqual(history[1].role, 'model');
    assert.strictEqual(history[1].text, 'Hello.');
    ctx.clear();
    assert.strictEqual(ctx.getHistory().length, 0);
  });

  it('extractActionTags returns tags in brackets', () => {
    const tags = extractActionTags('Here is the reply. [ask_income] [deflect_upl]');
    assert.deepStrictEqual(tags, ['ask_income', 'deflect_upl']);
  });

  it('DEFAULT_SYSTEM_PROMPT mentions intake and no legal advice', () => {
    assert.ok(DEFAULT_SYSTEM_PROMPT.includes('intake'));
    assert.ok(DEFAULT_SYSTEM_PROMPT.includes('legal advice'));
  });

  it('stripActionTags removes [tag] tokens for TTS', () => {
    const out = stripActionTags('That is important. [deflect_upl] I will note it for the attorney.');
    assert.ok(!out.includes('deflect_upl'));
    assert.ok(out.includes('note it for the attorney'));
  });

  it('stripActionTags handles multiple tags and extra spaces', () => {
    const out = stripActionTags('Hello [ask_income] [deflect_upl]  Next question.');
    assert.strictEqual(out, 'Hello Next question.');
  });

  it('isUplDeflection returns true when deflect_upl in actionTags', () => {
    assert.strictEqual(isUplDeflection(['ask_income', 'deflect_upl']), true);
    assert.strictEqual(isUplDeflection(['deflect_upl']), true);
  });

  it('isUplDeflection returns false when deflect_upl not in actionTags', () => {
    assert.strictEqual(isUplDeflection(['ask_income']), false);
    assert.strictEqual(isUplDeflection([]), false);
    assert.strictEqual(isUplDeflection(undefined), false);
  });

  it('UPL_DEFLECT_TAG is deflect_upl', () => {
    assert.strictEqual(UPL_DEFLECT_TAG, 'deflect_upl');
  });

  it('createConversationContext tracks flagged questions for attorney review', () => {
    const ctx = createConversationContext();
    assert.deepStrictEqual(ctx.getFlaggedQuestions(), []);
    ctx.appendFlaggedQuestion('Will I lose my house?');
    ctx.appendFlaggedQuestion('Should I file Chapter 7?');
    assert.deepStrictEqual(ctx.getFlaggedQuestions(), ['Will I lose my house?', 'Should I file Chapter 7?']);
    ctx.clear();
    assert.deepStrictEqual(ctx.getFlaggedQuestions(), []);
  });

  it('appendFlaggedQuestion ignores empty string', () => {
    const ctx = createConversationContext();
    ctx.appendFlaggedQuestion('');
    ctx.appendFlaggedQuestion('  ');
    assert.strictEqual(ctx.getFlaggedQuestions().length, 0);
  });
});
