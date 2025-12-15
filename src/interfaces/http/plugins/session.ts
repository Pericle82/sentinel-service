import secureSession from '@fastify/secure-session';
import * as crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@/infrastructure/config/env.js';

function deriveKey(secret: string): Buffer {
  // secure-session expects a 32-byte key; derive via SHA-256 to normalize length
  return crypto.createHash('sha256').update(secret).digest();
}

export async function registerSession(app: FastifyInstance, config: AppConfig) {
  if (!config.session.secret) {
    throw new Error('SESSION_SECRET is required when sessions are enabled');
  }

  await app.register(secureSession, {
    key: deriveKey(config.session.secret),
    cookieName: config.session.cookieName,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: config.session.cookieSecure,
      sameSite: 'lax'
    }
  });
}
