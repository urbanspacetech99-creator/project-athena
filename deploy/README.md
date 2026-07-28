# Athena — production deployment

Artifacts in this directory:

| File | What it is |
|---|---|
| `docker-compose.yml` | Prod-style stack: `postgres`, `adminer`, `api`, `worker` (external `urbanspace_intra` network). |
| `athena-backend-0.3.0.tar` | The built app image (`athena-backend:0.3.0` + `:latest`, ~304 MB). **Git-ignored** — move it manually. |

The `api` and `worker` services run the **same** image (`athena-backend:0.3.0`), differing only by command (`uvicorn …` vs `python -m athena.worker.main`). `postgres:18.1-alpine3.23` and `adminer:5.4.1-standalone` are public images pulled on the server.

## 1. Move artifacts to the server

Copy `docker-compose.yml` and `athena-backend-0.3.0.tar` to the server (e.g. `scp deploy/docker-compose.yml deploy/athena-backend-0.3.0.tar user@server:/opt/athena/`).

## 2. One-time prerequisites on the server

```bash
# The compose expects this network to already exist (external).
docker network create urbanspace_intra   # skip if it already exists

# Load the app image (creates athena-backend:0.3.0 and :latest).
docker load -i athena-backend-0.3.0.tar
docker image ls | grep athena-backend
```

## 3. Fill in the environment

Open `docker-compose.yml` and fill values in the `x-app-env: &app_env` block (once — `api` and `worker` share it via the anchor) and in the `postgres` service's `environment`:

- **`postgres.environment`** — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- **`x-app-env` → `DATABASE_URL`** — must match the three above and point at the `postgres` host:
  `postgresql+psycopg://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>`
- **Modes** — set `SOURCE_MODE`, `LLM_MODE`, `IMAGE_MODE`, `CANVA_MODE` (and any per-source override) to `live` where you want real APIs; `fixture`/`fake` otherwise.
- **Secrets** — `CLAUDE_API_KEY`, `GEMINI_API_KEY`, Canva/Meta/Google/Zoho tokens.
- **`SERVE_FRONTEND`** *(optional)* — default `true`; set `false` to serve the API only (no dashboard at `/`).
- Vars marked `(optional)` have safe built-in defaults; leave blank to use them.

## 4. Bring it up

```bash
docker compose -f docker-compose.yml up -d
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs -f api
```

On first start the `api` container **auto-creates the database and migrates to head** (when `DB_AUTO_CREATE` is unset/`true`), then seeds the UrbanSpace config defaults. `restart: always` means `api`/`worker` retry until `postgres` is accepting connections, so a slow DB first-boot self-heals.

## 5. Reach the services

All services are `expose`-only (internal to `urbanspace_intra`), matching the prod convention — front them with your reverse proxy on that network:

| Service | Internal address | Serves |
|---|---|---|
| `api` | `athena-api:8000` | REST API (`/docs`, `/openapi.json`) **and** the bundled marketing dashboard at `/` (disable with `SERVE_FRONTEND=false`) |
| `adminer` | `adminer:8080` | DB admin UI |
| `postgres` | `postgres:5432` | Database |

To publish a service directly on the host instead of via a proxy, add a `ports:` mapping (e.g. `- "127.0.0.1:8000:8000"` under `api`).

## Rebuilding a new image version

From the repo root, rebuild and re-tag (bump the version), then `docker save` and repeat from step 1:

```bash
docker build -t athena-backend:<version> .
docker save athena-backend:<version> -o deploy/athena-backend-<version>.tar
```

Update the `image:` tag in `docker-compose.yml` (`api` and `worker`) to match.

> Note on `postgres:18` — the compose mounts the named volume `data` at `/var/lib/postgresql/` (matching the prod stack). Keep this consistent across upgrades; changing the mount path orphans the existing data volume.
