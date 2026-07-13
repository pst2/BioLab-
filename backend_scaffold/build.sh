#!/usr/bin/env bash
set -e

echo "==> Installing dependencies..."
pip install -r requirements-prod.txt

echo "==> Running database migrations..."
alembic upgrade head

echo "==> Build complete."
