# Legal Intake Voice Service — Python application
# Build: docker build -t legal-intake-voice-service .
# Run:   docker run --rm -p 8000:8000 -e DATABASE_URL=sqlite:///./sql_app.db legal-intake-voice-service

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application and migrations
COPY src/ src/
COPY migrations/ migrations/
COPY alembic.ini pyproject.toml ./

# Default: run migrations then start app (override when web server exists)
# For now, a no-op so the image builds; replace with uvicorn/gunicorn when BE is ready
ENV PYTHONPATH=/app
CMD ["sh", "-c", "alembic upgrade head && echo 'Migrations complete. Start app with: python -m uvicorn src.main:app --host 0.0.0.0 --port 8000'"]
