# Whole-app image: the dashboard is built with Node, then bundled into the Python
# image so `api` serves both the REST API and the dashboard at "/". Lives at the
# repo root because it consumes both backend/ and frontend/; build context is root.
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
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --no-dev --no-install-project --frozen
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
RUN uv sync --no-dev --frozen
COPY --from=dashboard /fe/dist ./frontend/dist
ENV PATH="/app/.venv/bin:$PATH"
