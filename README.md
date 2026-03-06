# Legal Intake Voice Service (Sovereign Voice)

AI-driven intake service for a bankruptcy law practice: automates initial client consultations using a cloned attorney voice, with strict ethical and data-privacy compliance.

## Project structure

```
├── src/                 # Application source
│   ├── models/          # SQLAlchemy models (e.g. IntakeCall)
│   ├── nodejs/          # Node.js component (Twilio/WebSocket placeholder)
│   └── database.py      # DB engine and session
├── migrations/          # Alembic migrations
├── tests/               # Pytest tests
├── docs/                # Documentation (API, deployment)
├── scripts/             # Utility scripts
├── pyproject.toml       # Python project and deps
├── requirements.txt    # Pip install for Docker
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

**Node.js component (placeholder for Twilio/WebSocket):**

```bash
docker build -f src/nodejs/Dockerfile -t legal-intake-voice-node .
docker run --rm legal-intake-voice-node
```

See [docs/api_and_deployment/deployment_guide.md](docs/api_and_deployment/deployment_guide.md) for full deployment, configuration, and production setup.

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/api_and_deployment/](docs/api_and_deployment/) | API reference and deployment guide |
| [docs/setup/twilio_media_streams.md](docs/setup/twilio_media_streams.md) | Twilio account, phone number, and Media Streams webhook setup |

## License and compliance

- Redacted data only (FRBP 9037); no raw PII stored.
- Intake and UPL deflection only; no legal advice from the system.
