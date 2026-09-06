FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /workspace/backend
COPY backend/requirements-lock.txt ./requirements-lock.txt
RUN pip install --no-cache-dir -r requirements-lock.txt && useradd --create-home bankguard
COPY backend ./
COPY database /workspace/database
RUN chown -R bankguard:bankguard /workspace
USER bankguard
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
