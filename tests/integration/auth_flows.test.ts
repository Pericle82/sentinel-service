import { describe, expect, it, vi } from 'vitest';

import { createLoggerConfig } from '@/infrastructure/logging/logger.js';
import { createApp } from '@/interfaces/http/createApp.js';
import { createInMemoryJobRegistry } from '@/infrastructure/jobs/inMemoryJobRegistry.js';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';

const mocks = vi.hoisted(() => ({
  buildAuthorizationUrl: vi.fn(async () => ({
    url: 'https://idp.example/auth',
    artifacts: { state: 'state-1', nonce: 'nonce-1', codeVerifier: 'cv-1' }
  })),
  handleCallback: vi.fn(async () => ({
    principal: { sub: 'oidc-user', roles: ['user'] },
    tokenExpiresAt: Date.now() + 60 * 60 * 1000,
    idToken: 'id-token-1',
    accessToken: 'access-token-1'
  })),
  buildLogoutUrl: vi.fn(async () => 'https://idp.example/logout')
}));

vi.mock('@/infrastructure/auth/oidc/oidcWebClient.js', () => ({
  buildAuthorizationUrl: mocks.buildAuthorizationUrl,
  handleCallback: mocks.handleCallback,
  buildLogoutUrl: mocks.buildLogoutUrl
}));

function makeTokenVerifier(): TokenVerifier {
  return {
    async verifyAccessToken(token: string) {
      if (token === 'good-admin') {
        return { principal: { sub: 'bearer-admin', roles: ['admin'] }, rawClaims: { sub: 'bearer-admin' } };
      }
      if (token === 'good-viewer') {
        return { principal: { sub: 'bearer-viewer', roles: ['viewer'] }, rawClaims: { sub: 'bearer-viewer' } };
      }
      throw new Error('invalid token');
    }
  };
}

const baseEnv = {
  NODE_ENV: 'test',
  AUTH_MODE: 'oidc',
  OIDC_ISSUER: 'https://issuer.example',
  OIDC_CLIENT_ID: 'test-client',
  OIDC_REDIRECT_URI: 'https://app.example/callback',
  OIDC_POST_LOGOUT_REDIRECT_URI: 'https://app.example/after-logout',
  SESSION_SECRET: 'test-session-secret-123456',
  DEV_USER_SUB: 'dev-user',
  DEV_USER_ROLES: 'admin'
} as NodeJS.ProcessEnv;

function cookieHeaderFrom(res: { headers: Record<string, unknown> }): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies
    .map((c) => (typeof c === 'string' ? c.split(';')[0] : ''))
    .filter(Boolean)
    .join('; ');
}

describe('auth flows', () => {
  it('supports session login → callback → logout', async () => {
    const { app } = await createApp(baseEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' }),
      tokenVerifier: makeTokenVerifier()
    });

    const loginRes = await app.inject({ method: 'GET', url: '/auth/login' });
    expect(loginRes.statusCode).toBe(302);
    expect(loginRes.headers.location).toBe('https://idp.example/auth');
    const loginCookieHeader = cookieHeaderFrom(loginRes);
    expect(loginCookieHeader).toBeTruthy();

    const callbackRes = await app.inject({
      method: 'GET',
      url: '/auth/callback?state=state-1&code=code-1',
      headers: { cookie: loginCookieHeader }
    });
    expect(callbackRes.statusCode).toBe(302);
    expect(callbackRes.headers.location).toBe('https://app.example/after-logout');
    const authCookieHeader = cookieHeaderFrom(callbackRes) || loginCookieHeader;

    const meRes = await app.inject({ method: 'GET', url: '/me', headers: { cookie: authCookieHeader } });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json()).toMatchObject({ authenticated: true, user: { sub: 'oidc-user' } });

    const logoutRes = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: authCookieHeader } });
    expect(logoutRes.statusCode).toBe(302);
    expect(logoutRes.headers.location).toBe('https://idp.example/logout');
    const clearedCookie = cookieHeaderFrom(logoutRes) || authCookieHeader;

    const afterLogout = await app.inject({ method: 'GET', url: '/me', headers: { cookie: clearedCookie } });
    expect(afterLogout.statusCode).toBe(401);

    await app.close();
  });

  it('handles bearer failures and permissions across roles', async () => {
    const { app } = await createApp(baseEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' }),
      tokenVerifier: makeTokenVerifier(),
      jobRegistry: createInMemoryJobRegistry([
        {
          name: 'demo.job',
          async run() {}
        }
      ])
    });

    const noToken = await app.inject({ method: 'GET', url: '/me' });
    expect(noToken.statusCode).toBe(401);

    const badToken = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer bad' } });
    expect(badToken.statusCode).toBe(401);

    const forbidden = await app.inject({
      method: 'POST',
      url: '/admin/jobs/demo.job/run',
      headers: { authorization: 'Bearer good-viewer' }
    });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'POST',
      url: '/admin/jobs/demo.job/run',
      headers: { authorization: 'Bearer good-admin' }
    });
    expect(allowed.statusCode).toBe(200);

    await app.close();
  });
});
