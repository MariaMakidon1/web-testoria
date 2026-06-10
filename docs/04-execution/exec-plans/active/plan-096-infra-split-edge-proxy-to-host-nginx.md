# Execution Plan: Move the edge proxy to host nginx (web side)

**Date**: 2026-06-01
**Author**: gabriel.arapan
**Status**: In Progress — in-repo changes landed (vhost, deletions, CI); host cutover pending (see api-testoria `deploy/README.md`)

> **Pointer plan.** This is the web-side companion to the authoritative cross-repo plan:
> `api-testoria/docs/04-execution/exec-plans/active/047-infra-split-edge-proxy-per-app-nginx.md`
> Read that file first — it holds the full context, technical approach, risks, and Definition of Done.
> This file tracks only the **[web]** tasks so they are discoverable from this repo.

---

## Goal

Stop `web-testoria` from owning the dockerized edge proxy and TLS for the API/MinIO; have the host-level nginx serve the SPA `dist/` directly, with web shipping only its own vhost file.

---

## Context

Today the dockerized edge proxy lives in this repo (`proxy/nginx.conf` + `nginx-proxy`/`certbot` in `docker-compose.prod.yml`, which also *creates* the `testoria-proxy` network). Plan 047 moves the edge to **host-level nginx + system certbot**, keeps the api and stateful services in Docker, and serves the SPA from disk. This repo's job shrinks to: build `dist/`, ship one vhost file, and get out of the routing/TLS business.

See `api-testoria` plan 047 for the why (Docker-specific network/resolver/deadlock/webroot problems) and the host setup + certbot model.

---

## Scope (web side only)

### In scope
- `deploy/web.vhost.conf` — host nginx vhost for `testoria.gammait.net`, serving the SPA `dist/` from `/var/www/testoria/current`, with the gzip/cache/security-header rules folded in from `nginx.conf`.
- Remove this repo's prod container and dockerized proxy.
- Web CI builds `dist/` and ships it to the host (rsync + symlink flip + copy vhost + reload).

### Out of scope
- Everything host-level and api-side (covered by plan 047): host nginx install, certbot, api/minio loopback ports, the `internal`/`testoria-proxy` network changes.

---

## Tasks — [web]

### Implementation
- [ ] Create `deploy/web.vhost.conf`: 80→443 redirect + 443 server for `testoria.gammait.net`; `root /var/www/testoria/current`; SPA `try_files $uri $uri/ /index.html`; `/health`; fold in the gzip, asset-cache (`expires 1y, immutable`), no-cache-`index.html`, and `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy` rules from `nginx.conf`; reference the web cert at `/etc/letsencrypt/live/testoria.gammait.net/`.
- [ ] Delete `nginx.conf` (inner SPA server — rules moved into `deploy/web.vhost.conf`).
- [ ] Delete `proxy/nginx.conf` and the `proxy/` directory.
- [ ] Delete (or empty) `docker-compose.prod.yml` — no prod container in this repo anymore.
- [ ] Update `Dockerfile`: keep the build stage (CI uses it to produce `dist/`) and drop the nginx serve stage, or remove the Dockerfile if CI builds `dist/` outside Docker.
- [ ] Update CI (`.github/`): after `npm run build -- --mode prod`, rsync `dist/` to `/var/www/testoria/<release>/`, flip the `current` symlink, copy `deploy/web.vhost.conf` to the host, run `nginx -t && systemctl reload nginx`.

### Quality check
- [ ] Built SPA loads over `https://testoria.gammait.net`; deep links (e.g. `/projects/123`) fall back to `index.html`.
- [ ] Response headers match the old setup — diff `Cache-Control`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, gzip — none lost when dropping the inner nginx.
- [ ] `/health` returns 200.
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed.

### Docs update
- [ ] `docs/08-decisions/changelog.md` — record the move to host nginx + dropping the prod container.
- [ ] `docs/04-execution/tech-debt.md` — close any items tied to the dockerized proxy (resolver hack, network coupling).
- [ ] Update the deploy-topology description in `docs/02-architecture/` (edge nginx is host-level; SPA served from disk).
- [ ] Keep this plan in sync with api-testoria plan 047; move both to `completed/` together once the cutover is verified.

---

## Definition of done (web slice)

- [ ] This repo contains no routing/TLS for api or s3, no `proxy/`, and no prod container.
- [ ] `deploy/web.vhost.conf` is the single web-owned edge config; SPA served from `dist/` on the host with all prior headers preserved.
- [ ] Web CI ships `dist/` + the vhost and reloads host nginx.
- [ ] Docs/changelog updated; verified together with api-testoria plan 047 before both move to `completed/`.
