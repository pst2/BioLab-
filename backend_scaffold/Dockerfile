# ─────────────────────────────────────────────────────────────
# Single-stage build — đơn giản, đáng tin cậy cho Render/Railway
# ─────────────────────────────────────────────────────────────
FROM python:3.10-slim

WORKDIR /app

# Cài build tools (cần cho một số Python packages)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Cài Python dependencies trước (tận dụng Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code
COPY . .

# Port mặc định (Render ghi đè bằng biến môi trường $PORT)
EXPOSE 8000

# Chạy migration rồi start server
# Dùng ${PORT:-8000} để tương thích cả Render lẫn chạy local
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]