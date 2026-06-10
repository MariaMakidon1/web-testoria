# Testoria — Tech Stack Summary

Testoria is a **test management platform** organized around the hierarchy
**Project → TestSuite → TestCase → TestRun → TestResult**. The codebase splits into two repositories:
`api-testoria` (FastAPI backend) and `web-testoria` (Vue 3 SPA frontend). The api and its
stateful infra run as a Docker stack (published on `127.0.0.1`); the public edge is
**host-level nginx + system certbot**, and the SPA is served as static files from disk.

---

## Backend — `api-testoria`

REST API service that owns the database, object storage, and real-time event pipeline.

### Core runtime
| Tech | Version | Role in production |
|---|---|---|
| **Python** | 3.11 | Runtime for the API process. |
| **FastAPI** | 0.111 | HTTP framework. Routers in `app/api/v1/` are kept thin — they validate input, call one service, return a Pydantic schema. Auto-generated OpenAPI docs at `/docs`. |
| **Uvicorn** (`[standard]`) | 0.29 | ASGI server. Runs the FastAPI app inside the `api` container, published on `127.0.0.1:8000` and reached by host nginx. |
| **Pydantic v2** + `pydantic-settings` | 2.7 / 2.2 | Request/response schemas (`app/schemas/`) and env-driven config (`app/config.py`). Settings come from `.env.prod` mounted into the container — no hardcoded secrets. |

### Data layer
| Tech | Version | Role in production |
|---|---|---|
| **PostgreSQL** | 16-alpine | Primary datastore. Runs as the `postgres` service with a healthcheck (`pg_isready`) and a persistent `postgres_data` volume. Only reachable on the internal Docker network. |
| **SQLAlchemy 2.0** (async) | 2.0.30 | ORM. All DB calls are `async def` / `await` — there is no synchronous session use. Models in `app/models/` are pure data; business logic lives in services. |
| **asyncpg** | 0.29 | Async PostgreSQL driver wired under SQLAlchemy. |
| **Alembic** | 1.13 | Schema migrations. Migrations are append-only (never edited in place); `alembic upgrade head` runs as part of deployment. |

### Object storage
| Tech | Role in production |
|---|---|
| **MinIO** | S3-compatible object storage for result attachments (`testoria-attachments` bucket). Replaces backend-local file persistence so API containers stay stateless. Buckets are persisted on the `minio_data` Docker volume. The container is on the `internal` network (API uploads/downloads via `http://minio:9000`) and is published on `127.0.0.1:9000`, which host nginx reverse-proxies publicly as `https://s3.testoria.gammait.net` for browser GETs of presigned URLs. |
| **S3 API / presigned URLs (dual endpoint)** | The API keeps authorization and object metadata; the browser fetches images directly via short-lived AWS SigV4 presigned URLs. Two endpoint URLs are configured: `S3_ENDPOINT_URL` (internal — used for `put_object`/`get_object`/`delete_object`) and `S3_PUBLIC_ENDPOINT_URL` (public — used only when generating presigned URLs returned to clients). |

### Auth & security
| Tech | Role in production |
|---|---|
| **python-jose** + **bcrypt** | JWT access/refresh tokens (`app/core/security.py`) and password hashing. All protected routes go through `Depends(get_current_user)` / `Depends(require_role(...))`. |
| **python-multipart** | Multipart parsing for file/attachment uploads. |
| Soft-delete mixin | Domain entities are soft-deleted (`deleted_at`) instead of physically removed; list/get queries filter via `not_deleted(Model)`. |

### Async / background / real-time
| Tech | Version | Role in production |
|---|---|---|
| **Redis** | 7-alpine | Backing store for Celery and (planned) cache. Runs as the `redis` service with a `redis_data` volume on the internal network. |
| **Celery** | 5.4 | Async task framework. Currently scaffolded (`app/tasks/report_tasks.py`) for deferred report generation. |
| **Centrifugo v5** | container | Real-time WebSocket fan-out. The API issues short-lived JWT connection/subscription tokens (`app/core/centrifugo.py`) and publishes events fire-and-forget over Centrifugo's HTTP API (`realtime_service.py`). Note: Centrifugo is on the `internal` network only and is **not yet exposed through the host edge** — wiring browser WS access is a tracked follow-up. |
| **httpx** | 0.27 | Outbound HTTP client used for Centrifugo publishes and external defect-tracker integrations (Jira, GitHub, GitLab). |

### Reporting / I/O
| Tech | Role in production |
|---|---|
| **openpyxl** | CSV/Excel test-case import + Excel report generation (`import_service.py`, `export_service.py`, `report_service.py`). |
| **reportlab** | Server-side PDF rendering of run reports. |
| **MinIO buckets** | Result attachments are stored as objects in the `testoria-attachments` bucket (configurable via `S3_BUCKET_ATTACHMENTS`) instead of writing into `/data/uploads` on the API container filesystem. |

### Tooling
`pytest` (unit + integration), `ruff` (lint/format), `mypy` (type checking) — gated before merge.

