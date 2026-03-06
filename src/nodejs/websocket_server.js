/**
 * Twilio Media Streams WebSocket server.
 * Receives real-time audio from Twilio, buffers chunks, and can send audio back for playback.
 * Endpoint: ws://host:port/media (path configurable).
 */

const { WebSocketServer } = require('ws');

const DEFAULT_PORT = 8080;
const DEFAULT_PATH = '/media';

function log(level, message, meta = {}) {
  const ts = new Date().toISOString();
  const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  console[level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'](`[${ts}] [MediaWS] ${message}${extra}`);
}

/**
 * Validates that the request is authorized (e.g. Twilio request).
 * Override or extend for token/signature validation.
 * @param {object} request - Node HTTP request
 * @returns {boolean}
 */
function validateConnection(request) {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  const path = url.pathname;
  if (path !== DEFAULT_PATH && path !== DEFAULT_PATH + '/') {
    return false;
  }
  // Optional: check query token or header (e.g. X-Twilio-Signature)
  const token = url.searchParams.get('token') || request.headers['x-twilio-token'];
  if (process.env.WS_AUTH_TOKEN && token !== process.env.WS_AUTH_TOKEN) {
    return false;
  }
  return true;
}

/**
 * Create and return a WebSocket server bound to the given HTTP server.
 * @param {import('http').Server} server - HTTP server (e.g. from createServer())
 * @param {object} options - { path: string, onMediaChunk: (ws, base64Payload) => void }
 * @returns {import('ws').WebSocketServer}
 */
function createMediaWebSocketServer(server, options = {}) {
  const path = (options.path ?? DEFAULT_PATH).replace(/\/+$/, '') || '/';
  const pathMatch = path.startsWith('/') ? path : `/${path}`;
  const onMediaChunk = options.onMediaChunk;

  const wss = new WebSocketServer({
    server,
    path: pathMatch,
  });

  wss.on('connection', (ws, request) => {
    if (!validateConnection(request)) {
      log('warn', 'Connection rejected: unauthorized', { url: request.url });
      ws.close(4401, 'Unauthorized');
      return;
    }

    let streamSid = null;
    const audioBuffer = [];

    log('info', 'WebSocket connection opened', { url: request.url });

    ws.on('message', (data, isBinary) => {
      try {
        const raw = isBinary ? data : data.toString('utf8');
        const msg = isBinary ? { event: 'media', raw } : parseMessage(raw);
        if (!msg) {
          log('warn', 'Invalid or non-JSON message ignored');
          return;
        }
        if (msg.event === 'start' && msg.start && msg.start.streamSid) {
          streamSid = msg.start.streamSid;
          ws._streamSid = streamSid;
          log('info', 'Stream started', { streamSid });
        }
        if (msg.event === 'media' && msg.media && msg.media.payload) {
          audioBuffer.push({
            payload: msg.media.payload,
            sequenceNumber: msg.sequenceNumber,
            timestamp: msg.media.timestamp,
          });
          if (typeof onMediaChunk === 'function') {
            onMediaChunk(ws, msg.media.payload);
          }
        }
      } catch (err) {
        log('error', 'Message handling error', { error: err.message });
        ws.emit('error', err);
      }
    });

    ws.on('close', (code, reason) => {
      log('info', 'WebSocket connection closed', { code, reason: reason?.toString?.() || reason });
    });

    ws.on('error', (err) => {
      log('error', 'WebSocket error', { error: err.message });
    });

    // Attach buffer and streamSid for downstream use
    ws._mediaBuffer = audioBuffer;
    ws._streamSid = streamSid;
  });

  wss.on('error', (err) => {
    console.error('[WebSocket Server] error:', err.message);
  });

  return wss;
}

/**
 * Parse incoming JSON message; normalize Twilio media format.
 * @param {string} raw
 * @returns {object|null}
 */
function parseMessage(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Send a media chunk to the Twilio WebSocket (for playback).
 * Twilio expects: { event: "media", media: { payload: "<base64>" } }
 * @param {import('ws').WebSocket} ws
 * @param {string} base64Payload
 * @returns {boolean}
 */
function sendAudioChunk(ws, base64Payload) {
  if (ws.readyState !== 1) return false;
  try {
    const msg = JSON.stringify({
      event: 'media',
      media: { payload: base64Payload },
    });
    ws.send(msg);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Get buffered audio chunks for a client (from ws._mediaBuffer).
 * @param {import('ws').WebSocket} ws
 * @returns {Array<{ payload: string, sequenceNumber?: string, timestamp?: string }>}
 */
function getBufferedChunks(ws) {
  return (ws._mediaBuffer && Array.isArray(ws._mediaBuffer)) ? [...ws._mediaBuffer] : [];
}

module.exports = {
  createMediaWebSocketServer,
  sendAudioChunk,
  getBufferedChunks,
  DEFAULT_PORT,
  DEFAULT_PATH,
  validateConnection,
  parseMessage,
};
