import { describe, expect, it } from 'vitest';

import { createLoggerConfig } from '../src/infrastructure/logging/logger.js';
import { createApp } from '../src/interfaces/http/createApp.js';

describe('createApp composition root', () => {
  it('AUTH_MODE=disabled uses dev principal and allows /me', async () => {
    const rawEnv = {
      NODE_ENV: 'test',
      AUTH_MODE: 'disabled',
      DEV_USER_SUB: 'dev-user',
      DEV_USER_ROLES: 'admin'
    } as NodeJS.ProcessEnv;

    const { app } = await createApp(rawEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' })
    });

    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ authenticated: true, user: { sub: 'dev-user', roles: ['admin'] } });

    const adminRes = await app.inject({ method: 'POST', url: '/admin/jobs/sample.cleanup/run' });
    expect(adminRes.statusCode).toBe(200);

    await app.close();
  });
});
