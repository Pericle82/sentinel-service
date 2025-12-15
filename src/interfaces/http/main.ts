import 'dotenv/config';
import { createApp } from './createApp.js';
import { initTracing } from '@/infrastructure/otel/tracing.js';

const { app, config } = await createApp(process.env);
await initTracing(config);

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info({ host: config.host, port: config.port }, 'http server listening');
} catch (err) {
  app.log.fatal({ err }, 'failed to start server');
  process.exitCode = 1;
}
