/**
 * Legal Intake Voice Service — Node.js component.
 * Runs the Twilio Media Streams WebSocket server and optional Google Cloud STT streaming.
 */

const http = require('http');
const {
  createMediaWebSocketServer,
  sendAudioChunk,
  DEFAULT_PORT,
  DEFAULT_PATH,
} = require('./websocket_server.js');
const {
  createSpeechClient,
  startStreamingRecognizeWithRetry,
} = require('./stt_client.js');
const {
  createVertexAI,
  getGenerativeModel,
  generateResponseWithRetry,
  createConversationContext,
} = require('./gemini_client.js');
const { processGeminiResponse } = require('./upl_detector.js');
const { getSystemInstruction } = require('./gemini_prompt_manager.js');
const {
  createTtsClient,
  getSynthesisRequest,
  synthesizeAndStream,
} = require('./tts_client.js');
const { getGreetingText, getClosingText } = require('./greeting.js');
const { createVadState, processChunk: processVadChunk } = require('./vad.js');
const { getTtsOptionsForTone } = require('./tone_adjuster.js');

const PORT = Number(process.env.PORT) || DEFAULT_PORT;

let speechClient = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    speechClient = createSpeechClient();
  } catch (err) {
    console.warn('STT disabled: could not create Speech client:', err.message);
  }
}

let geminiModel = null;
if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const vertex = createVertexAI({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
    const systemInstruction = getSystemInstruction();
    geminiModel = getGenerativeModel(vertex, { systemInstruction });
  } catch (err) {
    console.warn('Gemini disabled: could not create Vertex AI model:', err.message);
  }
}

let ttsClient = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    ttsClient = createTtsClient();
  } catch (err) {
    console.warn('TTS disabled: could not create Text-to-Speech client:', err.message);
  }
}

const sttStreamsByWs = new Map();
const geminiContextByWs = new Map();
/** @type {Map<import('ws').WebSocket, { greetingInProgress: boolean, greetingAborted: boolean, vadState?: object }>} */
const greetingStateByWs = new Map();
/** When true, intake is complete and we should not process further user input (closing or already closed). */
const callConcludedByWs = new Map();

