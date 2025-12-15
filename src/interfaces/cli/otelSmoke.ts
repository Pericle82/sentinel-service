import 'dotenv/config';
import { metrics, trace } from '@opentelemetry/api';

import { loadEnv } from '@/infrastructure/config/env.js';
import { initTracing } from '@/infrastructure/otel/tracing.js';

async function main() {
  const config = loadEnv(process.env);

  const sdk = await initTracing(config);
  if (!sdk) {
    console.error('Telemetry is disabled. Set OTEL_EXPORTER_OTLP_ENDPOINT (and metrics endpoint) to run the smoke test.');
    process.exitCode = 1;
    return;
  }

  const tracer = trace.getTracer('otel-smoke');
  tracer.startActiveSpan('otel.smoke', (span) => {
    span.setAttribute('smoke.test', true);
    span.setAttribute('deployment.environment', config.nodeEnv);
    span.addEvent('otel smoke test started');
    span.end();
  });

  if (config.telemetry.metrics.enabled) {
    const meter = metrics.getMeter('otel-smoke');
    const counter = meter.createCounter('otel_smoke_checks', {
      description: 'Counts OTEL smoke test executions'
    });
    counter.add(1, { environment: config.nodeEnv });
  }

  await sdk.shutdown();
  console.log('OTEL smoke test completed. Check collector for span "otel.smoke" and metric "otel_smoke_checks".');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
