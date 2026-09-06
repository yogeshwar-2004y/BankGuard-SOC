# Multi-stage Dockerfile for Render & Container Deployment
# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /workspace

# Install backend dependencies
COPY backend/requirements-lock.txt ./backend/requirements-lock.txt
RUN pip install --no-cache-dir -r backend/requirements-lock.txt

# Copy backend, database and built static assets
COPY backend ./backend
COPY database ./database
COPY --from=frontend-builder /app/dist ./frontend/dist
COPY --from=frontend-builder /app/dist ./backend/static

# Create non-root user
RUN useradd --create-home bankguard && chown -R bankguard:bankguard /workspace
USER bankguard

WORKDIR /workspace/backend

EXPOSE 10000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
