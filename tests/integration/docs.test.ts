import { describe, expect, it } from 'vitest';

import { loadEnv } from '@/infrastructure/config/env.js';
import { createLoggerConfig } from '@/infrastructure/logging/logger.js';
import { createApp } from '@/interfaces/http/createApp.js';
import type { TokenVerifier } from '@/application/ports/auth/TokenVerifier.js';

function makeTokenVerifier(): TokenVerifier {
  return {
    async verifyAccessToken(_token: string) {
      return { principal: { sub: 'docs-admin', roles: ['admin'] }, rawClaims: { sub: 'docs-admin' } };
    }
  };
}

const rawEnv = {
  NODE_ENV: 'test',
  AUTH_MODE: 'oidc',
  OIDC_ISSUER: 'https://issuer.example',
  OIDC_CLIENT_ID: 'test-client',
  OIDC_REDIRECT_URI: 'https://app.example/callback',
  SESSION_SECRET: 'test-session-secret-123'
} as NodeJS.ProcessEnv;

describe('API docs', () => {
  it('protects docs and serves OpenAPI JSON when authorized', async () => {
    const { app, config } = await createApp(rawEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' }),
      tokenVerifier: makeTokenVerifier()
    });

    const unauthorized = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await app.inject({
      method: 'GET',
      url: '/docs/openapi.json',
      headers: { authorization: 'Bearer allow' }
    });
    expect(authorized.statusCode).toBe(200);

    const body = authorized.json();
    expect(body.openapi).toMatch(/3\.0\.\d/);
    expect(body.info).toMatchObject({ title: 'Lybra Service API', version: '1.0.0' });
    const expectedHost = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
    expect(body.servers?.[0]?.url).toBe(`http://${expectedHost}:${config.port}`);

    await app.close();
  });
});
