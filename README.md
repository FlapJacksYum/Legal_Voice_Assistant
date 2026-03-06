# Legal Intake Voice Service (Sovereign Voice)

AI-driven intake service for a bankruptcy law practice: automates initial client consultations using a cloned attorney voice, with strict ethical and data-privacy compliance.

## Project structure

```
├── src/                 # Application source
│   ├── models/          # SQLAlchemy models (e.g. IntakeCall)
│   ├── nodejs/          # Node.js voice pipeline (Twilio Media Streams, STT, Gemini, TTS)
│   │   ├── index.js     # HTTP server, /voice TwiML, WebSocket at /media
│   │   ├── websocket_server.js   # Twilio Media Streams WebSocket handler
│   │   ├── stt_client.js         # Google Cloud Speech-to-Text streaming client
│   │   ├── gemini_client.js      # Vertex AI Gemini 1.5 Flash for conversational logic
│   │   ├── gemini_prompt_manager.js  # System prompt + RAG (intake guidelines, deflection scripts)
│   │   ├── greeting.js           # Mandatory AI disclosure greeting (configurable attorney name)
│   │   └── tts_client.js         # Google Cloud Text-to-Speech (Custom Voice) for playback
│   ├── config/
│   │   └── rag/         # RAG content for Gemini (intake_guidelines.md, deflection_scripts.json)
│   └── database.py      # DB engine and session
├── migrations/          # Alembic migrations
├── tests/               # Pytest tests (Python)
├── docs/                # Documentation (API, deployment, setup)
├── scripts/             # Utility scripts
├── pyproject.toml       # Python project and deps
├── requirements.txt     # Pip install for Docker
├── .env.example         # Example env vars (copy to .env)
├── Dockerfile           # Python app image
└── alembic.ini          # Migration config
```

## Prerequisites

- **Python 3.10+** (for local run and migrations)
- **Docker & Docker Compose** (for containerized run)
- Optional: Node 18+ (for `src/nodejs` when used)

## Quick start (local)

1. **Clone and enter the repo**

   ```bash
   git clone <repository-url>
   cd Legal_Intake_Voice_Service
   ```

2. **Create a virtual environment and install dependencies**

   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -e ".[dev]"
   ```

3. **Set environment variables**

   ```bash
   export DATABASE_URL=sqlite:///./sql_app.db
   ```

4. **Run migrations**

   ```bash
   alembic upgrade head
   ```

5. **Run tests**

   ```bash
   pytest tests/ -v
   ```

## Docker

**Python app (current backend):**

```bash
docker build -t legal-intake-voice-service .
docker run --rm -e DATABASE_URL=sqlite:///./sql_app.db -v $(pwd)/data:/app/data legal-intake-voice-service
```

**Node.js voice component** (Twilio Media Streams, STT → Gemini → TTS):

```bash
cd src/nodejs && npm install && npm start
# Listens on port 8080 (or PORT). WebSocket: ws://localhost:8080/media
# GET /voice returns TwiML when TWILIO_MEDIA_STREAM_WS_URL is set.
# Google Cloud (optional but recommended for full pipeline):
#   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON (STT, TTS)
#   GOOGLE_CLOUD_PROJECT — GCP project ID (Gemini / Vertex AI)
#   GOOGLE_TTS_VOICE_NAME — optional; Custom Voice name when using cloned attorney voice
# Optional: ATTORNEY_NAME — name used in the AI disclosure greeting (default: "the attorney")
# Optional: RAG_CONFIG_DIR — path to RAG files (default: config/rag with intake guidelines and deflection scripts)
```

Or with Docker:

```bash
docker build -f src/nodejs/Dockerfile -t legal-intake-voice-node .
docker run --rm -p 8080:8080 legal-intake-voice-node
```

Run Node tests: `cd src/nodejs && npm test`

See [docs/api_and_deployment/deployment_guide.md](docs/api_and_deployment/deployment_guide.md) for full deployment, configuration, and production setup.

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/api_and_deployment/](docs/api_and_deployment/) | API reference and deployment guide |
| [docs/setup/twilio_media_streams.md](docs/setup/twilio_media_streams.md) | Twilio account, phone number, and Media Streams webhook setup |
| [docs/ai_config/gemini_prompts_rag.md](docs/ai_config/gemini_prompts_rag.md) | Gemini system prompt, RAG content, and how to update conversational logic |
| [.env.example](.env.example) | Example environment variables (copy to `.env`; do not commit `.env`) |

## License and compliance

- Redacted data only (FRBP 9037); no raw PII stored.
- Intake and UPL deflection only; no legal advice from the system.
