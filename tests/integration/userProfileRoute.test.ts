import { describe, expect, it } from 'vitest';

import { createLoggerConfig } from '@/infrastructure/logging/logger.js';
import { createApp } from '@/interfaces/http/createApp.js';

const rawEnv = {
  NODE_ENV: 'test',
  AUTH_MODE: 'disabled',
  DEV_USER_SUB: 'dev-user',
  DEV_USER_EMAIL: 'dev@example.com',
  DEV_USER_NAME: 'Dev User',
  DEV_USER_ROLES: 'user',
  SESSION_SECRET: 'test-session-secret-123'
} as NodeJS.ProcessEnv;

const profileInput = {
  height: 180,
  weight: 81,
  age: 30,
  gender: 'male' as const,
  fitnessLevel: 'intermediate' as const,
  goals: 'stay fit',
  medicalNotes: null,
  workLifestyle: { jobType: 'desk', workFromHome: true },
  sleepPatterns: { avgBedtime: '23:00', avgWakeTime: '07:00' }
};

describe('user profile routes', () => {
  it('creates and retrieves a profile', async () => {
    const { app } = await createApp(rawEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' })
    });

    const putRes = await app.inject({ method: 'PUT', url: '/user-profile', payload: profileInput });
    expect(putRes.statusCode).toBe(201);
    expect(putRes.json()).toMatchObject({ success: true, created: true });

    const getRes = await app.inject({ method: 'GET', url: '/user-profile' });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toMatchObject({ success: true, data: { height: 180, weight: 81, age: 30 } });

    await app.close();
  });

  it('patches a profile, returns BMI and completion', async () => {
    const { app } = await createApp(rawEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' })
    });

    await app.inject({ method: 'PUT', url: '/user-profile', payload: profileInput });

    const patchRes = await app.inject({ method: 'PATCH', url: '/user-profile', payload: { weight: 72 } });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json()).toMatchObject({ success: true, data: { weight: 72 } });

    const bmiRes = await app.inject({ method: 'GET', url: '/user-profile/bmi' });
    expect(bmiRes.statusCode).toBe(200);
    expect(bmiRes.json()).toMatchObject({ success: true, data: { bmi: 22.22, category: 'Normal' } });

    const completionRes = await app.inject({ method: 'GET', url: '/user-profile/completion' });
    expect(completionRes.statusCode).toBe(200);
    expect(completionRes.json()).toMatchObject({ success: true, data: { completionScore: 100, missingFields: [] } });

    await app.close();
  });

  it('rejects empty patches and returns 404 after delete', async () => {
    const { app } = await createApp(rawEnv, {
      loggerConfig: createLoggerConfig({ level: 'silent', nodeEnv: 'test' })
    });

    await app.inject({ method: 'PUT', url: '/user-profile', payload: profileInput });

    const emptyPatch = await app.inject({ method: 'PATCH', url: '/user-profile', payload: {} });
    expect(emptyPatch.statusCode).toBe(400);
    expect(emptyPatch.json()).toMatchObject({ error: 'DOMAIN_RULE_VIOLATION' });

    const delRes = await app.inject({ method: 'DELETE', url: '/user-profile' });
    expect(delRes.statusCode).toBe(204);

    const getRes = await app.inject({ method: 'GET', url: '/user-profile' });
    expect(getRes.statusCode).toBe(404);
    expect(getRes.json()).toMatchObject({ error: 'NOT_FOUND' });

    await app.close();
  });
});
