# API and Deployment Documentation

This directory contains documentation for the **Legal Intake Voice Service** (Sovereign Voice): a Dockerized application that provides an AI-driven intake service for attorney review and production deployment.

## Purpose

- **API documentation** — Describes all public-facing API endpoints used for attorney review of redacted intake call records. Authorized personnel use these endpoints to retrieve and audit `IntakeCall` data without raw PII.
- **Deployment documentation** — Step-by-step instructions for deploying, configuring, and managing the application in production using Docker.

## Contents

| Document | Description |
|----------|-------------|
| [api_endpoints.md](api_endpoints.md) | API reference for the `/api/calls` endpoint: authentication, request/response schemas, and examples. |
| [deployment_guide.md](deployment_guide.md) | Prerequisites, Docker build and run, production deployment, configuration, logging, monitoring, and scaling. |

## Audience

- **Developers** — Building or integrating with the service; deploying via Docker.
- **Operators** — Configuring, monitoring, and updating the running application.
- **Firm management** — Reviewing API capabilities and access for attorney oversight.

## Related

- Application source: `src/`
- Database migrations: `migrations/`
- Environment and configuration: see [deployment_guide.md](deployment_guide.md#configuration).
