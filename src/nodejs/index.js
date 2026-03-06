/**
 * Legal Intake Voice Service — Node.js component.
 * Runs the Twilio Media Streams WebSocket server for real-time audio.
 */

const http = require('http');
const {
  createMediaWebSocketServer,
  DEFAULT_PORT,
  DEFAULT_PATH,
} = require('./websocket_server.js');

const PORT = Number(process.env.PORT) || DEFAULT_PORT;

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

createMediaWebSocketServer(server, { path: DEFAULT_PATH });

server.listen(PORT, () => {
  console.log(`Legal Intake Voice Service — Node.js listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}${DEFAULT_PATH}`);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exitCode = 1;
});
