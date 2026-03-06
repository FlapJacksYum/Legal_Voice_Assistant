/**
 * Unit tests for Twilio Media Streams WebSocket server.
 * Run: node --test websocket_server.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const WebSocket = require('ws');
const {
  createMediaWebSocketServer,
  sendAudioChunk,
  getBufferedChunks,
  DEFAULT_PORT,
  DEFAULT_PATH,
} = require('./websocket_server.js');

const PORT = 0; // let OS pick

describe('WebSocket server', () => {
  let server;
  let wss;
  let baseUrl;

  before(() => {
    server = http.createServer((req, res) => {
      res.writeHead(404);
      res.end();
    });
    wss = createMediaWebSocketServer(server, { path: DEFAULT_PATH });
    return new Promise((resolve) => {
      server.listen(PORT, () => {
        const a = server.address();
        baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => server.close(resolve));
  });

  it('initializes and listens on the assigned port', () => {
    assert.strictEqual(server.listening, true);
    const addr = server.address();
    assert.ok(addr.port > 0);
    assert.ok(addr.address === '::' || addr.address === '127.0.0.1' || addr.address === '0.0.0.0');
  });

  it('accepts connection on /media and receives/buffers audio chunks', async () => {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + DEFAULT_PATH;
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    ws.send(JSON.stringify({
      event: 'start',
      start: { streamSid: 'MS-test-123' },
    }));
    ws.send(JSON.stringify({
      event: 'media',
      sequenceNumber: '1',
      media: { payload: 'dGVzdC1hdWRpby1jaHVuaw==', timestamp: '1000' },
    }));
    ws.send(JSON.stringify({
      event: 'media',
      sequenceNumber: '2',
      media: { payload: 'bW9yZS1hdWRpby0=', timestamp: '2000' },
    }));

    await new Promise((r) => setTimeout(r, 80));

    const [serverWs] = wss.clients;
    assert.ok(serverWs, 'server should have one client');
    const chunks = getBufferedChunks(serverWs);
    assert.ok(Array.isArray(chunks));
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].payload, 'dGVzdC1hdWRpby1jaHVuaw==');
    assert.strictEqual(chunks[1].payload, 'bW9yZS1hdWRpby0=');

    ws.close();
    await new Promise((r) => { ws.on('close', r); });
  });

  it('sends audio chunk back to client', async () => {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + DEFAULT_PATH;
    const clientWs = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      clientWs.on('open', resolve);
      clientWs.on('error', reject);
    });

    const received = [];
    clientWs.on('message', (data) => {
      received.push(JSON.parse(data.toString()));
    });

    const [serverWs] = wss.clients;
    assert.ok(serverWs, 'server should have one client');
    const sent = sendAudioChunk(serverWs, 'cmVwbHktYXVkaW8=');
    assert.strictEqual(sent, true);

    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].event, 'media');
    assert.strictEqual(received[0].media.payload, 'cmVwbHktYXVkaW8=');

    clientWs.close();
    await new Promise((r) => { clientWs.on('close', r); });
  });

  it('handles connection close and error gracefully', async () => {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + DEFAULT_PATH;
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    const closePromise = new Promise((r) => { ws.on('close', r); });
    ws.close(1000, 'Normal closure');
    await closePromise;
    assert.strictEqual(ws.readyState, WebSocket.CLOSED);
  });
});
