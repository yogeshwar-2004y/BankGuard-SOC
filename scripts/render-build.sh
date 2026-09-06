#!/usr/bin/env bash
# Render native build script
set -e

echo "=== Installing Python dependencies ==="
pip install -r backend/requirements-lock.txt

echo "=== Building React Frontend ==="
cd frontend
npm ci
npm run build
cd ..

echo "=== Copying Frontend dist to backend static ==="
mkdir -p backend/static
cp -r frontend/dist/* backend/static/

echo "=== Running Database Migrations ==="
cd backend
alembic upgrade head
cd ..

echo "=== Build Complete ==="
