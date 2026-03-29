# --- Stage 1: Build frontend assets ---
FROM oven/bun:latest AS frontend-builder

WORKDIR /build

# Cache bun install layer separately from source
COPY frontend/package.json ./
RUN bun install

# Copy rest of frontend source and build
COPY frontend/ ./
RUN bun run build
# Output: /build/dist/


# --- Stage 2: Python runtime ---
FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir pyboy Pillow websockets pytest

# Copy Python source and tests
COPY src /app/src
COPY tests /app/tests

# Replace the plain web directory with the compiled frontend bundle
COPY --from=frontend-builder /build/dist /app/src/web

ENV STATE_DIR=/app/state

EXPOSE 8765

CMD ["python", "src/main.py", "--speed", "1x", "--port", "8765"]
