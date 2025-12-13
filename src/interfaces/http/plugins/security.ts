import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { AppConfig } from '@/infrastructure/config/env.js';

export async function registerSecurityPlugins(app: FastifyInstance, config: AppConfig) {
  await app.register(helmet);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser clients
      if (config.corsOrigins.length === 0) return cb(null, false);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    }
  });

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindowMs
  });
}
