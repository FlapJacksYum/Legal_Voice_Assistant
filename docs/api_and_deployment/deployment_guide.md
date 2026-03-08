# Deployment Guide

This guide covers prerequisites, building, deploying, and managing the Legal Intake Voice Service in local and production environments.

## Architecture overview

- **Python backend** — Database (IntakeCall), migrations, and the REST API (`/api/calls`) for attorney review of redacted call records. Served by the root `Dockerfile` and runs on a configurable port (e.g. 8000).
- **Node.js voice component** — Twilio Media Streams WebSocket (`/media`), TwiML endpoint (`/voice`), and optional Google Cloud pipeline: Speech-to-Text (STT), Vertex AI Gemini (conversational logic), and Text-to-Speech (TTS) for playback. Runs separately (default port 8080). See [Twilio Media Streams setup](../setup/twilio_media_streams.md).

Both can run on the same host or different hosts; the voice component only needs to be reachable by Twilio at a public `wss://` URL.

---

## Prerequisites

Before deploying, ensure the following are installed and configured.

### Required software

| Software | Purpose | Check |
|----------|---------|--------|
| **Docker** (20.10+) | Container runtime | `docker --version` |
| **Docker Compose** (2.0+) | Multi-container and local runs | `docker compose version` |
| **Git** | Clone repository | `git --version` |

### Optional (for local development without Docker)

| Software | Purpose |
|----------|--------|
| **Python 3.10+** | Run app and scripts locally |
| **Google Cloud SDK** | If using GCP (Speech-to-Text, Vertex AI, TTS, DLP) |
| **Twilio CLI / account** | If testing voice/Media Streams |

### Cloud and external services (production)

