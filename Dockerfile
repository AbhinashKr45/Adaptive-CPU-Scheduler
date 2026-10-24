# Multi-Stage Production Dockerfile for Adaptive OS Scheduling Framework
# Stage 1: Build frontend static distribution
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime image with GCC, Python 3.12, C engine compilation, and FastAPI
FROM python:3.12-slim AS runner
WORKDIR /app

# Install GCC, make, and build essentials for the authoritative C99 scheduling engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    make \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy C engine source code, Makefile, and main.c
COPY src/ ./src/
COPY main.c Makefile ./

# Compile authoritative C scheduling engine and verify CLI builds clean
RUN make all && ./scheduler_cli --help > /dev/null 2>&1

# Copy backend code, data, and benchmark results
COPY backend/ ./backend/
COPY data/ ./data/
COPY results/ ./results/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose API and frontend unified port
EXPOSE 8000

ENV PORT=8000
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
