# sentinel-service

Fastify + TypeScript Clean Architecture service with OIDC-based auth, RBAC, cron-friendly jobs, and OTEL instrumentation. Designed to run locally with Docker Compose or in containerized environments.

## Features
- Fastify HTTP API with Clean Architecture layering and dependency injection.
- OIDC bearer + secure-session flows with Keycloak, plus RBAC enforced via `requirePermission`.
- Job registry with cron scheduling and advisory-lock guards for multi-replica safety.
- Postgres/Redis adapters with migrations, plus in-memory fallbacks for tests.
- OpenAPI documentation gated behind permissions; SDK-friendly via Swagger/Thunder/Postman/REST Client.
- OTEL traces + metrics, Pino logging, and ready-made load-testing scripts.

## Prerequisites
- Node.js 20+
- pnpm 8+
- Docker + Docker Compose (for local infra)
- Optional CLI tooling: `jq`, `curl`, `k6`

## Quickstart
```bash
pnpm install
cp .env.example .env

# start local infra (Postgres, Redis, Keycloak, OTEL)
docker compose -f infra/dev/docker-compose.yml up -d

# run database migrations
pnpm migrate

# boot the API (auto-loads .env)
pnpm dev
```

Health probe: `curl http://localhost:3000/health`

### Environment tips
- Keep `.env` in sync with `.env.example`, then load it into your shell: `export $(grep -v '^#' .env | xargs)`.
- `AUTH_MODE` defaults to `disabled` outside prod; set it to `oidc` to exercise Keycloak locally.

### Local infra tweaks
- Compose files live in `infra/dev/`.
- Override default ports if they clash: `POSTGRES_PORT=5440 REDIS_PORT=6380 docker compose up -d`.

## API Documentation
- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs/openapi.json`
- Both routes are wrapped in `requirePermission('docs.view')`; the seeded `admin` role already includes that permission in [migrations/002_seed_permissions.sql](migrations/002_seed_permissions.sql).

### Obtain a local admin token
```bash
curl -s -X POST http://localhost:8080/realms/lybra/protocol/openid-connect/token \
  -d grant_type=password \
  -d client_id=lybra-frontend \
  -d client_secret="$OIDC_CLIENT_SECRET" \
  -d username=admin \
  -d password=admin \
  -d scope="openid profile email" | jq -r .access_token
```

### Thunder Client
1. Install the VS Code “Thunder Client” extension.
2. `Collections → Import → OpenAPI`, paste `http://localhost:3000/docs/openapi.json`, set `Authorization: Bearer <token>` in the Auth tab so the fetch succeeds.
3. Thunder generates requests for each route; reuse the same auth header/environment for manual testing alongside Swagger.

### Postman
1. Import the protected spec (`Link` with auth header or a downloaded JSON file).
2. Attach this collection-level Pre-request Script so every call fetches a Keycloak token automatically:
```javascript
const url = pm.environment.get('oidcTokenUrl') || 'http://localhost:8080/realms/lybra/protocol/openid-connect/token';
const clientId = pm.environment.get('oidcClientId') || 'lybra-frontend';
const clientSecret = pm.environment.get('oidcClientSecret');
const username = pm.environment.get('oidcUsername') || 'admin';
const password = pm.environment.get('oidcPassword') || 'admin';
const scopes = pm.environment.get('oidcScopes') || 'openid profile email';

if (!clientSecret) throw new Error('Missing env variable oidcClientSecret');

pm.sendRequest({
  url,
  method: 'POST',
  header: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: {
    mode: 'urlencoded',
    urlencoded: [
      { key: 'grant_type', value: 'password' },
      { key: 'client_id', value: clientId },
      { key: 'client_secret', value: clientSecret },
      { key: 'username', value: username },
      { key: 'password', value: password },
      { key: 'scope', value: scopes }
    ]
  }
}, (err, res) => {
  if (err || res.code >= 400) {
    throw new Error(`Token request failed: ${err ? err.message : res.status}`);
  }
  const token = res.json().access_token;
  if (!token) throw new Error('Token response missing access_token');
  pm.environment.set('accessToken', token);
});
```
3. Create environment variables (`oidcClientSecret`, etc.) and point request headers to `Bearer {{accessToken}}`.
4. Use the Collection Runner (optionally with CSV/JSON data) to seed your database through real API flows.

### REST Client (VS Code)
1. Install `humao.rest-client`.
2. Create `requests.http`:
```http
### Health check
GET http://localhost:3000/health

### Authenticated /me
GET http://localhost:3000/me
Authorization: Bearer {{token}}

### Trigger sample cleanup job
POST http://localhost:3000/admin/jobs/sample.cleanup/run
Authorization: Bearer {{adminToken}}
```
3. Use REST Client environments to store `token` values and hit `Send Request` inline.

## Configuration
- **Server**: `PORT`, `HOST`, `LOG_LEVEL`, `TRUST_PROXY`, `CORS_ORIGINS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_TIME_WINDOW_MS`.
- **Data**: `DATABASE_URL`, `REDIS_URL`.
- **Jobs**: `JOBS_ENABLED`.
- **Auth**: `AUTH_MODE` (`disabled|oidc`), `DEV_USER_*` (dev-only), OIDC settings `OIDC_*`, session settings `SESSION_*`.
- **Keycloak helpers**: `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` (used to derive defaults in config loader).
- **Observability**: `OTEL_EXPORTER_OTLP_*`, `OTEL_TRACES_SAMPLER`, `OTEL_METRICS_EXPORT_INTERVAL_MS`.
- `.env.prod.example` holds hardened defaults (forced OIDC, secure cookies, conservative rate limits, production OTEL settings).

## Auth & RBAC
- Bearer tokens validated via OIDC discovery + JWKS; session flow uses `@fastify/secure-session` for web login (`/auth/login|callback|logout`).
- `requireAuth` populates `req.principal`, and `requirePermission` enforces RBAC.
- Seeded permissions (see [migrations/002_seed_permissions.sql](migrations/002_seed_permissions.sql)) grant `adminJobs.run` and `docs.view` to the `admin` role.
- Protected routes include `/me`, `/admin/jobs/:name/run`, `/docs`, `/docs/openapi.json`.

## Observability
- Configure OTEL exporters (traces + metrics) via env; smoke test delivery with `pnpm otel:smoke` (emits span `otel.smoke` and counter `otel_smoke_checks`).
- Local setup: `docker compose -f infra/dev/docker-compose.yml up -d otel-collector jaeger prometheus`, then point `OTEL_EXPORTER_OTLP_ENDPOINT` to `http://localhost:4318/v1/traces` (metrics endpoint similar).
- UIs: Jaeger (http://localhost:16686), Prometheus (http://localhost:9090), collector metrics at http://localhost:9464/metrics.
- Common metrics: `otel_smoke_checks`, `process_memory_rss_bytes`, `process_cpu_user_microseconds`, `process_event_loop_utilization`, `process_uptime_seconds`.

## Load Testing
- Quick sanity load: `pnpm dlx autocannon -c 50 -d 30 http://localhost:3000/health`.
- Scripted runs: `k6 run scripts/k6/health-smoke.js -e TARGET_URL=http://localhost:3000/health -e AUTH_HEADER="Bearer <token>"`.

## Operational Scripts
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
pnpm dev
pnpm migrate
```
