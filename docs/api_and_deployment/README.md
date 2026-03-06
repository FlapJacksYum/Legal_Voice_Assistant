# API and Deployment Documentation

This directory contains documentation for the **Legal Intake Voice Service** (Sovereign Voice): a Dockerized application that provides an AI-driven intake service for attorney review and production deployment.

## Purpose

- **API documentation** — Describes all public-facing API endpoints used for attorney review of redacted intake call records. Authorized personnel use these endpoints to retrieve and audit `IntakeCall` data without raw PII.
- **Deployment documentation** — Step-by-step instructions for deploying, configuring, and managing the application (Python backend and Node.js voice pipeline) in production using Docker.

## Contents

| Document | Description |
|----------|-------------|
| [api_endpoints.md](api_endpoints.md) | API reference for the `/api/calls` endpoint: authentication, request/response schemas, and examples. |
| [deployment_guide.md](deployment_guide.md) | Prerequisites, Docker build and run, production deployment, configuration (incl. Twilio and STT), logging, monitoring, and scaling. |
| [../setup/twilio_media_streams.md](../setup/twilio_media_streams.md) | Twilio account, phone number, and Media Streams webhook setup for the Node.js voice component. |
| [../ai_config/gemini_prompts_rag.md](../ai_config/gemini_prompts_rag.md) | Gemini system prompt, RAG content (intake guidelines, deflection scripts), and updating conversational logic. |

## Audience

- **Developers** — Building or integrating with the service; deploying via Docker.
- **Operators** — Configuring, monitoring, and updating the running application.
- **Firm management** — Reviewing API capabilities and access for attorney oversight.

## Related

- Application source: `src/` (Python: `src/models/`, `src/database.py`; Node.js voice pipeline: `src/nodejs/`)
- Database migrations: `migrations/`
- Environment and configuration: see [deployment_guide.md](deployment_guide.md#configuration). Copy `.env.example` to `.env` and fill in values.
