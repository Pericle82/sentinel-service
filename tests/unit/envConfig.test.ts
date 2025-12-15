import { describe, expect, it } from 'vitest';

import { loadEnv } from '@/infrastructure/config/env.js';

describe('env config safety', () => {
  it('requires OIDC settings when AUTH_MODE=oidc', () => {
    const env = {
      NODE_ENV: 'test',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'https://issuer.example',
      OIDC_CLIENT_ID: 'client',
      OIDC_REDIRECT_URI: 'https://app.example/callback',
      // Deliberately omit SESSION_SECRET to trigger oidc requirement error
    } as NodeJS.ProcessEnv;

    expect(() => loadEnv(env)).toThrow(/AUTH_MODE=oidc requires/i);
  });

  it('forces oidc in production and rejects disabled', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        AUTH_MODE: 'disabled'
      })
    ).toThrow(/AUTH_MODE=disabled is not allowed/);
  });

  it('uses dev principal defaults and parses roles', () => {
    const cfg = loadEnv({ NODE_ENV: 'test', DEV_USER_SUB: 'dev', DEV_USER_ROLES: 'admin, viewer' });
    expect(cfg.auth.devPrincipal.sub).toBe('dev');
    expect(cfg.auth.devPrincipal.roles).toEqual(['admin', 'viewer']);
  });

  it('parses jobs enabled flag and session cookie secure default', () => {
    const cfgTrue = loadEnv({ NODE_ENV: 'test', JOBS_ENABLED: 'true' });
    expect(cfgTrue.jobs.enabled).toBe(true);

    const cfgFalse = loadEnv({ NODE_ENV: 'test', JOBS_ENABLED: 'false' });
    expect(cfgFalse.jobs.enabled).toBe(false);

    const cfgSession = loadEnv({ NODE_ENV: 'test' });
    expect(cfgSession.session.cookieSecure).toBe(false);
  });
});
