# --- Stage 1: Build the React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Serve the App using FastAPI ---
FROM python:3.11-slim
WORKDIR /app

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy backend requirements and install
COPY backend/main.py ./
COPY backend/db.py ./
COPY backend/ai.py ./

# Install python dependencies directly to system using uv
# Note: we use the FastAPI / uvicorn / google-genai packages we need
RUN uv pip install --system fastapi uvicorn psycopg2-binary google-genai python-dotenv

# Copy static frontend assets from Stage 1 into the FastAPI static files directory
COPY --from=frontend-builder /app/frontend/dist ./dist

# Run using the $PORT environment variable provided by Cloud Run
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
