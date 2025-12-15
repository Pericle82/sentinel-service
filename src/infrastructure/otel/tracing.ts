import { context, diag, DiagConsoleLogger, DiagLogLevel, metrics, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { performance } from 'node:perf_hooks';

import type { AppConfig } from '@/infrastructure/config/env.js';

let initialized = false;

function parseHeaders(raw?: string) {
  return raw
    ? raw.split(',').reduce<Record<string, string>>((acc, kv) => {
        const [k, v] = kv.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {})
    : undefined;
}

function registerRuntimeMetrics() {
  const meter = metrics.getMeter('lybra-service');

  meter.createObservableGauge('process_memory_rss_bytes', {
    description: 'Resident set size in bytes',
    unit: 'By'
  }).addCallback((obs) => {
    const mem = process.memoryUsage();
    obs.observe(mem.rss);
  });

  meter.createObservableGauge('process_memory_heap_used_bytes', {
    description: 'V8 heap used in bytes',
    unit: 'By'
  }).addCallback((obs) => {
    const mem = process.memoryUsage();
    obs.observe(mem.heapUsed);
  });

  meter.createObservableGauge('process_cpu_user_microseconds', {
    description: 'User CPU time since process start',
    unit: 'us'
  }).addCallback((obs) => {
    const cpu = process.cpuUsage();
    obs.observe(cpu.user);
  });

  meter.createObservableGauge('process_cpu_system_microseconds', {
    description: 'System CPU time since process start',
    unit: 'us'
  }).addCallback((obs) => {
    const cpu = process.cpuUsage();
    obs.observe(cpu.system);
  });

  meter.createObservableGauge('process_event_loop_utilization', {
    description: 'Fraction of time the event loop was busy since start',
    unit: '1'
  }).addCallback((obs) => {
    const { utilization } = performance.eventLoopUtilization();
    obs.observe(utilization);
  });

  meter.createObservableGauge('process_uptime_seconds', {
    description: 'Process uptime in seconds',
    unit: 's'
  }).addCallback((obs) => {
    obs.observe(process.uptime());
  });
}

function buildSampler(sampler: string, samplerArg?: string) {
  if (sampler === 'traceidratio' && samplerArg) {
    const ratio = Number(samplerArg);
    if (!Number.isNaN(ratio)) return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) });
  }
  return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(1) });
}

/**
 * Initialize OpenTelemetry tracing (idempotent). No-op if disabled.
 */
export async function initTracing(config: AppConfig): Promise<NodeSDK | undefined> {
  if (initialized) return undefined;
  const tracesCfg = config.telemetry.traces;
  const metricsCfg = config.telemetry.metrics;
  if (!tracesCfg.enabled && !metricsCfg.enabled) return undefined;

  diag.setLogger(new DiagConsoleLogger(), { logLevel: DiagLogLevel.ERROR });

  const headers = parseHeaders(tracesCfg.headers);
  const metricHeaders = parseHeaders(metricsCfg.headers);

  const metricReader = metricsCfg.enabled && metricsCfg.endpoint
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: metricsCfg.endpoint,
          ...(metricHeaders ? { headers: metricHeaders } : {})
        }),
        exportIntervalMillis: metricsCfg.exportIntervalMs
      })
    : undefined;

  const sdk = new NodeSDK({
    resource: new Resource({
      'service.name': 'lybra-service',
      'deployment.environment': config.nodeEnv
    }),
    ...(tracesCfg.enabled
      ? {
          sampler: buildSampler(tracesCfg.sampler, tracesCfg.samplerArg),
          ...(tracesCfg.endpoint
            ? {
                traceExporter: new OTLPTraceExporter({
                  url: tracesCfg.endpoint,
                  ...(headers ? { headers } : {})
                }),
                instrumentations: [new HttpInstrumentation()]
              }
            : {})
        }
      : {}),
    ...(metricReader ? { metricReader } : {})
  });

  await sdk.start();

  if (metricReader) registerRuntimeMetrics();

  initialized = true;

  return sdk;
}

/**
 * Utility to extract current trace/span ids for logging enrichment.
 */
export function getCurrentSpanIds() {
  const span = trace.getSpan(context.active());
  if (!span) return undefined;
  const ctx = span.spanContext();
  return { trace_id: ctx.traceId, span_id: ctx.spanId }; // eslint-disable-line camelcase
}
