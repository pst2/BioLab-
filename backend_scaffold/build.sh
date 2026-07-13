#!/usr/bin/env bash
set -e

echo "==> Python version: $(python --version)"
echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing dependencies..."
pip install -r requirements-prod.txt

echo "==> Running database migrations..."
alembic upgrade head

echo "==> Build complete."
