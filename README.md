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

`*` required when `AUTH_MODE=oidc`.

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