### Production topology (`docker-compose.prod.yml`)
Five services on a single private `internal` Docker network, image pulled from GHCR. The public edge is host-level nginx (see this repo's frontend section), not a container:
- `api` — Uvicorn + FastAPI, published on `127.0.0.1:8000` for host nginx.
- `postgres` — PostgreSQL 16 with healthcheck.
- `redis` — Redis 7.
- `centrifugo` — Centrifugo v5 with HMAC token secret + API key from env (internal only).
- `minio` — S3-compatible object storage for result attachments, backed by a persistent `minio_data` volume; published on `127.0.0.1:9000` so host nginx can serve it publicly at `https://s3.testoria.gammait.net`. The vhost lives in `api-testoria/deploy/api.vhost.conf`.

---

## Frontend — `web-testoria`

Vue 3 single-page app built to a static `dist/` bundle and served from disk by host nginx.

### Core runtime
| Tech | Version | Role in production |
|---|---|---|
| **Vue 3** | ^3.4 | Component framework (Composition API). |
| **TypeScript** | ~5.9 | Type-checked end-to-end; build runs `vue-tsc` before `vite build`. |
| **Vite** | ^6.4 | Build tool. Produces a static `dist/` bundle that CI ships to the host and nginx serves from `/var/www/testoria/current`. |
| **Node.js** | ≥24.13 | Build-time only (CI runner builds `dist/`; no Node in production). |

### State, routing, data
| Tech | Version | Role in production |
|---|---|---|
| **Pinia** | ^3.0 | Single source of shared state. One store per domain in `src/stores/`; components never call `api/` directly. |
| **Vue Router** | ^5.0 | Client-side routing. Every authenticated route is tagged `meta: { requiresAuth: true }` and gated by a navigation guard. |
| **Axios** | ^1.13 | HTTP client. The single `api/client` instance attaches the Bearer token, intercepts 401s, refreshes the JWT, and retries the request once. |

### UI / UX
| Tech | Role in production |
|---|---|
| **PrimeVue 4** + `@primevue/themes` + `primeicons` | Component library and theming used across the app. |
| **Tiptap 3** (`starter-kit`, `extension-link`, `extension-placeholder`) | Rich-text editor for test-case descriptions and step bodies. |
| **Chart.js** + **vue-chartjs** | Dashboard and report charts (pass-rate trends, distributions). |
| **date-fns** | Date formatting/manipulation throughout the UI. |
| **lodash-es** | Tree-shaken utilities. |

### Reporting / export
| Tech | Role in production |
|---|---|
| **ExcelJS** + **file-saver** | Client-side Excel export (composables `useExcelExport`, `useExport`). |
| **jsPDF** + **jspdf-autotable** | Client-side PDF generation (composable `usePdfExport`). |

### Tooling
`Vitest` + `happy-dom` + `@vue/test-utils` (unit), `Playwright` (e2e), `ESLint` + `Prettier`.

### Production topology (host nginx — no web container)
The frontend has no production container. CI builds `dist/` and ships it to the host; **host-level nginx** serves and routes everything:
- **host nginx** — the only public listener on ports 80/443. Terminates TLS, redirects HTTP → HTTPS, sets HSTS, and routes by hostname: `testoria.gammait.net` → static files at `/var/www/testoria/current` (`deploy/web.vhost.conf`), `api.testoria.gammait.net` → `127.0.0.1:8000` and `s3.testoria.gammait.net` → `127.0.0.1:9000` (`api-testoria/deploy/api.vhost.conf`). The s3 block keeps `proxy_set_header Host $host;` so AWS SigV4 signatures verify.
- **system certbot** — per-app Let's Encrypt certs (web owns `testoria.*`; api owns `api.*`+`s3.*`), renewed by the `certbot.timer` with a `systemctl reload nginx` deploy hook. `deploy/web.vhost.conf` carries the SPA fallback, asset caching, gzip, and security headers (formerly the inner container `nginx.conf`).

---

## How it fits together in production

```
      Browser
         │ HTTPS — routed by hostname
         ▼
 ┌──────────────────────────────────────────┐
 │  HOST nginx  (TLS, HSTS, HTTP→HTTPS)      │   ← OS service, not a container
 └──┬───────────────┬────────────────┬──────┘
    │               │                │
    │ testoria      │ api.testoria   │ s3.testoria
    │ .gammait.net  │ .gammait.net   │ .gammait.net
    ▼               ▼                ▼
 /var/www/        127.0.0.1:8000   127.0.0.1:9000
 testoria/        api ─ Uvicorn    minio (S3 object storage)
 current          (FastAPI)        — browser fetches
 (static dist)        │              attachments directly via
                      │              SigV4 presigned URLs
                      ├──► postgres (asyncpg)
                      ├──► redis (Celery broker / cache)
                      ├──► centrifugo (HTTP publish + JWT, internal only)
                      └──► minio (internal put/get over http://minio:9000)

  (follow-up) Browser ◄── WSS ──► centrifugo — not yet exposed through the edge
```

- The frontend has no production image — CI builds a static `dist/` bundle and rsyncs it to `/var/www/testoria/`.
- The backend image is pulled from GHCR; both repos deploy via GitHub Actions (`workflow_dispatch`).
- The api/infra containers are published on `127.0.0.1` only; host nginx is the sole public listener. There is no shared `testoria-proxy` docker network anymore.
- Secrets (`POSTGRES_PASSWORD`, `CENTRIFUGO_TOKEN_SECRET`, `CENTRIFUGO_API_KEY`, JWT `SECRET_KEY`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`) are injected via `.env.prod` — never baked into images.
- Persistence is on Docker volumes: `postgres_data` (DB), `redis_data` (Redis), `minio_data` (object storage). TLS certs live on the host under `/etc/letsencrypt`.

### Why MinIO fits this stack
- It removes dependence on API-container local storage, which makes horizontal scaling and container replacement safe for image-heavy workflows.
- It gives the backend one consistent storage model for screenshots, attachments, and future generated artifacts.
- It keeps the deployment self-hosted while preserving S3 compatibility, so migration to AWS S3 or another object store later is low-friction.