- **Google Cloud Project** — Speech-to-Text, Vertex AI (Gemini), Text-to-Speech, Sensitive Data Protection (DLP) enabled; service account credentials.
- **Twilio account** — Phone number and Media Streams webhook configured to point to the deployed app. See [Twilio Media Streams setup](../setup/twilio_media_streams.md) for step-by-step configuration.
- **Environment variables** — All secrets and config (API keys, `DATABASE_URL`, Twilio vars, etc.) set in the deployment environment; see [Configuration](#configuration).

---

## Step-by-step deployment

### 1. Clone the repository

```bash
git clone <repository-url>
cd Legal_Intake_Voice_Service
```

Replace `<repository-url>` with your Git remote (e.g. `https://github.com/your-org/legal-intake-voice-service.git`).

### 2. Set up environment variables

Create a `.env` file in the project root (or configure your deployment platform’s env). At minimum:

```bash
# Database (default SQLite for local; use PostgreSQL URL in production)
DATABASE_URL=sqlite:///./sql_app.db

# Optional: echo SQL statements for debugging
# SQL_ECHO=false
```

For production you will also need variables for Google Cloud, Twilio, and API auth; see [Configuration](#configuration).

**Security:** Do not commit `.env` or any file containing secrets. Add `.env` to `.gitignore`.

### 3. Build the Docker image

From the project root:

```bash
docker build -t legal-intake-voice-service:latest .
```

This assumes a `Dockerfile` in the project root. Typical contents include:

- Base image (e.g. `python:3.11-slim`)
- Install dependencies from `pyproject.toml` or `requirements.txt`
- Copy application code (`src/`, `migrations/`)
- Expose the application port (e.g. `8000`)
- Default command to run the app (e.g. run migrations then start the server)

### 4. Run the application locally (testing)

**Option A — Docker Compose (recommended for local):**

```bash
docker compose up --build
```

Use a `docker-compose.yml` that defines the app service, optional DB volume for SQLite/PostgreSQL, and env file.

**Option B — Single container:**

```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=sqlite:///./sql_app.db \
  -v $(pwd)/data:/app/data \
  legal-intake-voice-service:latest
```

Adjust `-v` and `DATABASE_URL` if you use a file-based SQLite path or an external database.

**Option C — Local Python (no Docker):**

```bash
pip install -e .
export DATABASE_URL=sqlite:///./sql_app.db
alembic upgrade head
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

(Replace `src.main:app` with the actual application entry point when the web server is implemented.)

**Option D — Node.js voice component (Twilio Media Streams + STT):**

The voice pipeline runs separately from the Python app. It serves the WebSocket at `/media` for Twilio and the TwiML endpoint at `/voice`.

```bash
cd src/nodejs
npm install
npm start
# Listens on PORT (default 8080). WebSocket: ws://localhost:8080/media
```

Set `TWILIO_MEDIA_STREAM_WS_URL` (public `wss://` URL) so `/voice` returns valid TwiML. Set `GOOGLE_APPLICATION_CREDENTIALS` for STT and TTS; set `GOOGLE_CLOUD_PROJECT` to enable Gemini. Without these, the app still runs but does not transcribe or respond with AI. See [Twilio Media Streams setup](../setup/twilio_media_streams.md).

Docker:

```bash
docker build -f src/nodejs/Dockerfile -t legal-intake-voice-node .
docker run --rm -p 8080:8080 \
  -e TWILIO_MEDIA_STREAM_WS_URL=wss://your-host/media \
  -e GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
  -v /path/to/key.json:/path/to/key.json:ro \
  legal-intake-voice-node
```

### 5. Deploy to production

- **Docker Compose on a VM:** Use the same image and `docker compose -f docker-compose.prod.yml up -d` with production `DATABASE_URL`, secrets, and networking.
- **Container orchestration (e.g. GKE, ECS):** Push the image to a registry and deploy via your platform’s workflow (Kubernetes manifests, task definitions, etc.). Ensure:
  - Environment variables are set (see [Configuration](#configuration)).
  - Persistent storage or an external database is used for `DATABASE_URL` (e.g. PostgreSQL).
  - Health checks and readiness probes point at the app’s HTTP port.
- **Run database migrations** as part of startup or a one-off job: `alembic upgrade head`.

---

## Configuration

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | No | `sqlite:///./sql_app.db` | SQLAlchemy database URL (SQLite or PostgreSQL). |
| `SQL_ECHO` | No | — | Set to `1`, `true`, or `yes` to log SQL statements. |
| `API_KEY` or auth vars | Yes (for API) | — | API key or JWT issuer config for `/api/calls`. |
| `TWILIO_ACCOUNT_SID` | When using Twilio | — | Twilio account SID ([setup guide](../setup/twilio_media_streams.md)). |
| `TWILIO_AUTH_TOKEN` | When using Twilio | — | Twilio auth token (keep secret). |
| `TWILIO_MEDIA_STREAM_WS_URL` | When using voice | — | Public WebSocket URL for Media Streams, e.g. `wss://your-host.example.com/media`. Required for the `/voice` TwiML endpoint. |
| `WS_AUTH_TOKEN` | No | — | If set, WebSocket server requires this token (query or header). |
| `GOOGLE_APPLICATION_CREDENTIALS` | For STT/TTS (Node.js) | — | Path to service account JSON key. When set, caller audio is streamed to Speech-to-Text and TTS can synthesize replies. If unset, the Node app still runs (WebSocket and `/voice`) but does not transcribe or speak. |
| `GOOGLE_CLOUD_PROJECT` | For Gemini (Node.js) | — | GCP project ID. When set with credentials, Vertex AI (Gemini 1.5 Flash) is used for conversational logic. |
| `GOOGLE_TTS_VOICE_NAME` | No (Node.js) | `en-US-Neural2-D` | TTS voice name; set to Custom Voice name when using attorney voice clone. |
| `ATTORNEY_NAME` | No (Node.js) | `the attorney` | Name used in the mandatory AI disclosure greeting played at call start. |
| `RAG_CONFIG_DIR` | No (Node.js) | (auto) | Path to RAG config directory (intake guidelines, deflection scripts). Default: `config/rag` relative to project root. |
| `PORT` | No (Node.js) | `8080` | HTTP/WebSocket port for the Node.js voice component. |
| Google Cloud / etc. | When used | — | Credentials for STT, Gemini, TTS, DLP. |

**Voice pipeline behavior:** When the caller’s transcription contains high-stress financial keywords (e.g. foreclosure, garnishment, sheriff sale), the next AI response is synthesized with empathetic SSML (slightly lower pitch, slower rate) via `tone_adjuster.js`. No extra env is required; the keyword list is defined in code.

Keep secrets in a secrets manager or deployment platform; avoid hardcoding. For a full list of example variables, see `.env.example` in the project root.

### Managing configuration

- **Local:** Use a `.env` file and load it (e.g. `python-dotenv` or Docker Compose `env_file`).
- **Production:** Use the platform’s env or secrets (e.g. Cloud Run env vars, Kubernetes Secrets). Rotate API keys and credentials periodically.

---

## Logging

- **Application logs** — Use a structured logger (e.g. Python `logging` with JSON or key-value format). Include request IDs, call IDs where applicable, and severity.
- **Where to send logs** — In production, ship logs to your preferred sink (e.g. Google Cloud Logging, Datadog, ELK). Configure via your container or platform.
- **What to log** — Request/response metadata, errors, and high-level call lifecycle events. **Do not log raw PII or unredacted transcripts.**
- **Log level** — Default `INFO`; set to `DEBUG` only for troubleshooting and restrict in production.

---

## Monitoring

- **Health endpoint** — Expose a liveness/readiness endpoint (e.g. `GET /health`) that returns 200 when the app and database are reachable.
- **Metrics** — Track at least:
  - Request count and latency for `/api/calls` and voice pipeline endpoints.
  - Error rate and external API failures (STT, Gemini, TTS, DLP).
  - Database connection pool and migration status.
- **Tools** — Use your platform’s monitoring (e.g. Google Cloud Monitoring, Prometheus/Grafana) and wire the app to expose metrics or use an agent.
- **Alerts** — Set alerts on high error rate, latency spikes, and failed health checks.

---

## Updating and scaling

### Updating the application

1. Pull the latest code: `git pull` (or use CI/CD to build from main).
2. Rebuild the image: `docker build -t legal-intake-voice-service:<tag> .`.
3. Run migrations: `alembic upgrade head` (in the new container or as a job).
4. Deploy the new image (rolling update or replace tasks) and verify health.

### Scaling

- **Horizontal:** Run multiple instances behind a load balancer. Use a shared database (PostgreSQL); avoid file-based SQLite for multi-instance.
- **Database:** Prefer a managed PostgreSQL (or similar) for production; tune connection pool size and timeouts in `DATABASE_URL` and app config.
- **Resource limits:** Set CPU/memory limits and requests in Docker or Kubernetes to avoid one container affecting others.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| App won’t start | Logs on startup; `DATABASE_URL` and port conflicts. |
| 401 on `/api/calls` | API key or JWT configuration and header. |
| DB errors | Migration status (`alembic current`), connectivity, and disk for SQLite. |
| Node voice: no STT output | Set `GOOGLE_APPLICATION_CREDENTIALS` to a valid service account JSON path; ensure Speech-to-Text API is enabled in Google Cloud. |
| Node voice: no AI reply / no TTS | Set `GOOGLE_CLOUD_PROJECT` for Gemini; ensure Vertex AI and Text-to-Speech APIs are enabled. Check `[Gemini]` and `[TTS]` in logs. |
| Twilio not connecting to WebSocket | `TWILIO_MEDIA_STREAM_WS_URL` must be public `wss://`; phone number "A CALL COMES IN" must point to `/voice` or a TwiML Bin with the correct Stream URL. |
| High latency | Database and external APIs (STT, Gemini, TTS); consider caching and timeouts. |

For application-specific errors, consult the codebase and runbooks. Keep documentation in this repo and in your deployment pipeline up to date.
