FROM node:22-alpine AS dashboard
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN pip install uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project --frozen
COPY src ./src
COPY migrations ./migrations
COPY alembic.ini ./
RUN uv sync --no-dev --frozen
COPY --from=dashboard /fe/dist ./frontend/dist
ENV PATH="/app/.venv/bin:$PATH"
