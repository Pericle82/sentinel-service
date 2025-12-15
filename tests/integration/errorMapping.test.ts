import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/errors.js';
import { createLoggerConfig } from '@/infrastructure/logging/logger.js';
import { createApp } from '@/interfaces/http/createApp.js';

const rawEnv = {
  NODE_ENV: 'test',
  AUTH_MODE: 'disabled',
  DEV_USER_SUB: 'dev-user',
  DEV_USER_ROLES: 'admin',
  SESSION_SECRET: 'test-session-secret-123'
} as NodeJS.ProcessEnv;

const profileInput = {
  height: 170,
  weight: 70,
  age: 28
};

describe('error and validation mapping', () => {
  it('maps unexpected errors to 500 and domain errors to typed responses', async () => {
    const { app } = await createApp(rawEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' })
    });

    app.get('/boom', () => {
      throw new Error('boom');
    });

    app.get('/domain-missing', () => {
      throw new DomainError('NOT_FOUND', 'not here');
    });

    const boom = await app.inject({ method: 'GET', url: '/boom' });
    expect(boom.statusCode).toBe(500);
    expect(boom.json()).toMatchObject({ error: 'INTERNAL_SERVER_ERROR' });

    const missing = await app.inject({ method: 'GET', url: '/domain-missing' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: 'NOT_FOUND' });

    // validation/domain rule via user-profile patch with empty payload
    await app.inject({ method: 'PUT', url: '/user-profile', payload: profileInput });
    const invalidPatch = await app.inject({ method: 'PATCH', url: '/user-profile', payload: {} });
    expect(invalidPatch.statusCode).toBe(400);
    expect(invalidPatch.json()).toMatchObject({ error: 'DOMAIN_RULE_VIOLATION' });

    await app.close();
  });
});
