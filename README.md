# sentinel-service

Node.js + TypeScript service scaffolded with Clean Architecture. Fastify-based HTTP API, Postgres/Redis, OIDC (bearer + web session), RBAC, and cron-friendly jobs.

## Quickstart

```bash
pnpm install
cp .env.example .env

# start infra
docker compose up -d

# run migrations
pnpm migrate

# start API (auto-loads .env)

```

If local Postgres/Redis conflict on default ports, override:

```bash
POSTGRES_PORT=5440 REDIS_PORT=6380 docker compose up -d
```

Health check:

```bash
curl http://localhost:3000/health
```

## Configuration (env)

- Server: `PORT`, `HOST`, `LOG_LEVEL`, `TRUST_PROXY`, `CORS_ORIGINS`, rate limit (`RATE_LIMIT_MAX`, `RATE_LIMIT_TIME_WINDOW_MS`).
- Data: `DATABASE_URL`, `REDIS_URL`.
- Jobs: `JOBS_ENABLED`.
- Auth mode: `AUTH_MODE=disabled|oidc` (defaults to `disabled` in dev, forced `oidc` in prod).
- Dev auth (when `disabled`): `DEV_USER_SUB`, `DEV_USER_ROLES`.
- OIDC (API + web): `OIDC_ISSUER`*, `OIDC_CLIENT_ID`*, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`*, `OIDC_POST_LOGOUT_REDIRECT_URI`, `OIDC_SCOPES`, `OIDC_AUDIENCE`, `OIDC_JWKS_URI`.
- Sessions (web flow): `SESSION_SECRET`*, `SESSION_COOKIE_NAME`, `SESSION_TTL_SECONDS`, `SESSION_COOKIE_SECURE`.
- Keycloak helpers: `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`.
- Observability: `OTEL_EXPORTER_OTLP_ENDPOINT` (traces, also metrics unless `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` is set), `OTEL_EXPORTER_OTLP_HEADERS` (comma-separated `key=value` for auth), `OTEL_TRACES_SAMPLER`/`OTEL_TRACES_SAMPLER_ARG`, `OTEL_METRICS_EXPORT_INTERVAL_MS`.

`*` required when `AUTH_MODE=oidc`.

## Observability

- Set `OTEL_EXPORTER_OTLP_ENDPOINT` to your collector (HTTP/1.1 OTLP); metrics use the same endpoint unless `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` is provided.
- Add `OTEL_EXPORTER_OTLP_HEADERS` for auth (e.g., `Authorization=Bearer <token>`), and adjust `OTEL_TRACES_SAMPLER`/`OTEL_TRACES_SAMPLER_ARG` for sampling in prod.
- Validate delivery with `pnpm otel:smoke` (emits span `otel.smoke` and metric `otel_smoke_checks` to the configured endpoints).

### Local collector + scraper

- Bring up Jaeger, Prometheus, and the OTEL collector: `docker compose up -d otel-collector jaeger prometheus`.
- Point the app to the collector: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces` and `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics`.
- Jaeger UI: http://localhost:16686; Prometheus UI: http://localhost:9090 (collector’s Prometheus exporter is on http://localhost:9464/metrics).
- Run `pnpm otel:smoke` and confirm the span in Jaeger and the counter `otel_smoke_checks` via Prometheus.
- To see metrics in Prometheus: keep a producer running longer than one export interval (set `OTEL_METRICS_EXPORT_INTERVAL_MS=5000` for local), then in the Prometheus UI use the query box with autocomplete or query `http://localhost:9090/api/v1/label/__name__/values` to list metric names; you can also `curl http://localhost:9464/metrics` to inspect the scraped output directly.
- Common metrics you will see:
	- `otel_smoke_checks`: smoke-test counter proving OTLP metrics reach the collector.
	- `process_memory_rss_bytes`: resident memory in RAM.
	- `process_memory_heap_used_bytes`: V8 heap currently in use.
	- `process_cpu_user_microseconds` / `process_cpu_system_microseconds`: cumulative CPU time in user/system mode.
	- `process_event_loop_utilization`: fraction of time the event loop was busy since start.
	- `process_uptime_seconds`: process uptime.

## Load testing

- Quick HTTP pressure: `pnpm dlx autocannon -c 50 -d 30 http://localhost:3000/health` (adjust concurrency/duration; add headers as needed).
- Scriptable load with k6: `k6 run scripts/k6/health-smoke.js -e TARGET_URL=http://localhost:3000/health` (add `-e AUTH_HEADER="Bearer <token>"` for protected routes). Install k6 locally (e.g., `brew install k6`).

## Production presets

- Use `.env.prod.example` as a starting point; it contains conservative defaults:
	- `RATE_LIMIT_MAX=100` per 60s, `TRUST_PROXY=true`, CORS locked to your domain.
	- `AUTH_MODE=oidc` with required OIDC vars; `SESSION_COOKIE_SECURE=true` and strong `SESSION_SECRET`.
	- Postgres/Redis URLs expected to point to managed services.
	- OTEL: endpoints placeholder for your collector, sampler `traceidratio` at 0.1, metrics interval 10s. Replace `collector.example.com` and any auth header as needed.
	- `NODE_ENV=production` to enforce prod-safe behavior.

## Auth

- Bearer: `Authorization: Bearer <token>` verified via OIDC discovery/JWKS.
- Web login (Authorization Code + PKCE):
	- `GET /auth/login` → redirect to IdP
	- `GET /auth/callback` → exchanges code, creates secure cookie session
	- `POST /auth/logout` → clears session, optional RP logout redirect
- Sessions: `@fastify/secure-session` cookie; `req.principal` set from session or bearer token.
- Example protected route: `GET /me`.

## RBAC + Jobs

- Permissions: `requirePermission` middleware; `adminJobs.run` seeded in `migrations/002_seed_permissions.sql` (role `admin`).
- Job trigger: `POST /admin/jobs/:name/run` (needs `adminJobs.run`).
- Sample job: `sample.cleanup` (cron-ready and triggerable via API).

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
pnpm dev
pnpm migrate
```