function onMediaChunk(ws, base64Payload) {
  let session = sttStreamsByWs.get(ws);
  if (!session) {
    if (!speechClient) return;
    let conversation = geminiContextByWs.get(ws);
    if (!conversation) {
      conversation = createConversationContext();
      geminiContextByWs.set(ws, conversation);
    }
    const greetingState = {
      greetingInProgress: true,
      greetingAborted: false,
      vadState: createVadState(),
    };
    greetingStateByWs.set(ws, greetingState);

    session = startStreamingRecognizeWithRetry(speechClient, {}, {
      onTranscript: async (text, isFinal) => {
        console.log(`[STT] ${isFinal ? 'Final' : 'Interim'}: ${text}`);
        const state = greetingStateByWs.get(ws);
        if (state && state.greetingInProgress && text && text.trim().length > 0) {
          state.greetingAborted = true;
        }
        if (isFinal && text && geminiModel) {
          if (callConcludedByWs.get(ws)) {
            if (state) state.greetingInProgress = false;
            return;
          }
          const conversation = geminiContextByWs.get(ws);
          if (conversation) {
            conversation.appendUser(text);
            try {
              const history = conversation.getHistory().slice(0, -1);
              const { text: responseText, actionTags } = await generateResponseWithRetry(
                geminiModel,
                text,
                history
              );
              const { uplDetected, concludeCall, textForTts, questionToFlag } = processGeminiResponse(
                responseText,
                actionTags,
                text
              );
              conversation.appendModel(responseText);
              if (uplDetected && questionToFlag) {
                conversation.appendFlaggedQuestion(questionToFlag);
                console.log('[UPL] Question flagged for attorney review:', questionToFlag);
              }
              if (concludeCall) {
                callConcludedByWs.set(ws, true);
                console.log('[Call] Conclusion signaled by Gemini; playing closing.');
              }
              console.log('[Gemini]:', responseText);
              if (ttsClient) {
                try {
                  if (textForTts) {
                    const toneOpts = getTtsOptionsForTone(textForTts, text);
                    const requestOverrides = toneOpts
                      ? getSynthesisRequest({ ssml: toneOpts.ssml })
                      : undefined;
                    await synthesizeAndStream(ttsClient, textForTts, (base64) => {
                      sendAudioChunk(ws, base64);
                    }, requestOverrides ? { requestOverrides } : undefined);
                  }
                  if (concludeCall) {
                    const closingText = getClosingText();
                    if (closingText) {
                      await synthesizeAndStream(ttsClient, closingText, (base64) => {
                        sendAudioChunk(ws, base64);
                      });
                    }
                  }
                } catch (ttsErr) {
                  console.error('[TTS] error:', ttsErr.message);
                }
              }
            } catch (err) {
              console.error('[Gemini] error:', err.message);
            }
          }
          if (state) state.greetingInProgress = false;
        }
      },
      onError: (err) => {
        console.error('[STT] error:', err.message);
      },
    });
    sttStreamsByWs.set(ws, session);

    if (ttsClient) {
      const greetingText = getGreetingText();
      synthesizeAndStream(ttsClient, greetingText, (base64) => {
        const s = greetingStateByWs.get(ws);
        if (s && !s.greetingAborted) sendAudioChunk(ws, base64);
      }).then(() => {
        const s = greetingStateByWs.get(ws);
        if (s) s.greetingInProgress = false;
      }).catch((err) => {
        console.error('[TTS] greeting error:', err.message);
        const s = greetingStateByWs.get(ws);
        if (s) s.greetingInProgress = false;
      });
    } else {
      greetingState.greetingInProgress = false;
    }
  }

  const greetingState = greetingStateByWs.get(ws);
  if (greetingState && greetingState.greetingInProgress && greetingState.vadState) {
    const { speechDetected } = processVadChunk(base64Payload, greetingState.vadState);
    if (speechDetected) {
      greetingState.greetingAborted = true;
    }
  }

  session = sttStreamsByWs.get(ws);
  if (session) session.writeAudioChunk(base64Payload);
}

function onWsClose(ws) {
  const session = sttStreamsByWs.get(ws);
  if (session) {
    session.end();
    sttStreamsByWs.delete(ws);
  }
  geminiContextByWs.delete(ws);
  greetingStateByWs.delete(ws);
  callConcludedByWs.delete(ws);
}

/**
 * Build TwiML that connects the call to our Media Streams WebSocket (bidirectional).
 * TWILIO_MEDIA_STREAM_WS_URL must be the public wss:// URL (e.g. wss://your-host.example.com/media).
 */
function getVoiceTwiML() {
  const wsUrl = process.env.TWILIO_MEDIA_STREAM_WS_URL || '';
  if (!wsUrl || !wsUrl.startsWith('wss://')) {
    console.warn('TWILIO_MEDIA_STREAM_WS_URL not set or invalid (must be wss://...); TwiML will be empty');
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service not configured.</Say></Response>';
  }
  const safe = wsUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${safe}"/></Connect></Response>`;
}

const server = http.createServer((req, res) => {
  const path = req.url?.split('?')[0];
  if (path === '/' || path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'legal-intake-voice-node',
      websocketPath: DEFAULT_PATH,
    }));
    return;
  }
  if (path === '/voice' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(getVoiceTwiML());
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = createMediaWebSocketServer(server, {
  path: DEFAULT_PATH,
  onMediaChunk: speechClient ? onMediaChunk : undefined,
});
wss.on('connection', (ws) => {
  ws.on('close', () => onWsClose(ws));
});

server.listen(PORT, () => {
  console.log(`Legal Intake Voice Service — Node.js listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}${DEFAULT_PATH}`);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exitCode = 1;
});
