# ─────────────────────────────────────────────
# Stage 1: Build / install dependencies
# ─────────────────────────────────────────────
FROM python:3.10-slim AS builder

WORKDIR /app

# Install build tools needed for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python deps into a separate prefix
# so the final image doesn't need apt/gcc at all
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ─────────────────────────────────────────────
# Stage 2: Production image
# ─────────────────────────────────────────────
FROM python:3.10-slim AS runner

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Create a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app

USER appuser

# Expose FastAPI port
EXPOSE 8000

# Run Alembic migrations then start uvicorn
# --workers 1 is safe for SQLite (no shared connection pool issues)
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]