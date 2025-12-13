import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  TRUST_PROXY: z
    .union([z.literal('true'), z.literal('false'), z.coerce.number().int().min(0)])
    .default('false'),
  CORS_ORIGINS: z.string().default(''),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(200),
  RATE_LIMIT_TIME_WINDOW_MS: z.coerce.number().int().min(1).default(60_000),

  // Auth
  AUTH_MODE: z.enum(['disabled', 'oidc']).optional(),

  // Dev auth (only used when AUTH_MODE=disabled)
  DEV_USER_SUB: z.string().min(1).default('dev'),
  DEV_USER_ROLES: z.string().default(''),

  // Provider-agnostic OIDC
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_AUDIENCE: z.string().optional(),
  OIDC_JWKS_URI: z.string().url().optional(),

  // OIDC Web (code flow)
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_POST_LOGOUT_REDIRECT_URI: z.string().url().optional(),
  OIDC_SCOPES: z.string().default('openid profile email'),

  // Keycloak convenience (optional)
  KEYCLOAK_BASE_URL: z.string().url().optional(),
  KEYCLOAK_REALM: z.string().min(1).optional(),
  KEYCLOAK_CLIENT_ID: z.string().min(1).optional(),

  // Data
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // Sessions
  SESSION_SECRET: z.string().min(16).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default('sid'),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
  SESSION_COOKIE_SECURE: z.enum(['true', 'false']).default('false'),

  // Jobs
  JOBS_ENABLED: z.enum(['true', 'false']).default('true')
});

export type Env = z.infer<typeof envSchema>;

function parseTrustProxy(value: Env['TRUST_PROXY']): boolean | number {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const message = 'Invalid environment variables';
    const details = parsed.error.flatten();
    const error = new Error(message);
    (error as Error & { details?: unknown }).details = details;
    throw error;
  }

  const env = parsed.data;
  const corsOrigins = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const authMode: 'disabled' | 'oidc' =
    env.AUTH_MODE ?? (env.NODE_ENV === 'production' ? 'oidc' : 'disabled');

  if (env.NODE_ENV === 'production' && authMode === 'disabled') {
    throw new Error('AUTH_MODE=disabled is not allowed when NODE_ENV=production');
  }

  if (authMode === 'oidc') {
    const missing = [] as string[];
    if (!env.OIDC_ISSUER) missing.push('OIDC_ISSUER');
    if (!env.OIDC_CLIENT_ID) missing.push('OIDC_CLIENT_ID');
    if (!env.OIDC_REDIRECT_URI) missing.push('OIDC_REDIRECT_URI');
    if (!env.SESSION_SECRET) missing.push('SESSION_SECRET');
    if (missing.length > 0) {
      throw new Error(`AUTH_MODE=oidc requires: ${missing.join(', ')}`);
    }
  }

  const jobsEnabled = env.JOBS_ENABLED === 'true';

  const devRoles = env.DEV_USER_ROLES.split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    corsOrigins,
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      timeWindowMs: env.RATE_LIMIT_TIME_WINDOW_MS
    },

    auth: {
      mode: authMode,
      devPrincipal: {
        sub: env.DEV_USER_SUB,
        roles: devRoles
      },
      oidc: {
        issuer: env.OIDC_ISSUER,
        audience: env.OIDC_AUDIENCE,
        jwksUri: env.OIDC_JWKS_URI,
        clientId: env.OIDC_CLIENT_ID,
        clientSecret: env.OIDC_CLIENT_SECRET,
        redirectUri: env.OIDC_REDIRECT_URI,
        postLogoutRedirectUri: env.OIDC_POST_LOGOUT_REDIRECT_URI,
        scopes: env.OIDC_SCOPES
      },
      keycloak: {
        baseUrl: env.KEYCLOAK_BASE_URL,
        realm: env.KEYCLOAK_REALM,
        clientId: env.KEYCLOAK_CLIENT_ID
      }
    },

    data: {
      databaseUrl: env.DATABASE_URL,
      redisUrl: env.REDIS_URL
    },

    jobs: {
      enabled: jobsEnabled
    },

    session: {
      secret: env.SESSION_SECRET,
      cookieName: env.SESSION_COOKIE_NAME,
      ttlSeconds: env.SESSION_TTL_SECONDS,
      cookieSecure: env.SESSION_COOKIE_SECURE === 'true'
    }
  };
}

export type AppConfig = ReturnType<typeof loadEnv>;
