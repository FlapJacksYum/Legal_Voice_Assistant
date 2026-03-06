/**
 * Legal Intake Voice Service — Node.js component.
 * Runs the Twilio Media Streams WebSocket server and optional Google Cloud STT streaming.
 */

const http = require('http');
const {
  createMediaWebSocketServer,
  DEFAULT_PORT,
  DEFAULT_PATH,
} = require('./websocket_server.js');
const {
  createSpeechClient,
  startStreamingRecognizeWithRetry,
} = require('./stt_client.js');

const PORT = Number(process.env.PORT) || DEFAULT_PORT;

let speechClient = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    speechClient = createSpeechClient();
  } catch (err) {
    console.warn('STT disabled: could not create Speech client:', err.message);
  }
}

const sttStreamsByWs = new Map();

function onMediaChunk(ws, base64Payload) {
  let session = sttStreamsByWs.get(ws);
  if (!session) {
    if (!speechClient) return;
    session = startStreamingRecognizeWithRetry(speechClient, {}, {
      onTranscript: (text, isFinal) => {
        console.log(`[STT] ${isFinal ? 'Final' : 'Interim'}: ${text}`);
      },
      onError: (err) => {
        console.error('[STT] error:', err.message);
      },
    });
    sttStreamsByWs.set(ws, session);
  }
  session.writeAudioChunk(base64Payload);
}

function onWsClose(ws) {
  const session = sttStreamsByWs.get(ws);
  if (session) {
    session.end();
    sttStreamsByWs.delete(ws);
  }
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
