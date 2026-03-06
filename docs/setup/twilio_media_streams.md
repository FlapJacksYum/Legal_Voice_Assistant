# Twilio Account and Media Streams Setup

This guide configures Twilio so that incoming calls stream real-time audio to the Legal Intake Voice Service WebSocket server (Sovereign Voice).

## Prerequisites

- A [Twilio account](https://www.twilio.com/try-twilio) with billing enabled (required for voice).
- The Node.js app running and reachable at a **public** URL (see [Network accessibility](#network-accessibility)).

## 1. Provision Twilio account and acquire a phone number

1. Sign up or log in at [Twilio Console](https://console.twilio.com).
2. Ensure your account has a positive balance or valid payment method (voice usage is billed).
3. In the console go to **Phone Numbers → Manage → Buy a number**.
4. Select a number with **Voice** capability and your desired country/region.
5. Purchase the number.

## 2. Configure the phone number for Media Streams

When a call comes in, Twilio must receive TwiML that connects the call to your WebSocket server.

### Option A: Use the app’s `/voice` endpoint (recommended)

The Node.js app exposes **GET /voice**, which returns TwiML that connects the call to the WebSocket URL set in `TWILIO_MEDIA_STREAM_WS_URL`.

1. Set the environment variable (see [Environment variables](#environment-variables)):
   - `TWILIO_MEDIA_STREAM_WS_URL` = your **public** WebSocket URL, e.g. `wss://your-public-host.example.com/media`.
2. In Twilio Console go to **Phone Numbers → Manage → Active numbers** and click your number.
3. Under **Voice configuration**:
   - **A CALL COMES IN**: set to **Webhook**.
   - **URL**: `https://your-public-host.example.com/voice` (same host as the WebSocket, over HTTPS).
   - **HTTP method**: GET.

Twilio will request `/voice` when a call arrives; the app responds with TwiML that starts a bidirectional Media Stream to your WebSocket.

### Option B: TwiML Bin (static URL)

If you prefer not to use the app’s `/voice` endpoint:

1. In Twilio Console go to **Develop → TwiML Bins → Create new**.
2. Set **Friendly Name** (e.g. “Sovereign Voice stream”).
3. Set **TwiML** to:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Response>
     <Connect>
       <Stream url="wss://YOUR_PUBLIC_WS_URL/media"/>
     </Connect>
   </Response>
   ```

   Replace `YOUR_PUBLIC_WS_URL` with your real public host (e.g. `your-app.ngrok.io` or your domain). Use **wss://** and the path **/media** to match the Node app’s WebSocket path.

4. Save and copy the TwiML Bin’s URL (e.g. `https://handler.twilio.com/twiml/...`).
5. On your **Phone Number** → **Voice** → **A CALL COMES IN**, select **TwiML Bin** and choose this bin.

## 3. Environment variables

Set these in your environment (e.g. `.env` or your deployment config). **Do not commit secrets.**

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes (for app use) | From [Twilio Console](https://console.twilio.com) → Account Info. |
| `TWILIO_AUTH_TOKEN` | Yes (for app use) | From same page; keep secret. |
| `TWILIO_MEDIA_STREAM_WS_URL` | Yes (for `/voice` TwiML) | Public WebSocket URL, e.g. `wss://your-host.example.com/media`. Must be **wss://** and publicly reachable. |
| `WS_AUTH_TOKEN` | No | If set, the WebSocket server requires this token (query `token` or header `X-Twilio-Token`). Omit for open dev; use in production. |
| `GOOGLE_APPLICATION_CREDENTIALS` | No (for STT/TTS) | Path to Google Cloud service account JSON key. When set, caller audio is streamed to Speech-to-Text and TTS can synthesize responses. See [Deployment guide](../api_and_deployment/deployment_guide.md#configuration). |
| `GOOGLE_CLOUD_PROJECT` | No (for Gemini) | GCP project ID. When set with credentials, Vertex AI (Gemini 1.5 Flash) is used for conversational logic; transcriptions are sent to Gemini and replies are synthesized and played to the caller. |
| `GOOGLE_TTS_VOICE_NAME` | No | TTS voice name (e.g. Custom Voice for attorney clone). Default: `en-US-Neural2-D`. Set when using a pre-trained Custom Voice model. |
| `ATTORNEY_NAME` | No | Name used in the mandatory AI disclosure greeting (e.g. "Jane Smith"). Default: "the attorney". The greeting states that the caller has reached the office and is speaking with the attorney's AI intake assistant. |

- When a call connects, the app plays a **mandatory AI disclosure greeting** in the configured TTS voice (or default). The greeting can be **interrupted** by the caller—as soon as the caller speaks, the greeting stops and the conversation (STT → Gemini → TTS) begins.
- The Node.js Media Streams server does not use Account SID/Auth Token for the WebSocket connection itself; Twilio connects to you. Store them for future features (e.g. REST API to control calls) and for consistency with the task “Set up Twilio Account SID and Auth Token as environment variables.”
- For local development, use a tunnel (e.g. [ngrok](https://ngrok.com)) so Twilio can reach both your HTTPS and WebSocket endpoints.

## 4. Network accessibility

- Twilio must reach your app over the internet:
  - **Development:** Expose your machine with a tunnel (e.g. `ngrok http 8080`). Use the ngrok **https** URL for `/voice` and the **wss** URL for `TWILIO_MEDIA_STREAM_WS_URL` (e.g. `wss://abc123.ngrok.io/media`).
  - **Production:** Deploy the app behind HTTPS (and WSS). Set `TWILIO_MEDIA_STREAM_WS_URL` to that public wss URL.
- Ensure your firewall allows WebSocket connections (typically over HTTPS/443).

## 5. Initial test call

1. Start the Node.js app (see [project README](../../README.md)), with `TWILIO_MEDIA_STREAM_WS_URL` set to your public wss URL.
2. Optionally set `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CLOUD_PROJECT` to enable the full pipeline (STT → Gemini → TTS).
3. Call your Twilio number from a phone.
4. You should see:
   - In the app logs: WebSocket connection opened, then `Stream started` and media events from Twilio.
   - The app plays the **AI disclosure greeting** (TTS) as soon as the stream starts. If the caller speaks during the greeting, it is interrupted and the conversation begins.
   - If STT is enabled: `[STT] Interim:` and `[STT] Final:` lines with transcribed speech.
   - If Gemini is enabled: `[Gemini]:` with the AI reply; TTS streams the reply back to the caller as audio.

If the connection fails, check:

- `TWILIO_MEDIA_STREAM_WS_URL` is **wss://** and exactly matches the URL Twilio can reach (including path `/media`).
- The phone number’s “A CALL COMES IN” points to your `/voice` URL (Option A) or the TwiML Bin that contains the correct `<Stream url="..."/>` (Option B).
- No firewall or proxy is blocking Twilio’s WebSocket connection.

## Summary checklist

- [ ] Twilio account created and phone number with Voice capability purchased.
- [ ] Phone number “A CALL COMES IN” set to Webhook (or TwiML Bin) that returns TwiML with `<Connect><Stream url="wss://.../media"/></Connect>`.
- [ ] `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` set in the environment (and kept secret).
- [ ] `TWILIO_MEDIA_STREAM_WS_URL` set to the public wss URL for `/media`.
- [ ] Test call places successfully and the app logs show a WebSocket connection and Twilio events.
